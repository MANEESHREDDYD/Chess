/// <reference lib="webworker" />
//
// Stockfish Web Worker — with CDN fallback.
//
// Loads /stockfish/stockfish.js first (copied at build time from node_modules).
// If that 404s, falls back to a CDN URL so the prototype still functions on a
// fresh deploy where the static-copy step might have shifted paths.

declare const STOCKFISH: (opts?: {
  locateFile?: (path: string) => string;
  wasmBinary?: ArrayBuffer;
}) => StockfishInstance;

interface StockfishInstance {
  postMessage: (cmd: string) => void;
  addMessageListener?: (fn: (line: string) => void) => void;
  onmessage?: (line: string) => void;
  terminate?: () => void;
}

const LOCAL_SF = '/stockfish/stockfish.js';
// Pinned CDN fallback. Lichess-style; this URL has been stable for years.
const CDN_SF = 'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish.js';

let engine: StockfishInstance | null = null;

function send<T extends object>(msg: T): void {
  (self as DedicatedWorkerGlobalScope).postMessage(msg);
}

function attachListener(eng: StockfishInstance, handler: (line: string) => void) {
  if (typeof eng.addMessageListener === 'function') {
    eng.addMessageListener(handler);
  } else {
    eng.onmessage = handler;
  }
}

function handleLine(line: string) {
  if (typeof line !== 'string') return;

  if (line.startsWith('bestmove')) {
    const parts = line.split(' ');
    const move = parts[1];
    if (move && move !== '(none)') {
      send({ type: 'bestmove', move });
    } else {
      send({ type: 'bestmove', move: null });
    }
  } else if (line.startsWith('info') && line.includes(' score ')) {
    const depthMatch = line.match(/depth (\d+)/);
    const cpMatch = line.match(/score cp (-?\d+)/);
    const mateMatch = line.match(/score mate (-?\d+)/);
    send({
      type: 'info',
      depth: depthMatch ? parseInt(depthMatch[1], 10) : 0,
      cp: cpMatch ? parseInt(cpMatch[1], 10) : null,
      mate: mateMatch ? parseInt(mateMatch[1], 10) : null,
      raw: line,
    });
  }
}

function tryLoad(url: string, locateBase: string): boolean {
  try {
    // @ts-expect-error importScripts is available in classic workers
    importScripts(url);
    if (typeof STOCKFISH !== 'function') return false;
    engine = STOCKFISH({
      locateFile: (path: string) => `${locateBase}${path}`,
    });
    attachListener(engine, handleLine);
    engine.postMessage('uci');
    engine.postMessage('isready');
    return true;
  } catch (err) {
    console.warn('[stockfish] load failed for', url, err);
    return false;
  }
}

function init() {
  // Try local first.
  if (tryLoad(LOCAL_SF, '/stockfish/')) {
    console.log('[stockfish] loaded from local /stockfish/');
  } else if (tryLoad(CDN_SF, 'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/')) {
    console.log('[stockfish] loaded from CDN fallback');
  } else {
    send({
      type: 'error',
      message:
        'Could not load Stockfish from local or CDN. Check that /stockfish/stockfish.js is served, or that the CDN is reachable.',
    });
    return;
  }

  // Signal ready after a short delay to let uciok/readyok arrive.
  setTimeout(() => send({ type: 'ready' }), 250);
}

self.onmessage = (e: MessageEvent) => {
  const data = e.data;
  if (!data || typeof data !== 'object') return;

  if (data.cmd === 'init') {
    if (!engine) init();
    return;
  }

  if (!engine) {
    send({ type: 'error', message: 'engine not initialized' });
    return;
  }

  if (data.cmd === 'go') {
    const fen = data.fen as string;
    const depth = (data.depth as number) ?? 10;
    engine.postMessage(`position fen ${fen}`);
    engine.postMessage(`go depth ${depth}`);
  } else if (data.cmd === 'stop') {
    engine.postMessage('stop');
  }
};

init();
