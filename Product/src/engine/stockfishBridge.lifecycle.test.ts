import { afterEach, describe, expect, it, vi } from 'vitest';

class SilentWorker extends EventTarget {
  postMessage = vi.fn();
  terminate = vi.fn();
}

describe('stockfishBridge worker readiness', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('rejects readiness when the worker never reports ready', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', SilentWorker);
    const { waitForEngine } = await import('./stockfishBridge');

    const readiness = expect(waitForEngine(50)).rejects.toThrow(
      'Stockfish worker did not become ready in time.'
    );

    await vi.advanceTimersByTimeAsync(50);
    await readiness;
  });
});
