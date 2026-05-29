import { afterEach, describe, expect, it, vi } from 'vitest';

class SilentWorker extends EventTarget {
  postMessage = vi.fn();
  terminate = vi.fn();
}

class ErroringWorker extends EventTarget {
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    super();
    window.setTimeout(() => {
      this.dispatchEvent(new ErrorEvent('error', { message: 'worker exploded' }));
    }, 0);
  }
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

  it('rejects readiness immediately with the worker load error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', ErroringWorker);
    const { waitForEngine } = await import('./stockfishBridge');

    const readiness = expect(waitForEngine(8000)).rejects.toThrow('worker exploded');

    await vi.advanceTimersByTimeAsync(0);
    await readiness;
  });
});
