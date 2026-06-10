import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockWorker extends EventTarget {
  static instances: MockWorker[] = [];
  static searchCrashesRemaining = 0;

  readonly posted: unknown[] = [];
  readonly terminate = vi.fn(() => {
    this.terminated = true;
    this.posted.push('terminate');
  });
  private terminated = false;

  constructor(readonly url: string) {
    super();
    MockWorker.instances.push(this);
    queueMicrotask(() => {
      if (!this.terminated) this.emitMessage({ type: 'worker_booted' });
    });
  }

  postMessage(message: unknown): void {
    this.posted.push(message);

    if (!message || typeof message !== 'object') return;
    const command = message as { cmd?: string; requestId?: number };

    if (command.cmd === 'init') {
      queueMicrotask(() => {
        if (this.terminated) return;
        this.emitMessage({ type: 'boot_event', phase: 'stockfish_script_loading' });
        this.emitMessage({
          type: 'boot_event',
          phase: 'stockfish_script_loaded',
          wasm_reached: true,
          wasm_content_type: 'application/wasm',
        });
        this.emitMessage({ type: 'boot_event', phase: 'uci_sent' });
        this.emitMessage({ type: 'boot_event', phase: 'uciok_received', uciok_seen: true });
        this.emitMessage({ type: 'boot_event', phase: 'isready_sent' });
        this.emitMessage({ type: 'boot_event', phase: 'readyok_received', readyok_seen: true });
        this.emitMessage({ type: 'boot_event', phase: 'stockfish_runtime_ready' });
        this.emitMessage({ type: 'ready' });
      });
      return;
    }

    if (command.cmd === 'ready') {
      queueMicrotask(() => {
        if (!this.terminated) this.emitMessage({ type: 'ready', requestId: command.requestId });
      });
      return;
    }

    if (command.cmd === 'go') {
      queueMicrotask(() => {
        if (this.terminated) return;

        if (MockWorker.searchCrashesRemaining > 0) {
          MockWorker.searchCrashesRemaining -= 1;
          this.emitError('search crash');
          return;
        }

        this.emitMessage({
          type: 'info',
          requestId: command.requestId,
          cp: 20,
          mate: null,
          multipv: 1,
          pv: ['e2e4', 'e7e5'],
        });
        this.emitMessage({ type: 'bestmove', requestId: command.requestId, move: 'e2e4' });
      });
    }
  }

  emitMessage(message: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: message }));
  }

  emitError(message: string): void {
    this.dispatchEvent(new ErrorEvent('error', { message }));
  }
}

const LEGAL_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('stockfishBridge lifecycle', () => {
  beforeEach(() => {
    MockWorker.instances = [];
    MockWorker.searchCrashesRemaining = 0;
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('boots deterministically through the worker init lifecycle', async () => {
    const { waitForEngine, getStockfishEngineState, getStockfishDiagnostics } = await import('./stockfishBridge');

    await waitForEngine(1000);

    expect(MockWorker.instances).toHaveLength(1);
    expect(MockWorker.instances[0].posted).toContainEqual({ cmd: 'init' });
    expect(getStockfishEngineState()).toBe('ready');
    expect(getStockfishDiagnostics().bootFlags).toMatchObject({
      worker_booted_seen: true,
      stockfish_script_loaded_seen: true,
      uciok_seen: true,
      readyok_seen: true,
    });
  });

  it('runs search through newgame, ready, and go commands', async () => {
    const { getCandidateMoves, evaluatePosition } = await import('./stockfishBridge');

    const candidates = await getCandidateMoves(LEGAL_START_FEN, 3, 8, 1000);
    const evaluation = await evaluatePosition(LEGAL_START_FEN, 8, 1000);
    const postedCommands = MockWorker.instances[0].posted.map((message) =>
      message && typeof message === 'object' ? (message as { cmd?: string }).cmd : null
    );

    expect(candidates[0]).toMatchObject({ move: 'e2e4', cp: 20, multipv: 1 });
    expect(evaluation).toEqual({ cp: 20, mate: null });
    expect(postedCommands).toContain('newgame');
    expect(postedCommands).toContain('ready');
    expect(postedCommands).toContain('go');
  });

  it('restarts once with a fresh worker after a retryable search crash', async () => {
    MockWorker.searchCrashesRemaining = 1;
    const { getBestMove, getStockfishEngineState } = await import('./stockfishBridge');

    const move = await getBestMove(LEGAL_START_FEN, 8, 1000);

    expect(move).toBe('e2e4');
    expect(MockWorker.instances).toHaveLength(2);
    expect(MockWorker.instances[0].terminate).toHaveBeenCalled();
    expect(getStockfishEngineState()).toBe('ready');
  });

  it('serializes duplicate searches instead of running them concurrently', async () => {
    const { getBestMove } = await import('./stockfishBridge');

    const [first, second] = await Promise.all([
      getBestMove(LEGAL_START_FEN, 8, 1000),
      getBestMove(LEGAL_START_FEN, 8, 1000),
    ]);

    const goCommands = MockWorker.instances[0].posted.filter(
      (message) => message && typeof message === 'object' && (message as { cmd?: string }).cmd === 'go'
    );

    expect(first).toBe('e2e4');
    expect(second).toBe('e2e4');
    expect(goCommands).toHaveLength(2);
  });

  it('runs an isolated Stockfish health check', async () => {
    const { runStockfishHealthCheck } = await import('./stockfishBridge');

    const result = await runStockfishHealthCheck(1000);

    expect(result).toMatchObject({
      ok: true,
      bestMove: 'e2e4',
      evaluation: { cp: 20, mate: null },
      state: 'ready',
    });
  });
});
