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

function init(): void {
  if (engine) return;

  const createWorker = (url: string): Worker => new Worker(url);

  try {
    engine = createWorker(LOCAL_ENGINE);
  } catch (localErr) {
    try {
      engine = createWorker(CDN_ENGINE);
    } catch (cdnErr) {
      send({
        type: 'error',
        message:
          `Could not start Stockfish worker locally or via CDN. Local: ${localErr instanceof Error ? localErr.message : String(localErr)}. CDN: ${cdnErr instanceof Error ? cdnErr.message : String(cdnErr)}`,
      });
      return;
    }
  }

  try {
    engine.addEventListener('message', (event: MessageEvent<string>) => {
      handleLine(event.data);
    });
    engine.addEventListener('error', (event) => {
      send({ type: 'error', message: event.message });
    });
    engine.postMessage('uci');
    engine.postMessage('isready');
    setTimeout(markReady, 1500);
  } catch (err) {
    send({
      type: 'error',
      message: err instanceof Error ? err.message : 'Could not start Stockfish worker.',
    });
  }
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
