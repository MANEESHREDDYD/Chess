// Main-thread facade over the Stockfish worker.

interface EngineMessage {
  type?: 'ready' | 'error' | 'bestmove' | 'info';
  requestId?: number;
  move?: string | null;
  cp?: number | null;
  mate?: number | null;
  multipv?: number;
  pv?: string[];
  message?: string;
}

interface Evaluation {
  cp: number | null;
  mate: number | null;
}

export interface EngineCandidate {
  move: string;
  cp: number | null;
  mate: number | null;
  multipv: number;
  pv: string[];
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
    w.postMessage({ cmd: 'go', fen, depth, multipv: 1, requestId });
  });
}

export async function getCandidateMoves(
  fen: string,
  multipv = 4,
  depth = 8,
  timeoutMs = 15000
): Promise<EngineCandidate[]> {
  await waitForEngine();
  const w = ensureWorker();
  const requestId = nextRequestId();
  const candidateCount = Math.max(1, Math.min(8, Math.round(multipv)));
  const latestCandidates = new Map<number, EngineCandidate>();

  return new Promise((resolve) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      w.removeEventListener('message', handler);
    };

    const settle = (fallbackMove?: string | null) => {
      cleanup();
      const candidates = Array.from(latestCandidates.values()).sort(
        (a, b) => a.multipv - b.multipv
      );

      if (candidates.length === 0 && fallbackMove) {
        resolve([
          {
            move: fallbackMove,
            cp: null,
            mate: null,
            multipv: 1,
            pv: [fallbackMove],
          },
        ]);
        return;
      }

      resolve(candidates);
    };

    const handler = (e: MessageEvent<EngineMessage>) => {
      if (e.data?.requestId !== requestId) return;

      if (e.data.type === 'info' && e.data.pv?.[0]) {
        const candidate: EngineCandidate = {
          move: e.data.pv[0],
          cp: e.data.cp ?? null,
          mate: e.data.mate ?? null,
          multipv: e.data.multipv ?? 1,
          pv: e.data.pv,
        };
        latestCandidates.set(candidate.multipv, candidate);
      }

      if (e.data.type === 'bestmove') {
        settle(e.data.move ?? null);
      }
    };

    const timer = window.setTimeout(() => {
      w.postMessage({ cmd: 'stop', requestId });
      settle();
    }, timeoutMs);

    w.addEventListener('message', handler);
    w.postMessage({ cmd: 'go', fen, depth, multipv: candidateCount, requestId });
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
    w.postMessage({ cmd: 'go', fen, depth, multipv: 1, requestId });
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
