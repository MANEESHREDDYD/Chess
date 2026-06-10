import type { StockfishBootEvent, StockfishBootPhase } from './stockfishTelemetry';

export interface WorkerCommand {
  cmd?: 'init' | 'go' | 'stop' | 'setoption' | 'ready' | 'newgame';
  fen?: string;
  depth?: number;
  multipv?: number;
  name?: string;
  value?: string | number | boolean;
  requestId?: number;
}

export type StockfishWorkerRuntimeMessage =
  | { type: 'ready'; requestId?: number | null }
  | { type: 'error'; message: string }
  | { type: 'bestmove'; requestId: number | null; move: string | null }
  | {
      type: 'info';
      requestId: number | null;
      depth: number;
      multipv: number;
      cp: number | null;
      mate: number | null;
      pv: string[];
      raw: string;
    }
  | ({ type: 'boot_event' } & StockfishBootEvent);

export type EngineSourceKind = 'single' | 'no-simd';

export interface EngineAsset {
  source: EngineSourceKind;
  scriptUrl: string;
  wasmUrl: string;
}

export interface StockfishWorkerRuntimeDeps {
  WorkerCtor: typeof Worker;
  console: Pick<Console, 'warn'>;
  engineAssets: EngineAsset[];
  fetch?: typeof fetch;
  now: () => number;
}

export interface StockfishWorkerRuntime {
  init: () => void;
  handleCommand: (data: WorkerCommand | null | undefined) => void;
}

export const LOCAL_ENGINE = '/stockfish/stockfish-nnue-16-single.js';
export const LOCAL_WASM = '/stockfish/stockfish-nnue-16-single.wasm';
export const LOCAL_NO_SIMD_ENGINE = '/stockfish/stockfish-nnue-16-no-simd.js';
export const LOCAL_NO_SIMD_WASM = '/stockfish/stockfish-nnue-16-no-simd.wasm';
export const STOCKFISH_ENGINE_ASSETS: EngineAsset[] = [
  { source: 'single', scriptUrl: LOCAL_ENGINE, wasmUrl: LOCAL_WASM },
  { source: 'no-simd', scriptUrl: LOCAL_NO_SIMD_ENGINE, wasmUrl: LOCAL_NO_SIMD_WASM },
];

export function createStockfishWorkerRuntime(
  send: (msg: StockfishWorkerRuntimeMessage) => void,
  deps: StockfishWorkerRuntimeDeps
): StockfishWorkerRuntime {
  let engine: Worker | null = null;
  let activeRequestId: number | null = null;
  let activeReadyRequestId: number | null = null;
  let readySent = false;
  const startedAt = deps.now();

  function sendBootEvent(phase: StockfishBootPhase, event: Partial<StockfishBootEvent> = {}): void {
    send({
      type: 'boot_event',
      phase,
      elapsed_ms: Math.round(deps.now() - startedAt),
      timestamp: new Date().toISOString(),
      ...event,
    });
  }

  function markReady(): void {
    if (readySent) return;
    readySent = true;
    sendBootEvent('stockfish_runtime_ready');
    send({ type: 'ready' });
  }

  function handleLine(line: string): void {
    if (typeof line !== 'string') return;

    if (line === 'readyok') {
      deps.console.warn('[stockfish.worker] received readyok');
      sendBootEvent('readyok_received', { readyok_seen: true, request_id: activeReadyRequestId });
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
      sendBootEvent('uciok_received', { uciok_seen: true });
      return;
    }

    if (line.startsWith('bestmove')) {
      const parts = line.split(' ');
      const move = parts[1];
      const requestId = activeRequestId;
      activeRequestId = null;
      deps.console.warn(`[stockfish.worker] received bestmove: ${move}`);
      sendBootEvent('first_bestmove_received', { request_id: requestId });
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

  function createEngineWorker(asset: EngineAsset): Worker {
    return new deps.WorkerCtor(`${asset.scriptUrl}#${encodeURIComponent(asset.wasmUrl)}`);
  }

  function cleanupEngine(): void {
    if (engine) {
      engine.terminate();
      engine = null;
    }
  }

  function reportStartupFailure(errors: string[]): void {
    sendBootEvent('boot_failed', {
      message: `Could not start Stockfish worker locally. ${errors.join(' | ')}`,
    });
    send({
      type: 'error',
      message: `Could not start Stockfish worker locally. ${errors.join(' | ')}`,
    });
  }

  function attachEngine(candidate: Worker, asset: EngineAsset, fallbackErrors: string[]): void {
    engine = candidate;

    try {
      candidate.addEventListener('message', (event: MessageEvent<string>) => {
        handleLine(event.data);
      });
      candidate.addEventListener('error', (event) => {
        const message = event.message || 'Unknown Stockfish worker load error.';
        deps.console.warn(`[stockfish.worker] worker error: ${message}`);
        sendBootEvent('boot_failed', {
          message,
          worker_url: asset.scriptUrl,
          worker_source_kind: asset.source,
          wasm_path: asset.wasmUrl,
        });
        if (!readySent && asset.source !== deps.engineAssets[deps.engineAssets.length - 1]?.source) {
          cleanupEngine();
          void startEngine(deps.engineAssets.findIndex((candidateAsset) => candidateAsset.source === asset.source) + 1, [
            ...fallbackErrors,
            `${asset.source}: ${message}`,
          ]);
          return;
        }

        reportStartupFailure([...fallbackErrors, `${asset.source}: ${message}`]);
      });
      candidate.addEventListener('messageerror', (event) => {
        deps.console.warn(`[stockfish.worker] worker messageerror:`, event);
        sendBootEvent('boot_failed', {
          message: 'Stockfish worker posted an unreadable message.',
          worker_url: asset.scriptUrl,
          worker_source_kind: asset.source,
          wasm_path: asset.wasmUrl,
        });
      });
      deps.console.warn(`[stockfish.worker] sending uci to ${asset.source}`);
      sendBootEvent('uci_sent', {
        worker_url: asset.scriptUrl,
        worker_source_kind: asset.source,
        wasm_path: asset.wasmUrl,
      });
      candidate.postMessage('uci');
      deps.console.warn(`[stockfish.worker] sending isready to ${asset.source}`);
      sendBootEvent('isready_sent', {
        worker_url: asset.scriptUrl,
        worker_source_kind: asset.source,
        wasm_path: asset.wasmUrl,
      });
      candidate.postMessage('isready');
    } catch (err) {
      cleanupEngine();
      const message = formatError(err);
      sendBootEvent('boot_failed', {
        message,
        worker_url: asset.scriptUrl,
        worker_source_kind: asset.source,
        wasm_path: asset.wasmUrl,
      });
      const nextIndex = deps.engineAssets.findIndex((candidateAsset) => candidateAsset.source === asset.source) + 1;
      if (nextIndex < deps.engineAssets.length) {
        void startEngine(nextIndex, [...fallbackErrors, `${asset.source}: ${message}`]);
        return;
      }

      reportStartupFailure([...fallbackErrors, `${asset.source}: ${message}`]);
    }
  }

  async function probeWasm(asset: EngineAsset): Promise<Pick<StockfishBootEvent, 'wasm_reached' | 'wasm_content_type'>> {
    if (!deps.fetch) return {};
    try {
      const response = await deps.fetch(asset.wasmUrl, { cache: 'no-store' });
      return {
        wasm_reached: response.ok,
        wasm_content_type: response.headers.get('content-type'),
      };
    } catch (error) {
      return {
        wasm_reached: false,
        wasm_content_type: formatError(error),
      };
    }
  }

  async function startEngine(assetIndex: number, fallbackErrors: string[] = []): Promise<void> {
    const asset = deps.engineAssets[assetIndex];
    if (!asset) {
      reportStartupFailure(fallbackErrors.length ? fallbackErrors : ['No Stockfish engine assets were configured.']);
      return;
    }

    deps.console.warn(`[stockfish.worker] worker created for ${asset.source}: ${asset.scriptUrl}`);
    sendBootEvent('stockfish_script_loading', {
      worker_url: asset.scriptUrl,
      worker_source_kind: asset.source,
      wasm_path: asset.wasmUrl,
    });
    const wasmProbe = await probeWasm(asset);

    try {
      const candidate = createEngineWorker(asset);
      sendBootEvent('stockfish_script_loaded', {
        worker_url: asset.scriptUrl,
        worker_source_kind: asset.source,
        wasm_path: asset.wasmUrl,
        ...wasmProbe,
      });
      attachEngine(candidate, asset, fallbackErrors);
    } catch (err) {
      cleanupEngine();
      const message = formatError(err);
      sendBootEvent('boot_failed', {
        message,
        worker_url: asset.scriptUrl,
        worker_source_kind: asset.source,
        wasm_path: asset.wasmUrl,
        ...wasmProbe,
      });
      const nextIndex = assetIndex + 1;
      if (nextIndex < deps.engineAssets.length) {
        void startEngine(nextIndex, [...fallbackErrors, `${asset.source}: ${message}`]);
        return;
      }

      reportStartupFailure([...fallbackErrors, `${asset.source}: ${message}`]);
    }
  }

  function init(): void {
    if (engine) return;
    void startEngine(0);
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
      sendBootEvent('first_search_started', { request_id: activeRequestId });
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

  return { init, handleCommand };
}

function formatSetOption(name: string, value: string | number | boolean | undefined): string {
  if (typeof value === 'undefined') return `setoption name ${name}`;
  return `setoption name ${name} value ${String(value)}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
