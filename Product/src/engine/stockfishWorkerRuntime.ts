export interface WorkerCommand {
  cmd?: 'init' | 'go' | 'stop' | 'setoption' | 'ready' | 'newgame';
  fen?: string;
  depth?: number;
  multipv?: number;
  name?: string;
  value?: string | number | boolean;
  requestId?: number;
}

type EngineSource = 'local' | 'cdn';

export interface StockfishWorkerRuntimeDeps {
  WorkerCtor: typeof Worker;
  BlobCtor: typeof Blob;
  URLApi: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
  setTimeout: (handler: () => void, timeout: number) => number;
  clearTimeout: (id: number) => void;
  console: Pick<Console, 'warn'>;
  localEngine: string;
  cdnEngine: string;
  cdnWasm: string;
  readyFallbackMs: number;
}

export interface StockfishWorkerRuntime {
  init: () => void;
  handleCommand: (data: WorkerCommand | null | undefined) => void;
}

export const LOCAL_ENGINE = '/stockfish/stockfish-nnue-16-single.js';
export const CDN_ENGINE = 'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js';
export const CDN_WASM = 'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.wasm';
export const READY_FALLBACK_MS = 1500;

export function createStockfishWorkerRuntime(
  send: (msg: object) => void,
  deps: StockfishWorkerRuntimeDeps
): StockfishWorkerRuntime {
  let engine: Worker | null = null;
  let activeRequestId: number | null = null;
  let activeReadyRequestId: number | null = null;
  let readySent = false;
  let cdnBlobUrl: string | null = null;
  let readyFallbackTimer: number | null = null;

  function markReady(): void {
    if (readySent) return;
    readySent = true;
    clearReadyFallback();
    send({ type: 'ready' });
  }

  function handleLine(line: string): void {
    if (typeof line !== 'string') return;

    if (line === 'readyok') {
      deps.console.warn('[stockfish.worker] received readyok');
      if (activeReadyRequestId !== null) {
        const requestId = activeReadyRequestId;
        activeReadyRequestId = null;
        send({ type: 'ready', requestId });
        return;
      }

      markReady();
      return;
    }

    if (line === 'uciok') {
      deps.console.warn('[stockfish.worker] received uciok');
      return;
    }

    if (line.startsWith('bestmove')) {
      const parts = line.split(' ');
      const move = parts[1];
      const requestId = activeRequestId;
      activeRequestId = null;
      deps.console.warn(`[stockfish.worker] received bestmove: ${move}`);
      send({
        type: 'bestmove',
        requestId,
        move: move && move !== '(none)' ? move : null,
      });
      return;
    }

    if (line.startsWith('info') && line.includes(' score ')) {
      const depthMatch = line.match(/depth (\d+)/);
      const multipvMatch = line.match(/multipv (\d+)/);
      const cpMatch = line.match(/score cp (-?\d+)/);
      const mateMatch = line.match(/score mate (-?\d+)/);
      const pvMatch = line.match(/\bpv\s+(.+)$/);
      send({
        type: 'info',
        requestId: activeRequestId,
        depth: depthMatch ? parseInt(depthMatch[1], 10) : 0,
        multipv: multipvMatch ? parseInt(multipvMatch[1], 10) : 1,
        cp: cpMatch ? parseInt(cpMatch[1], 10) : null,
        mate: mateMatch ? parseInt(mateMatch[1], 10) : null,
        pv: pvMatch ? pvMatch[1].trim().split(/\s+/) : [],
        raw: line,
      });
    }
  }

  function createEngineWorker(url: string, source: EngineSource): Worker {
    if (source === 'cdn') {
      const objectUrl = deps.URLApi.createObjectURL(
        new deps.BlobCtor([`importScripts(${JSON.stringify(url)});`], {
          type: 'application/javascript',
        })
      );
      cdnBlobUrl = objectUrl;
      return new deps.WorkerCtor(`${objectUrl}#${encodeURIComponent(deps.cdnWasm)}`);
    }

    return new deps.WorkerCtor(url);
  }

  function cleanupEngine(): void {
    clearReadyFallback();

    if (engine) {
      engine.terminate();
      engine = null;
    }

    if (cdnBlobUrl) {
      deps.URLApi.revokeObjectURL(cdnBlobUrl);
      cdnBlobUrl = null;
    }
  }

  function reportStartupFailure(localError: string, cdnError: string): void {
    send({
      type: 'error',
      message: `Could not start Stockfish worker locally or via CDN. Local: ${localError}. CDN: ${cdnError}`,
    });
  }

  function attachEngine(candidate: Worker, source: EngineSource, localError: string | null): void {
    engine = candidate;

    try {
      candidate.addEventListener('message', (event: MessageEvent<string>) => {
        handleLine(event.data);
      });
      candidate.addEventListener('error', (event) => {
        const message = event.message || 'Unknown Stockfish worker load error.';
        deps.console.warn(`[stockfish.worker] worker error: ${message}`);
        if (source === 'local' && !readySent) {
          cleanupEngine();
          startEngine('cdn', message);
          return;
        }

        if (source === 'cdn' && localError) {
          reportStartupFailure(localError, message);
          return;
        }

        send({ type: 'error', message });
      });
      candidate.addEventListener('messageerror', (event) => {
        deps.console.warn(`[stockfish.worker] worker messageerror:`, event);
      });
      deps.console.warn(`[stockfish.worker] sending uci to ${source}`);
      candidate.postMessage('uci');
      deps.console.warn(`[stockfish.worker] sending isready to ${source}`);
      candidate.postMessage('isready');
      readyFallbackTimer = deps.setTimeout(() => {
        if (engine !== candidate || readySent) return;
        deps.console.warn('[stockfish.worker] readyok not received before fallback timeout; marking ready.');
        markReady();
      }, deps.readyFallbackMs);
    } catch (err) {
      cleanupEngine();
      if (source === 'local') {
        startEngine('cdn', formatError(err));
        return;
      }

      send({
        type: 'error',
        message: `Could not start Stockfish worker locally or via CDN. Local: ${localError ?? 'not attempted'}. CDN: ${formatError(err)}`,
      });
    }
  }

  function startEngine(source: EngineSource, localError: string | null = null): void {
    const url = source === 'local' ? deps.localEngine : deps.cdnEngine;
    deps.console.warn(`[stockfish.worker] worker created for ${source}: ${url}`);

    try {
      attachEngine(createEngineWorker(url, source), source, localError);
    } catch (err) {
      cleanupEngine();
      if (source === 'local') {
        startEngine('cdn', formatError(err));
        return;
      }

      reportStartupFailure(localError ?? 'not attempted', formatError(err));
    }
  }

  function init(): void {
    if (engine) return;
    startEngine('local');
  }

  function handleCommand(data: WorkerCommand | null | undefined): void {
    if (!data || typeof data !== 'object') return;

    if (data.cmd === 'init') {
      init();
      return;
    }

    if (!engine) {
      send({ type: 'error', message: 'engine not initialized' });
      return;
    }

    if (data.cmd === 'go') {
      activeRequestId = typeof data.requestId === 'number' ? data.requestId : null;
      const multipv = Math.max(1, Math.min(8, Math.round(data.multipv ?? 1)));
      const depth = Math.max(1, Math.round(Number.isFinite(data.depth) ? Number(data.depth) : 10));
      deps.console.warn(`[stockfish.worker] sending position: ${data.fen ?? ''}`);
      engine.postMessage(formatSetOption('MultiPV', multipv));
      engine.postMessage(`position fen ${data.fen ?? ''}`);
      deps.console.warn(`[stockfish.worker] sending go depth ${depth}`);
      engine.postMessage(`go depth ${depth}`);
    } else if (data.cmd === 'setoption' && data.name) {
      engine.postMessage(formatSetOption(data.name, data.value));
    } else if (data.cmd === 'newgame') {
      engine.postMessage('ucinewgame');
    } else if (data.cmd === 'ready') {
      activeReadyRequestId = typeof data.requestId === 'number' ? data.requestId : null;
      engine.postMessage('isready');
    } else if (data.cmd === 'stop') {
      if (typeof data.requestId !== 'number' || data.requestId === activeRequestId) {
        activeRequestId = null;
        activeReadyRequestId = null;
        engine.postMessage('stop');
      }
    }
  }

  function clearReadyFallback(): void {
    if (readyFallbackTimer === null) return;
    deps.clearTimeout(readyFallbackTimer);
    readyFallbackTimer = null;
  }

  return { init, handleCommand };
}

function formatSetOption(name: string, value: string | number | boolean | undefined): string {
  if (typeof value === 'undefined') return `setoption name ${name}`;
  return `setoption name ${name} value ${String(value)}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
