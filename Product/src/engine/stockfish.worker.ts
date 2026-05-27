/// <reference lib="webworker" />

interface WorkerCommand {
  cmd?: 'init' | 'go' | 'stop' | 'setoption';
  fen?: string;
  depth?: number;
  name?: string;
  value?: string | number | boolean;
  requestId?: number;
}

const LOCAL_ENGINE = '/stockfish/stockfish-nnue-16-single.js';
const CDN_ENGINE = 'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish-nnue-16-single.js';

let engine: Worker | null = null;
let activeRequestId: number | null = null;
let readySent = false;
let cdnBlobUrl: string | null = null;

type EngineSource = 'local' | 'cdn';

function send<T extends object>(msg: T): void {
  (self as DedicatedWorkerGlobalScope).postMessage(msg);
}

function markReady(): void {
  if (readySent) return;
  readySent = true;
  send({ type: 'ready' });
}

function handleLine(line: string): void {
  if (typeof line !== 'string') return;

  if (line === 'readyok') {
    markReady();
    return;
  }

  if (line.startsWith('bestmove')) {
    const parts = line.split(' ');
    const move = parts[1];
    const requestId = activeRequestId;
    activeRequestId = null;
    send({
      type: 'bestmove',
      requestId,
      move: move && move !== '(none)' ? move : null,
    });
    return;
  }

  if (line.startsWith('info') && line.includes(' score ')) {
    const depthMatch = line.match(/depth (\d+)/);
    const cpMatch = line.match(/score cp (-?\d+)/);
    const mateMatch = line.match(/score mate (-?\d+)/);
    send({
      type: 'info',
      requestId: activeRequestId,
      depth: depthMatch ? parseInt(depthMatch[1], 10) : 0,
      cp: cpMatch ? parseInt(cpMatch[1], 10) : null,
      mate: mateMatch ? parseInt(mateMatch[1], 10) : null,
      raw: line,
    });
  }
}

function formatSetOption(name: string, value: string | number | boolean | undefined): string {
  if (typeof value === 'undefined') return `setoption name ${name}`;
  return `setoption name ${name} value ${String(value)}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createEngineWorker(url: string, source: EngineSource): Worker {
  if (source === 'cdn') {
    cdnBlobUrl = URL.createObjectURL(
      new Blob([`importScripts(${JSON.stringify(url)});`], { type: 'application/javascript' })
    );
    return new Worker(cdnBlobUrl);
  }

  return new Worker(url);
}

function cleanupEngine(): void {
  if (engine) {
    engine.terminate();
    engine = null;
  }

  if (cdnBlobUrl) {
    URL.revokeObjectURL(cdnBlobUrl);
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
    candidate.postMessage('uci');
    candidate.postMessage('isready');
    setTimeout(() => {
      if (engine === candidate) markReady();
    }, 1500);
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
  const url = source === 'local' ? LOCAL_ENGINE : CDN_ENGINE;

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

self.onmessage = (e: MessageEvent<WorkerCommand>) => {
  const data = e.data;
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
    engine.postMessage(`position fen ${data.fen ?? ''}`);
    engine.postMessage(`go depth ${data.depth ?? 10}`);
  } else if (data.cmd === 'setoption' && data.name) {
    engine.postMessage(formatSetOption(data.name, data.value));
  } else if (data.cmd === 'stop') {
    if (typeof data.requestId !== 'number' || data.requestId === activeRequestId) {
      activeRequestId = null;
      engine.postMessage('stop');
    }
  }
};

init();
