import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCAL_ENGINE,
  LOCAL_NO_SIMD_ENGINE,
  LOCAL_NO_SIMD_WASM,
  LOCAL_WASM,
  STOCKFISH_ENGINE_ASSETS,
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports UCI readiness only after readyok', async () => {
    const { deps, sent } = runtimeHarness();
    const runtime = createStockfishWorkerRuntime((msg) => sent.push(msg), deps);

    runtime.init();
    await flushWorkerStart();
    MockEngineWorker.instances[0].emitLine('readyok');

    expect(sent.some((message) => (message as { type?: string }).type === 'ready')).toBe(true);
    expect(
      sent.some(
        (message) =>
          (message as { type?: string; phase?: string }).type === 'boot_event' &&
          (message as { phase?: string }).phase === 'readyok_received'
      )
    ).toBe(true);
  });

  it('falls back from the SIMD worker to the local no-SIMD worker with explicit wasm URLs', async () => {
    const { deps, sent } = runtimeHarness();
    const runtime = createStockfishWorkerRuntime((msg) => sent.push(msg), deps);

    runtime.init();
    await flushWorkerStart();
    const localWorker = MockEngineWorker.instances[0];
    localWorker.emitError('local 404');
    await flushWorkerStart();
    const cdnWorker = MockEngineWorker.instances[1];
    cdnWorker.emitLine('readyok');

    expect(localWorker.url).toBe(`${LOCAL_ENGINE}#${encodeURIComponent(LOCAL_WASM)}`);
    expect(localWorker.terminate).toHaveBeenCalledOnce();
    expect(cdnWorker.url).toBe(`${LOCAL_NO_SIMD_ENGINE}#${encodeURIComponent(LOCAL_NO_SIMD_WASM)}`);
    expect(sent.some((message) => (message as { type?: string }).type === 'ready')).toBe(true);
  });

  it('supports explicit newgame and readiness probes after startup', async () => {
    const { deps, sent } = runtimeHarness();
    const runtime = createStockfishWorkerRuntime((msg) => sent.push(msg), deps);

    runtime.init();
    await flushWorkerStart();
    const worker = MockEngineWorker.instances[0];
    worker.emitLine('readyok');

    runtime.handleCommand({ cmd: 'newgame' });
    runtime.handleCommand({ cmd: 'ready', requestId: 42 });
    worker.emitLine('readyok');

    expect(worker.posted).toContain('ucinewgame');
    expect(worker.posted).toContain('isready');
    expect(sent.filter((message) => (message as { type?: string }).type === 'ready')).toEqual([
      { type: 'ready' },
      { type: 'ready', requestId: 42 },
    ]);
  });
});

function runtimeHarness(): { deps: StockfishWorkerRuntimeDeps; sent: object[] } {
  const sent: object[] = [];
  const deps: StockfishWorkerRuntimeDeps = {
    WorkerCtor: MockEngineWorker as unknown as typeof Worker,
    console: { warn: vi.fn() },
    engineAssets: STOCKFISH_ENGINE_ASSETS,
    fetch: vi.fn(async () => new Response(new ArrayBuffer(8), { headers: { 'content-type': 'application/wasm' } })) as unknown as typeof fetch,
    now: vi.fn(() => 0),
  };

  return { deps, sent };
}

async function flushWorkerStart(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
