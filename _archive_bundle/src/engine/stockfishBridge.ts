// Stockfish bridge — main-thread facade over the Stockfish worker.
//
// Usage:
//   await waitForEngine();
//   const move = await getBestMove(fen, 10);

let worker: Worker | null = null;
let ready = false;
const readyWaiters: Array<() => void> = [];

function ensureWorker(): Worker {
  if (worker) return worker;

  // Vite-friendly worker construction. Worker is classic (uses importScripts).
  worker = new Worker(new URL('./stockfish.worker.ts', import.meta.url), {
    type: 'classic',
  });

  worker.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === 'ready') {
      ready = true;
      readyWaiters.forEach((r) => r());
      readyWaiters.length = 0;
    }
    if (e.data?.type === 'error') {
      // Log loudly so it's obvious when stockfish.wasm fails to load.
      console.error('[stockfish] worker error:', e.data.message);
    }
  });

  worker.addEventListener('error', (e) => {
    console.error('[stockfish] worker exception:', e.message);
  });

  return worker;
}

export function waitForEngine(timeoutMs = 8000): Promise<void> {
  if (ready) return Promise.resolve();
  ensureWorker();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Stockfish worker did not become ready in time.'));
    }, timeoutMs);
    readyWaiters.push(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function getBestMove(fen: string, depth = 10): Promise<string | null> {
  await waitForEngine();
  const w = ensureWorker();

  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'bestmove') {
        w.removeEventListener('message', handler);
        resolve(e.data.move ?? null);
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ cmd: 'go', fen, depth });
  });
}

export function stopThinking(): void {
  if (!worker) return;
  worker.postMessage({ cmd: 'stop' });
}
