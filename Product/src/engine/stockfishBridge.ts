import { Chess } from 'chess.js';

interface EngineMessage {
  type?: 'ready' | 'error' | 'bestmove' | 'info';
  requestId?: number | null;
  move?: string | null;
  cp?: number | null;
  mate?: number | null;
  multipv?: number;
  pv?: string[];
  message?: string;
}

interface WorkerCommand {
  cmd: 'init' | 'go' | 'stop' | 'setoption' | 'ready' | 'newgame';
  requestId?: number;
  fen?: string;
  depth?: number;
  multipv?: number;
  name?: string;
  value?: EngineOptionValue;
}

interface Evaluation {
  cp: number | null;
  mate: number | null;
}

export interface EngineCandidate {
  move: string;
  cp: number | null;
  mate: number | null;
  multipv: number;
  pv: string[];
}

export type StockfishEngineState =
  | 'idle'
  | 'booting'
  | 'ready'
  | 'searching'
  | 'restarting'
  | 'crashed'
  | 'terminated';

type EngineOptionValue = string | number | boolean;
type SearchMode = 'bestmove' | 'candidates' | 'evaluation';

type ReadyWaiter = {
  label: string;
  requestId: number;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: number;
};

type SearchSession = {
  mode: SearchMode;
  requestId: number;
  candidates: Map<number, EngineCandidate>;
  latestEvaluation: Evaluation;
  resolve: (value: SearchResult) => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

type SearchResult = {
  bestmove: string | null;
  candidates: EngineCandidate[];
  latestEvaluation: Evaluation;
};

type QueueTask<T> = {
  label: string;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

export type StockfishStateListener = (
  state: StockfishEngineState,
  failure: StockfishEngineError | null
) => void;

const DEFAULT_WORKER_URL = new URL('./stockfish.worker.ts', import.meta.url);
const DEFAULT_READY_TIMEOUT_MS = 8000;
const DEFAULT_SEARCH_READY_TIMEOUT_MS = 6000;
const DEFAULT_SEARCH_TIMEOUT_MS = 15000;
const DEFAULT_HEALTHCHECK_DEPTH = 8;

export class StockfishEngineError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details: string | null;

  constructor(code: string, message: string, details: string | null = null, retryable = true) {
    super(message);
    this.name = 'StockfishEngineError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }
}

export interface StockfishHealthCheckResult {
  ok: boolean;
  bestMove: string | null;
  evaluation: Evaluation;
  state: StockfishEngineState;
  error?: {
    code: string;
    message: string;
    details: string | null;
  };
}

class StockfishEngineController {
  private worker: Worker | null = null;
  private state: StockfishEngineState = 'idle';
  private bootPromise: Promise<void> | null = null;
  private bootResolve: (() => void) | null = null;
  private bootReject: ((error: Error) => void) | null = null;
  private bootTimer: number | null = null;
  private readyWaiter: ReadyWaiter | null = null;
  private activeSearch: SearchSession | null = null;
  private lastFailure: StockfishEngineError | null = null;
  private queue: QueueTask<unknown>[] = [];
  private processingQueue = false;
  private disposed = false;
  private requestSeq = 0;
  private readonly listeners = new Set<StockfishStateListener>();

  async ensureReady(timeoutMs = DEFAULT_READY_TIMEOUT_MS): Promise<void> {
    if (this.disposed) {
      throw new StockfishEngineError(
        'ENGINE_UNAVAILABLE',
        'Stockfish engine manager has been terminated.',
        'The shared engine was disposed before readiness was requested.',
        false
      );
    }

    if (this.state === 'ready' && this.worker) return;

    if (!this.bootPromise) {
      this.bootPromise = this.bootWorker(timeoutMs);
    }

    await this.bootPromise;
  }

  getState(): StockfishEngineState {
    return this.state;
  }

  getLastFailure(): StockfishEngineError | null {
    return this.lastFailure;
  }

  subscribe(listener: StockfishStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async getBestMove(fen: string, depth = 10, timeoutMs = DEFAULT_SEARCH_TIMEOUT_MS): Promise<string | null> {
    const result = await this.enqueue('bestmove', () => this.runSearch('bestmove', fen, depth, 1, timeoutMs));
    return result.bestmove;
  }

  async getCandidateMoves(
    fen: string,
    multipv = 4,
    depth = 8,
    timeoutMs = DEFAULT_SEARCH_TIMEOUT_MS
  ): Promise<EngineCandidate[]> {
    const result = await this.enqueue('candidates', () => this.runSearch('candidates', fen, depth, multipv, timeoutMs));
    return result.candidates;
  }

  async evaluatePosition(fen: string, depth = 14, timeoutMs = DEFAULT_SEARCH_TIMEOUT_MS): Promise<Evaluation> {
    const result = await this.enqueue('evaluation', () => this.runSearch('evaluation', fen, depth, 1, timeoutMs));
    return result.latestEvaluation;
  }

  async setOption(name: string, value: EngineOptionValue): Promise<void> {
    await this.enqueue('setoption', async () => {
      await this.ensureReady();
      this.postToWorker({ cmd: 'setoption', name, value });
      await this.waitForReadySignal('setoption', DEFAULT_SEARCH_READY_TIMEOUT_MS);
    });
  }

  stopThinking(): void {
    if (!this.worker) return;

    const requestId = this.activeSearch?.requestId;
    try {
      this.postToWorker({ cmd: 'stop', requestId });
    } catch {
      // A failed stop is harmless because cancelled searches are settled below.
    }

    if (this.activeSearch) {
      this.failActiveSearch(
        new StockfishEngineError('ENGINE_CANCELLED', 'Stockfish search was cancelled.', null, false),
        false
      );
    }
  }

  async healthCheck(timeoutMs = DEFAULT_SEARCH_TIMEOUT_MS): Promise<StockfishHealthCheckResult> {
    try {
      const fen = new Chess().fen();
      const bestMove = await this.getBestMove(fen, DEFAULT_HEALTHCHECK_DEPTH, timeoutMs);
      const evaluation = await this.evaluatePosition(fen, DEFAULT_HEALTHCHECK_DEPTH, timeoutMs);
      return {
        ok: Boolean(bestMove && (evaluation.cp !== null || evaluation.mate !== null)),
        bestMove,
        evaluation,
        state: this.getState(),
      };
    } catch (error) {
      const failure = this.normalizeError(error);
      return {
        ok: false,
        bestMove: null,
        evaluation: { cp: null, mate: null },
        state: this.getState(),
        error: {
          code: failure.code,
          message: failure.message,
          details: failure.details,
        },
      };
    }
  }

  dispose(): void {
    this.disposed = true;
    this.failBoot(new StockfishEngineError('ENGINE_UNAVAILABLE', 'Stockfish engine manager disposed.', null, false));
    this.failReadyWaiter(new StockfishEngineError('ENGINE_UNAVAILABLE', 'Stockfish engine manager disposed.', null, false));
    this.failActiveSearch(new StockfishEngineError('ENGINE_UNAVAILABLE', 'Stockfish engine manager disposed.', null, false));
    this.queue.splice(0).forEach((task) => {
      task.reject(new StockfishEngineError('ENGINE_UNAVAILABLE', 'Stockfish engine manager disposed.', null, false));
    });
    this.cleanupWorker();
    this.setState('terminated');
  }

  private enqueue<T>(label: string, run: () => Promise<T>): Promise<T> {
    if (this.disposed) {
      return Promise.reject(new StockfishEngineError('ENGINE_UNAVAILABLE', 'Stockfish engine manager disposed.', null, false));
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        label,
        run: run as () => Promise<unknown>,
        resolve: (value) => resolve(value as T),
        reject,
      });
      void this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;

    try {
      while (this.queue.length > 0) {
        const task = this.queue[0];
        try {
          const result = await this.runWithRetry(task.label, task.run);
          this.queue.shift();
          task.resolve(result);
        } catch (error) {
          this.queue.shift();
          task.reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  private async runWithRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let lastError: StockfishEngineError | null = null;

    while (attempt < 2) {
      try {
        return await run();
      } catch (error) {
        const normalized = this.normalizeError(error);
        lastError = normalized;

        if (attempt === 0 && normalized.retryable) {
          console.warn(`[stockfish] retrying ${label} after ${normalized.code}: ${normalized.message}`);
          await this.restartWorker(normalized.message);
          attempt += 1;
          continue;
        }

        if (!normalized.retryable) {
          this.lastFailure = normalized;
          throw normalized;
        }

        const failure = new StockfishEngineError(
          'ENGINE_RETRY_FAILED',
          `Stockfish failed after retry while running ${label}.`,
          `${normalized.code}: ${normalized.message}${normalized.details ? `\n${normalized.details}` : ''}`,
          false
        );
        this.lastFailure = failure;
        throw failure;
      }
    }

    const fallback = lastError ?? new StockfishEngineError('ENGINE_UNAVAILABLE', 'Unknown Stockfish failure.');
    const failure = new StockfishEngineError(
      'ENGINE_RETRY_FAILED',
      `Stockfish failed after retry while running ${label}.`,
      `${fallback.code}: ${fallback.message}${fallback.details ? `\n${fallback.details}` : ''}`,
      false
    );
    this.lastFailure = failure;
    throw failure;
  }

  private async bootWorker(timeoutMs: number): Promise<void> {
    this.clearBootTimer();
    this.lastFailure = null;
    this.setState('booting');

    const worker = this.createWorker();
    this.worker = worker;

    return new Promise<void>((resolve, reject) => {
      this.bootResolve = resolve;
      this.bootReject = reject;
      this.bootTimer = window.setTimeout(() => {
        this.failBoot(
          new StockfishEngineError(
            'ENGINE_BOOT_TIMEOUT',
            `Stockfish worker did not become ready in time after ${timeoutMs}ms.`,
            'The worker did not report ready after UCI startup.',
            true
          )
        );
      }, timeoutMs);

      try {
        this.postToWorker({ cmd: 'init' });
      } catch (error) {
        this.failBoot(
          new StockfishEngineError(
            'ENGINE_BOOT_FAILED',
            'Stockfish worker could not accept the init command.',
            this.formatError(error),
            true
          )
        );
      }
    });
  }

  private createWorker(): Worker {
    const worker = new Worker(DEFAULT_WORKER_URL, { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<EngineMessage>) => {
      this.handleMessage(event.data);
    });
    worker.addEventListener('error', (event) => {
      this.handleWorkerFailure(
        new StockfishEngineError(
          this.state === 'booting' ? 'ENGINE_BOOT_FAILED' : 'ENGINE_CRASHED',
          event.message || 'Stockfish worker crashed.',
          event.message || null,
          true
        )
      );
    });
    worker.addEventListener('messageerror', () => {
      this.handleWorkerFailure(
        new StockfishEngineError('ENGINE_CRASHED', 'Stockfish worker posted an unreadable message.', null, true)
      );
    });
    return worker;
  }

  private handleMessage(message: EngineMessage): void {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'ready') {
      if (typeof message.requestId === 'number' && this.readyWaiter?.requestId === message.requestId) {
        this.resolveReadyWaiter();
        return;
      }

      if (this.bootPromise) {
        this.resolveBoot();
      }
      return;
    }

    if (message.type === 'error') {
      this.handleWorkerFailure(
        new StockfishEngineError(
          this.state === 'booting' ? 'ENGINE_BOOT_FAILED' : 'ENGINE_CRASHED',
          message.message || 'Stockfish worker reported an error.',
          message.message || null,
          true
        )
      );
      return;
    }

    if (!this.activeSearch || message.requestId !== this.activeSearch.requestId) return;

    if (message.type === 'info') {
      this.recordInfo(message);
      return;
    }

    if (message.type === 'bestmove') {
      this.finishSearchSuccess(message);
    }
  }

  private recordInfo(message: EngineMessage): void {
    if (!this.activeSearch) return;

    const candidateMove = message.pv?.[0] ?? null;
    if (candidateMove) {
      const multipv = message.multipv ?? 1;
      this.activeSearch.candidates.set(multipv, {
        move: candidateMove,
        cp: message.cp ?? null,
        mate: message.mate ?? null,
        multipv,
        pv: message.pv ?? [candidateMove],
      });
    }

    this.activeSearch.latestEvaluation = {
      cp: message.cp ?? this.activeSearch.latestEvaluation.cp,
      mate: message.mate ?? this.activeSearch.latestEvaluation.mate,
    };
  }

  private resolveBoot(): void {
    if (!this.bootResolve) return;

    const resolve = this.bootResolve;
    this.clearBootTimer();
    this.bootPromise = null;
    this.bootResolve = null;
    this.bootReject = null;
    this.setState('ready');
    resolve();
  }

  private failBoot(error: StockfishEngineError): void {
    const reject = this.bootReject;
    this.lastFailure = error;
    this.clearBootTimer();
    this.bootPromise = null;
    this.bootResolve = null;
    this.bootReject = null;
    this.cleanupWorker();
    this.setState('crashed');
    reject?.(error);
  }

  private handleWorkerFailure(error: StockfishEngineError): void {
    this.lastFailure = error;

    if (this.bootPromise) {
      this.failBoot(error);
      return;
    }

    this.failReadyWaiter(error);
    this.failActiveSearch(error);
    this.cleanupWorker();
    this.setState('crashed');
  }

  private finishSearchSuccess(message: EngineMessage): void {
    const activeSearch = this.activeSearch;
    if (!activeSearch) return;

    this.activeSearch = null;
    window.clearTimeout(activeSearch.timeoutId);

    const bestmove = message.move && message.move !== '(none)' ? message.move : null;
    const candidates = Array.from(activeSearch.candidates.values()).sort((a, b) => a.multipv - b.multipv);

    if (candidates.length === 0 && bestmove) {
      candidates.push({
        move: bestmove,
        cp: null,
        mate: null,
        multipv: 1,
        pv: [bestmove],
      });
    }

    this.setState('ready');
    activeSearch.resolve({
      bestmove,
      candidates,
      latestEvaluation: activeSearch.latestEvaluation,
    });
  }

  private failReadyWaiter(error: StockfishEngineError): void {
    if (!this.readyWaiter) return;

    const waiter = this.readyWaiter;
    this.readyWaiter = null;
    window.clearTimeout(waiter.timer);
    waiter.reject(error);
  }

  private failActiveSearch(error: StockfishEngineError, crashWorker = true): void {
    if (!this.activeSearch) return;

    const activeSearch = this.activeSearch;
    this.activeSearch = null;
    window.clearTimeout(activeSearch.timeoutId);
    activeSearch.reject(error);

    if (crashWorker) {
      this.cleanupWorker();
      this.setState('crashed');
    } else {
      this.setState(this.worker ? 'ready' : 'idle');
    }
  }

  private async restartWorker(reason: string): Promise<void> {
    console.warn(`[stockfish] restarting worker after failure: ${reason}`);
    this.cleanupWorker();
    this.failReadyWaiter(new StockfishEngineError('ENGINE_CRASHED', reason, reason, true));
    this.setState('restarting');
    this.bootPromise = null;
    this.bootResolve = null;
    this.bootReject = null;
    await this.ensureReady();
  }

  private cleanupWorker(): void {
    this.clearBootTimer();

    if (!this.worker) return;

    try {
      this.worker.terminate();
    } catch {
      // Ignore termination errors. A fresh worker is created when needed.
    }
    this.worker = null;
  }

  private async prepareSearch(timeoutMs: number): Promise<void> {
    this.postToWorker({ cmd: 'newgame' });
    await this.waitForReadySignal('new game readiness', Math.min(timeoutMs, DEFAULT_SEARCH_READY_TIMEOUT_MS));
  }

  private async runSearch(
    mode: SearchMode,
    fen: string,
    depth: number,
    multipv: number,
    timeoutMs: number
  ): Promise<SearchResult> {
    await this.ensureReady();
    await this.prepareSearch(timeoutMs);

    const requestId = this.nextRequestId();
    const timeoutId = window.setTimeout(() => {
      const failure = new StockfishEngineError(
        'ENGINE_TIMEOUT',
        `Stockfish search timed out after ${timeoutMs}ms.`,
        `mode=${mode}; depth=${depth}; multipv=${multipv}; fen=${fen}`,
        true
      );

      try {
        this.postToWorker({ cmd: 'stop', requestId });
      } catch {
        // The active search is failed and retried below, so stop failures can be ignored.
      }

      this.failActiveSearch(failure);
    }, timeoutMs);

    return new Promise<SearchResult>((resolve, reject) => {
      this.activeSearch = {
        mode,
        requestId,
        candidates: new Map<number, EngineCandidate>(),
        latestEvaluation: { cp: null, mate: null },
        timeoutId,
        resolve,
        reject,
      };
      this.setState('searching');

      try {
        this.postToWorker({
          cmd: 'go',
          fen,
          depth: clampDepth(depth),
          multipv: mode === 'candidates' ? clampMultipv(multipv) : 1,
          requestId,
        });
      } catch (error) {
        this.failActiveSearch(
          new StockfishEngineError('ENGINE_UNAVAILABLE', 'Stockfish worker rejected the search request.', this.formatError(error), true)
        );
      }
    });
  }

  private async waitForReadySignal(label: string, timeoutMs: number): Promise<void> {
    if (this.readyWaiter) {
      throw new StockfishEngineError(
        'ENGINE_UNAVAILABLE',
        `Stockfish is already waiting for ${this.readyWaiter.label}.`,
        label,
        true
      );
    }

    const requestId = this.nextRequestId();
    return new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.readyWaiter = null;
        reject(
          new StockfishEngineError(
            'ENGINE_TIMEOUT',
            `Stockfish did not report readyok while waiting for ${label}.`,
            `label=${label}; timeoutMs=${timeoutMs}`,
            true
          )
        );
      }, timeoutMs);

      this.readyWaiter = {
        label,
        requestId,
        timer,
        resolve,
        reject,
      };

      try {
        this.postToWorker({ cmd: 'ready', requestId });
      } catch (error) {
        this.readyWaiter = null;
        window.clearTimeout(timer);
        reject(
          new StockfishEngineError(
            'ENGINE_UNAVAILABLE',
            'Stockfish worker rejected the readiness request.',
            this.formatError(error),
            true
          )
        );
      }
    });
  }

  private resolveReadyWaiter(): void {
    if (!this.readyWaiter) return;

    const waiter = this.readyWaiter;
    this.readyWaiter = null;
    window.clearTimeout(waiter.timer);
    waiter.resolve();
  }

  private postToWorker(command: WorkerCommand): void {
    if (!this.worker) {
      throw new StockfishEngineError('ENGINE_UNAVAILABLE', 'Stockfish worker has not been created yet.', null, true);
    }

    this.worker.postMessage(command);
  }

  private clearBootTimer(): void {
    if (this.bootTimer === null) return;
    window.clearTimeout(this.bootTimer);
    this.bootTimer = null;
  }

  private nextRequestId(): number {
    this.requestSeq += 1;
    return this.requestSeq;
  }

  private normalizeError(error: unknown): StockfishEngineError {
    if (error instanceof StockfishEngineError) return error;
    if (error instanceof Error) {
      return new StockfishEngineError('ENGINE_UNAVAILABLE', error.message, error.message, true);
    }
    return new StockfishEngineError('ENGINE_UNAVAILABLE', String(error), String(error), true);
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private setState(state: StockfishEngineState): void {
    if (this.state === state) return;
    this.state = state;
    this.listeners.forEach((listener) => listener(this.state, this.lastFailure));
  }
}

function clampDepth(value: number): number {
  return Math.max(1, Math.round(Number.isFinite(value) ? value : 10));
}

function clampMultipv(value: number): number {
  return Math.max(1, Math.min(8, Math.round(Number.isFinite(value) ? value : 1)));
}

const controller = new StockfishEngineController();

export function waitForEngine(timeoutMs = DEFAULT_READY_TIMEOUT_MS): Promise<void> {
  return controller.ensureReady(timeoutMs);
}

export function subscribeStockfishEngineState(listener: StockfishStateListener): () => void {
  return controller.subscribe(listener);
}

export async function getBestMove(fen: string, depth = 10, timeoutMs = DEFAULT_SEARCH_TIMEOUT_MS): Promise<string | null> {
  return controller.getBestMove(fen, depth, timeoutMs);
}

export async function getCandidateMoves(
  fen: string,
  multipv = 4,
  depth = 8,
  timeoutMs = DEFAULT_SEARCH_TIMEOUT_MS
): Promise<EngineCandidate[]> {
  return controller.getCandidateMoves(fen, multipv, depth, timeoutMs);
}

export async function evaluatePosition(
  fen: string,
  depth = 14,
  timeoutMs = DEFAULT_SEARCH_TIMEOUT_MS
): Promise<Evaluation> {
  return controller.evaluatePosition(fen, depth, timeoutMs);
}

export async function setOption(name: string, value: EngineOptionValue): Promise<void> {
  return controller.setOption(name, value);
}

export function stopThinking(): void {
  controller.stopThinking();
}

export function getStockfishEngineState(): StockfishEngineState {
  return controller.getState();
}

export function getStockfishEngineFailure(): StockfishEngineError | null {
  return controller.getLastFailure();
}

export async function runStockfishHealthCheck(timeoutMs = DEFAULT_SEARCH_TIMEOUT_MS): Promise<StockfishHealthCheckResult> {
  const freshController = new StockfishEngineController();
  try {
    return await freshController.healthCheck(timeoutMs);
  } finally {
    freshController.dispose();
  }
}
