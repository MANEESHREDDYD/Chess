import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CDN_ENGINE,
  CDN_WASM,
  LOCAL_ENGINE,
  READY_FALLBACK_MS,
  createStockfishWorkerRuntime,
  type StockfishWorkerRuntimeDeps,
} from './stockfishWorkerRuntime';

class MockEngineWorker extends EventTarget {
  static instances: MockEngineWorker[] = [];

  readonly url: string;
  readonly posted: unknown[] = [];
  terminate = vi.fn();

  constructor(url: string) {
    super();
    this.url = url;
    MockEngineWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  emitLine(line: string): void {
    this.dispatchEvent(new MessageEvent('message', { data: line }));
  }

  emitError(message: string): void {
    this.dispatchEvent(new ErrorEvent('error', { message }));
  }
}

describe('stockfish worker runtime', () => {
  beforeEach(() => {
    MockEngineWorker.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prefers actual readyok over the fallback timer', async () => {
    const { deps, sent } = runtimeHarness();
    const runtime = createStockfishWorkerRuntime((msg) => sent.push(msg), deps);

    runtime.init();
    MockEngineWorker.instances[0].emitLine('readyok');
    await vi.advanceTimersByTimeAsync(READY_FALLBACK_MS);

    expect(sent).toEqual([{ type: 'ready' }]);
    expect(deps.console.warn).not.toHaveBeenCalledWith('[stockfish.worker] readyok not received before fallback timeout; marking ready.');
  });

  it('logs and marks ready when the readyok fallback fires', async () => {
    const { deps, sent } = runtimeHarness();
    const runtime = createStockfishWorkerRuntime((msg) => sent.push(msg), deps);

    runtime.init();
    await vi.advanceTimersByTimeAsync(READY_FALLBACK_MS);

    expect(sent).toEqual([{ type: 'ready' }]);
    expect(deps.console.warn).toHaveBeenCalledWith(
      '[stockfish.worker] readyok not received before fallback timeout; marking ready.'
    );
  });

  it('falls back from local worker load failure to the pinned CDN worker with an explicit wasm URL', () => {
    const { deps, sent } = runtimeHarness();
    const runtime = createStockfishWorkerRuntime((msg) => sent.push(msg), deps);

    runtime.init();
    const localWorker = MockEngineWorker.instances[0];
    localWorker.emitError('local 404');
    const cdnWorker = MockEngineWorker.instances[1];
    cdnWorker.emitLine('readyok');

    expect(localWorker.url).toBe(LOCAL_ENGINE);
    expect(localWorker.terminate).toHaveBeenCalledOnce();
    expect(cdnWorker.url).toBe(`blob:stockfish-cdn#${encodeURIComponent(CDN_WASM)}`);
    expect(deps.URLApi.createObjectURL).toHaveBeenCalledOnce();
    expect(sent).toEqual([{ type: 'ready' }]);
  });

  it('supports explicit newgame and readiness probes after startup', () => {
    const { deps, sent } = runtimeHarness();
    const runtime = createStockfishWorkerRuntime((msg) => sent.push(msg), deps);

    runtime.init();
    const worker = MockEngineWorker.instances[0];
    worker.emitLine('readyok');

    runtime.handleCommand({ cmd: 'newgame' });
    runtime.handleCommand({ cmd: 'ready', requestId: 42 });
    worker.emitLine('readyok');

    expect(worker.posted).toContain('ucinewgame');
    expect(worker.posted).toContain('isready');
    expect(sent).toEqual([{ type: 'ready' }, { type: 'ready', requestId: 42 }]);
  });
});

function runtimeHarness(): { deps: StockfishWorkerRuntimeDeps; sent: object[] } {
  const sent: object[] = [];
  const deps: StockfishWorkerRuntimeDeps = {
    WorkerCtor: MockEngineWorker as unknown as typeof Worker,
    BlobCtor: Blob,
    URLApi: {
      createObjectURL: vi.fn(() => 'blob:stockfish-cdn'),
      revokeObjectURL: vi.fn(),
    },
    setTimeout: (handler, timeout) => window.setTimeout(handler, timeout),
    clearTimeout: (id) => window.clearTimeout(id),
    console: { warn: vi.fn() },
    localEngine: LOCAL_ENGINE,
    cdnEngine: CDN_ENGINE,
    cdnWasm: CDN_WASM,
    readyFallbackMs: READY_FALLBACK_MS,
  };

  return { deps, sent };
}
