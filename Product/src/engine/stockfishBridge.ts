// Main-thread facade over the Stockfish worker.

interface EngineMessage {
  type?: 'ready' | 'error' | 'bestmove' | 'info';
  requestId?: number;
  move?: string | null;
  cp?: number | null;
  mate?: number | null;
  message?: string;
}

interface Evaluation {
  cp: number | null;
  mate: number | null;
}

type EngineOptionValue = string | number | boolean;

let worker: Worker | null = null;
let ready = false;
let requestSeq = 0;
const readyWaiters: Array<() => void> = [];

function ensureWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL('./stockfish.worker.ts', import.meta.url), {
    type: 'classic',
  });

  worker.addEventListener('message', (e: MessageEvent<EngineMessage>) => {
    if (e.data?.type === 'ready') {
      ready = true;
      readyWaiters.forEach((resolve) => resolve());
      readyWaiters.length = 0;
    }

    if (e.data?.type === 'error') {
      console.error('[stockfish] worker error:', e.data.message);
    }
  });

  worker.addEventListener('error', (e) => {
    console.error('[stockfish] worker exception:', e.message);
  });

  return worker;
}

function nextRequestId(): number {
  requestSeq += 1;
  return requestSeq;
}

export function waitForEngine(timeoutMs = 8000): Promise<void> {
  if (ready) return Promise.resolve();
  ensureWorker();

  return new Promise((resolve, reject) => {
    const waiter = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(() => {
      const index = readyWaiters.indexOf(waiter);
      if (index >= 0) readyWaiters.splice(index, 1);
      reject(new Error('Stockfish worker did not become ready in time.'));
    }, timeoutMs);

    readyWaiters.push(waiter);
  });
}

export async function getBestMove(
  fen: string,
  depth = 10,
  timeoutMs = 15000
): Promise<string | null> {
  await waitForEngine();
  const w = ensureWorker();
  const requestId = nextRequestId();

  return new Promise((resolve) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      w.removeEventListener('message', handler);
    };

    const handler = (e: MessageEvent<EngineMessage>) => {
      if (e.data?.type === 'bestmove' && e.data.requestId === requestId) {
        cleanup();
        resolve(e.data.move ?? null);
      }
    };

    const timer = window.setTimeout(() => {
      cleanup();
      w.postMessage({ cmd: 'stop', requestId });
      resolve(null);
    }, timeoutMs);

    w.addEventListener('message', handler);
    w.postMessage({ cmd: 'go', fen, depth, requestId });
  });
}

export async function evaluatePosition(fen: string, depth = 14): Promise<Evaluation> {
  await waitForEngine();
  const w = ensureWorker();
  const requestId = nextRequestId();
  let latest: Evaluation = { cp: null, mate: null };

  return new Promise((resolve) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      w.removeEventListener('message', handler);
    };

    const handler = (e: MessageEvent<EngineMessage>) => {
      if (e.data?.requestId !== requestId) return;

      if (e.data.type === 'info') {
        latest = {
          cp: e.data.cp ?? null,
          mate: e.data.mate ?? null,
        };
      }

      if (e.data.type === 'bestmove') {
        cleanup();
        resolve(latest);
      }
    };

    const timer = window.setTimeout(() => {
      cleanup();
      w.postMessage({ cmd: 'stop', requestId });
      resolve(latest);
    }, 15000);

    w.addEventListener('message', handler);
    w.postMessage({ cmd: 'go', fen, depth, requestId });
  });
}

export async function setOption(name: string, value: EngineOptionValue): Promise<void> {
  await waitForEngine();
  ensureWorker().postMessage({ cmd: 'setoption', name, value });
}

export function stopThinking(): void {
  if (!worker) return;
  worker.postMessage({ cmd: 'stop' });
}
