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
      this.dispatchEvent(new ErrorEvent('error', { message: 'calibration worker exploded' }));
    }, 0);
  }
}

describe('calibrationOpponent lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('rejects init immediately when the worker fails before ready', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', ErroringWorker);
    const { init } = await import('./calibrationOpponent');

    const readiness = expect(init()).rejects.toThrow('calibration worker exploded');

    await vi.advanceTimersByTimeAsync(0);
    await readiness;
  });

  it('rejects pending init when disposed before ready', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', SilentWorker);
    const { dispose, init } = await import('./calibrationOpponent');

    const readiness = expect(init()).rejects.toThrow(
      'Calibration Stockfish disposed before it became ready.'
    );

    dispose();
    await readiness;
  });
});
