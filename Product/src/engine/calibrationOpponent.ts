// Calibration-only Stockfish wrapper. Do not import this from Phase 2 Mirror code:
// Mirror move generation gets its own architecture after the Maia spike decision.

interface EngineMessage {
  type?: 'ready' | 'error' | 'bestmove';
  requestId?: number | null;
  move?: string | null;
  message?: string;
}

interface CalibrationOpponentOptions {
  skillLevel?: number;
  depth?: number;
  moveTimeoutMs?: number;
}

interface PendingMove {
  requestId: number;
  resolve: (move: string | null) => void;
  timer: number;
}

interface ReadyWaiter {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: number;
}

const DEFAULT_SKILL_LEVEL = 8;
const DEFAULT_DEPTH = 6;
const DEFAULT_MOVE_TIMEOUT_MS = 12000;

let worker: Worker | null = null;
let ready = false;
let configured = false;
let requestSeq = 0;
let pendingMove: PendingMove | null = null;
const readyWaiters: ReadyWaiter[] = [];

export async function init(options: CalibrationOpponentOptions = {}): Promise<void> {
  ensureWorker();
  await waitForReady();
  configure(options.skillLevel ?? DEFAULT_SKILL_LEVEL);
}

export async function move(
  fen: string,
  options: CalibrationOpponentOptions = {}
): Promise<string | null> {
  await init(options);

  const activeWorker = ensureWorker();
  const requestId = nextRequestId();
  const depth = Math.min(options.depth ?? DEFAULT_DEPTH, DEFAULT_DEPTH);
  const moveTimeoutMs = options.moveTimeoutMs ?? DEFAULT_MOVE_TIMEOUT_MS;

  return new Promise((resolve) => {
    settlePendingMove(null);

    const timer = window.setTimeout(() => {
      activeWorker.postMessage({ cmd: 'stop', requestId });
      settlePendingMove(null);
    }, moveTimeoutMs);

    pendingMove = { requestId, resolve, timer };
    activeWorker.postMessage({ cmd: 'go', fen, depth, requestId });
  });
}

export function dispose(): void {
  settlePendingMove(null);
  rejectReadyWaiters('Calibration Stockfish disposed before it became ready.');

  if (worker) {
    worker.postMessage({ cmd: 'stop' });
    worker.terminate();
  }

  worker = null;
  ready = false;
  configured = false;
}

function ensureWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL('./stockfish.worker.ts', import.meta.url), {
    type: 'module',
  });

  worker.addEventListener('message', handleMessage);
  worker.addEventListener('error', (event) => {
    console.error('[calibrationOpponent] worker exception:', event.message);
    if (!ready) {
      failWorkerStartup(event.message || 'Calibration Stockfish worker failed before ready.');
    }
  });
  worker.postMessage({ cmd: 'init' });

  return worker;
}

function waitForReady(timeoutMs = 8000): Promise<void> {
  if (ready) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      const index = readyWaiters.indexOf(waiter);
      if (index >= 0) readyWaiters.splice(index, 1);
      reject(new Error('Calibration Stockfish did not become ready in time.'));
    }, timeoutMs);
    const waiter: ReadyWaiter = {
      resolve: () => {
        window.clearTimeout(timer);
        resolve();
      },
      reject: (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
      timer,
    };

    readyWaiters.push(waiter);
  });
}

function configure(skillLevel: number): void {
  if (!worker || configured) return;

  worker.postMessage({ cmd: 'setoption', name: 'Skill Level', value: skillLevel });
  configured = true;
}

function handleMessage(event: MessageEvent<EngineMessage>): void {
  const data = event.data;

  if (data.type === 'ready') {
    ready = true;
    resolveReadyWaiters();
    return;
  }

  if (data.type === 'error') {
    console.error('[calibrationOpponent] worker error:', data.message);
    if (!ready) {
      failWorkerStartup(data.message ?? 'Calibration Stockfish worker failed before ready.');
    }
    return;
  }

  if (data.type === 'bestmove' && pendingMove && data.requestId === pendingMove.requestId) {
    settlePendingMove(data.move ?? null);
  }
}

function settlePendingMove(move: string | null): void {
  if (!pendingMove) return;
  const { resolve } = pendingMove;
  window.clearTimeout(pendingMove.timer);
  pendingMove = null;
  resolve(move);
}

function nextRequestId(): number {
  requestSeq += 1;
  return requestSeq;
}

function resolveReadyWaiters(): void {
  readyWaiters.splice(0).forEach((waiter) => waiter.resolve());
}

function rejectReadyWaiters(message: string): void {
  readyWaiters.splice(0).forEach((waiter) => waiter.reject(new Error(message)));
}

function failWorkerStartup(message: string): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  ready = false;
  configured = false;
  rejectReadyWaiters(message);
}
