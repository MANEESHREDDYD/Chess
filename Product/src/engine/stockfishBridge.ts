import { Chess } from 'chess.js';
import {
  STOCKFISH_BOOT_TIMEOUT_CODES,
  STOCKFISH_BOOT_TIMEOUTS_MS,
  type StockfishBootEvent,
  type StockfishBootFlags,
  type StockfishBootPhase,
  type StockfishEnvironment,
} from './stockfishTelemetry';
import stockfishWorkerUrl from './stockfish.worker.ts?worker&url';

interface EngineMessage {
  type?: 'ready' | 'error' | 'bestmove' | 'info' | 'worker_booted' | 'boot_event';
  requestId?: number | null;
  request_id?: number | null;
  move?: string | null;
  cp?: number | null;
  mate?: number | null;
  multipv?: number;
  pv?: string[];
  message?: string;
  phase?: StockfishBootPhase;
  elapsed_ms?: number;
  timestamp?: string;
  worker_url?: string;
  worker_source_kind?: string;
  environment?: StockfishEnvironment;
  user_agent?: string;
  raw?: string;
  wasm_path?: string;
  wasm_reached?: boolean;
  wasm_content_type?: string | null;
  uciok_seen?: boolean;
  readyok_seen?: boolean;
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

const DEFAULT_WORKER_URL = stockfishWorkerUrl;
const DEFAULT_READY_TIMEOUT_MS =
  STOCKFISH_BOOT_TIMEOUTS_MS.worker_booted +
  STOCKFISH_BOOT_TIMEOUTS_MS.stockfish_script_loaded +
  STOCKFISH_BOOT_TIMEOUTS_MS.uciok_received +
  STOCKFISH_BOOT_TIMEOUTS_MS.readyok_received;
const DEFAULT_SEARCH_READY_TIMEOUT_MS = 6000;
const DEFAULT_SEARCH_TIMEOUT_MS = 15000;
const DEFAULT_HEALTHCHECK_DEPTH = 8;
const MAX_DIAGNOSTIC_EVENTS = 80;
const MAX_RAW_WORKER_MESSAGES = 40;

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
  diagnostics?: StockfishDiagnosticsSnapshot;
  error?: {
    code: string;
    message: string;
    details: string | null;
  };
}

export interface StockfishDiagnosticsSnapshot {
  state: StockfishEngineState;
  lastFailure: {
    code: string;
    message: string;
    details: string | null;
  } | null;
  environment: StockfishEnvironment;
  userAgent: string;
  workerUrl: string;
  workerSourceKind: string;
  bootStartedAt: string | null;
  bootElapsedMs: number | null;
  bootFlags: StockfishBootFlags;
  bootTimeline: StockfishBootEvent[];
  rawWorkerMessages: string[];
}

class StockfishEngineController {
  private worker: Worker | null = null;
  private state: StockfishEngineState = 'idle';
  private bootPromise: Promise<void> | null = null;
  private bootResolve: (() => void) | null = null;
  private bootReject: ((error: Error) => void) | null = null;
  private bootTimer: number | null = null;
  private bootStartedAtMs: number | null = null;
  private bootStartedAtIso: string | null = null;
  private expectedBootPhase: keyof typeof STOCKFISH_BOOT_TIMEOUTS_MS | null = null;
  private workerUrl = DEFAULT_WORKER_URL;
  private workerSourceKind = 'vite-module-worker';
  private bootFlags: StockfishBootFlags = createEmptyBootFlags();
  private bootTimeline: StockfishBootEvent[] = [];
  private rawWorkerMessages: string[] = [];
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

  getDiagnostics(): StockfishDiagnosticsSnapshot {
    return {
      state: this.state,
      lastFailure: this.lastFailure
        ? {
            code: this.lastFailure.code,
            message: this.lastFailure.message,
            details: this.lastFailure.details,
          }
        : null,
      environment: getStockfishEnvironment(),
      userAgent: getUserAgent(),
      workerUrl: this.workerUrl,
      workerSourceKind: this.workerSourceKind,
      bootStartedAt: this.bootStartedAtIso,
      bootElapsedMs: this.bootStartedAtMs === null ? null : Math.round(performance.now() - this.bootStartedAtMs),
      bootFlags: { ...this.bootFlags },
      bootTimeline: [...this.bootTimeline],
      rawWorkerMessages: [...this.rawWorkerMessages],
    };
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
        diagnostics: this.getDiagnostics(),
      };
    } catch (error) {
      const failure = this.normalizeError(error);
      return {
        ok: false,
        bestMove: null,
        evaluation: { cp: null, mate: null },
        state: this.getState(),
        diagnostics: this.getDiagnostics(),
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
    this.startBootDiagnostics();
    this.setState('booting');

    let worker: Worker;
    try {
      worker = this.createWorker();
    } catch (error) {
      const failure = new StockfishEngineError(
        'WORKER_CONSTRUCTOR_FAILED',
        'Stockfish worker could not be constructed.',
        this.buildFailureDetails('worker_constructing', this.formatError(error)),
        true
      );
      this.recordBootEvent('boot_failed', { message: failure.message });
      this.failBoot(failure);
      throw failure;
    }
    this.worker = worker;
    this.armBootPhaseTimeout('worker_booted', Math.min(timeoutMs, STOCKFISH_BOOT_TIMEOUTS_MS.worker_booted));

    return new Promise<void>((resolve, reject) => {
      this.bootResolve = resolve;
      this.bootReject = reject;

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
    this.recordBootEvent('worker_constructing', {
      worker_url: this.workerUrl,
      worker_source_kind: this.workerSourceKind,
    });
    const worker = new Worker(DEFAULT_WORKER_URL, { type: 'module' });
    this.recordBootEvent('worker_constructed', {
      worker_url: this.workerUrl,
      worker_source_kind: this.workerSourceKind,
    });
    worker.addEventListener('message', (event: MessageEvent<EngineMessage>) => {
      this.handleMessage(event.data);
    });
    worker.addEventListener('error', (event) => {
      this.handleWorkerFailure(
        new StockfishEngineError(
          this.state === 'booting' ? 'ENGINE_BOOT_FAILED' : 'ENGINE_CRASHED',
          event.message || 'Stockfish worker crashed.',
          this.buildFailureDetails(this.expectedBootPhase ?? 'boot_failed', event.message || null),
          true
        )
      );
    });
    worker.addEventListener('messageerror', () => {
      this.handleWorkerFailure(
        new StockfishEngineError(
          'ENGINE_CRASHED',
          'Stockfish worker posted an unreadable message.',
          this.buildFailureDetails(this.expectedBootPhase ?? 'boot_failed', 'messageerror'),
          true
        )
      );
    });
    return worker;
  }

  private handleMessage(message: EngineMessage): void {
    if (!message || typeof message !== 'object') return;
    this.recordRawWorkerMessage(message);

    if (message.type === 'worker_booted') {
      this.recordBootEvent('worker_booted', {
        message: 'Outer Stockfish worker script executed.',
      });
      this.armBootPhaseTimeout('stockfish_script_loaded', STOCKFISH_BOOT_TIMEOUTS_MS.stockfish_script_loaded);
      return;
    }

    if (message.type === 'boot_event' && message.phase) {
      this.recordBootEvent(message.phase, {
        message: message.message,
        raw: message.raw,
        worker_url: message.worker_url,
        worker_source_kind: message.worker_source_kind,
        wasm_path: message.wasm_path,
        wasm_reached: message.wasm_reached,
        wasm_content_type: message.wasm_content_type,
        uciok_seen: message.uciok_seen,
        readyok_seen: message.readyok_seen,
        request_id: message.requestId ?? message.request_id ?? null,
      });
      this.updateBootDeadlineFromPhase(message.phase);
      return;
    }

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
          this.buildFailureDetails(this.expectedBootPhase ?? 'boot_failed', message.message || null),
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

  private startBootDiagnostics(): void {
    this.bootStartedAtMs = performance.now();
    this.bootStartedAtIso = new Date().toISOString();
    this.expectedBootPhase = null;
    this.bootFlags = createEmptyBootFlags();
    this.bootTimeline = [];
    this.rawWorkerMessages = [];
  }

  private recordBootEvent(phase: StockfishBootPhase, event: Partial<StockfishBootEvent> = {}): void {
    const elapsed = this.bootStartedAtMs === null ? 0 : Math.round(performance.now() - this.bootStartedAtMs);
    const bootEvent: StockfishBootEvent = {
      phase,
      elapsed_ms: typeof event.elapsed_ms === 'number' ? event.elapsed_ms : elapsed,
      timestamp: event.timestamp ?? new Date().toISOString(),
      worker_url: event.worker_url ?? this.workerUrl,
      worker_source_kind: event.worker_source_kind ?? this.workerSourceKind,
      environment: event.environment ?? getStockfishEnvironment(),
      user_agent: event.user_agent ?? getUserAgent(),
      message: event.message,
      raw: event.raw,
      wasm_path: event.wasm_path,
      wasm_reached: event.wasm_reached,
      wasm_content_type: event.wasm_content_type,
      uciok_seen: event.uciok_seen,
      readyok_seen: event.readyok_seen,
      request_id: event.request_id,
    };

    this.bootTimeline.push(bootEvent);
    if (this.bootTimeline.length > MAX_DIAGNOSTIC_EVENTS) {
      this.bootTimeline.shift();
    }

    if (phase === 'worker_booted') this.bootFlags.worker_booted_seen = true;
    if (phase === 'stockfish_script_loaded') this.bootFlags.stockfish_script_loaded_seen = true;
    if (phase === 'uciok_received') this.bootFlags.uciok_seen = true;
    if (phase === 'readyok_received') this.bootFlags.readyok_seen = true;
    if (phase === 'first_search_started') this.bootFlags.first_search_started = true;
    if (phase === 'first_bestmove_received') this.bootFlags.first_bestmove_received = true;
    if (event.wasm_reached) this.bootFlags.wasm_path_reached = true;
  }

  private recordRawWorkerMessage(message: EngineMessage): void {
    const compact = JSON.stringify({
      type: message.type,
      phase: message.phase,
      requestId: message.requestId ?? message.request_id ?? null,
      move: message.move,
      cp: message.cp,
      mate: message.mate,
      multipv: message.multipv,
      message: message.message,
      raw: message.raw,
    });
    this.rawWorkerMessages.push(compact);
    if (this.rawWorkerMessages.length > MAX_RAW_WORKER_MESSAGES) {
      this.rawWorkerMessages.shift();
    }
  }

  private updateBootDeadlineFromPhase(phase: StockfishBootPhase): void {
    if (phase === 'stockfish_script_loading') {
      this.armBootPhaseTimeout('stockfish_script_loaded', STOCKFISH_BOOT_TIMEOUTS_MS.stockfish_script_loaded);
      return;
    }

    if (phase === 'stockfish_script_loaded' || phase === 'uci_sent') {
      this.armBootPhaseTimeout('uciok_received', STOCKFISH_BOOT_TIMEOUTS_MS.uciok_received);
      return;
    }

    if (phase === 'uciok_received' || phase === 'isready_sent') {
      this.armBootPhaseTimeout('readyok_received', STOCKFISH_BOOT_TIMEOUTS_MS.readyok_received);
      return;
    }

    if (phase === 'readyok_received' || phase === 'stockfish_runtime_ready') {
      this.clearBootTimer();
      this.expectedBootPhase = null;
    }
  }

  private armBootPhaseTimeout(expectedPhase: keyof typeof STOCKFISH_BOOT_TIMEOUTS_MS, timeoutMs: number): void {
    this.clearBootTimer();
    this.expectedBootPhase = expectedPhase;
    this.bootTimer = window.setTimeout(() => {
      const code = STOCKFISH_BOOT_TIMEOUT_CODES[expectedPhase];
      const failure = new StockfishEngineError(
        code,
        stockfishPhaseTimeoutMessage(expectedPhase, timeoutMs),
        this.buildFailureDetails(expectedPhase, `Timed out waiting for ${expectedPhase}.`),
        true
      );
      this.recordBootEvent('boot_failed', {
        message: failure.message,
        uciok_seen: this.bootFlags.uciok_seen,
        readyok_seen: this.bootFlags.readyok_seen,
      });
      this.failBoot(failure);
    }, timeoutMs);
  }

  private buildFailureDetails(phase: StockfishBootPhase | keyof typeof STOCKFISH_BOOT_TIMEOUTS_MS, raw: string | null): string {
    return JSON.stringify(
      {
        phase,
        elapsed_ms: this.bootStartedAtMs === null ? null : Math.round(performance.now() - this.bootStartedAtMs),
        worker_url: this.workerUrl,
        worker_source_kind: this.workerSourceKind,
        environment: getStockfishEnvironment(),
        user_agent: getUserAgent(),
        raw_worker_error: raw,
        wasm_path_reached: this.bootFlags.wasm_path_reached,
        uciok_seen: this.bootFlags.uciok_seen,
        readyok_seen: this.bootFlags.readyok_seen,
        timeline: this.bootTimeline,
        recent_raw_worker_messages: this.rawWorkerMessages,
      },
      null,
      2
    );
  }

  private recordInfo(message: EngineMessage): void {
    if (!this.activeSearch) return;

    this.activeSearch.candidates = this.activeSearch.candidates ?? new Map<number, EngineCandidate>();

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

    if (!this.bootFlags.first_bestmove_received) {
      this.recordBootEvent('first_bestmove_received', { request_id: activeSearch.requestId });
    }

    this.activeSearch = null;
    window.clearTimeout(activeSearch.timeoutId);

    const bestmove = message.move && message.move !== '(none)' ? message.move : null;
    const candidatesMap = activeSearch.candidates ?? new Map<number, EngineCandidate>();
    const candidates = Array.from(candidatesMap.values()).sort((a, b) => a.multipv - b.multipv);

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
    const isFirstSearchForBoot = !this.bootFlags.first_search_started;
    if (isFirstSearchForBoot) {
      this.recordBootEvent('first_search_started', { request_id: requestId });
    }
    const timeoutId = window.setTimeout(() => {
      const failure = new StockfishEngineError(
        isFirstSearchForBoot ? 'FIRST_SEARCH_TIMEOUT' : 'ENGINE_TIMEOUT',
        isFirstSearchForBoot
          ? `Stockfish first search timed out after ${timeoutMs}ms.`
          : `Stockfish search timed out after ${timeoutMs}ms.`,
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

export function getStockfishDiagnostics(): StockfishDiagnosticsSnapshot {
  return controller.getDiagnostics();
}

export async function runStockfishHealthCheck(timeoutMs = DEFAULT_SEARCH_TIMEOUT_MS): Promise<StockfishHealthCheckResult> {
  const freshController = new StockfishEngineController();
  try {
    return await freshController.healthCheck(timeoutMs);
  } finally {
    freshController.dispose();
  }
}

export async function runStockfishBootDiagnostics(timeoutMs = DEFAULT_SEARCH_TIMEOUT_MS): Promise<StockfishHealthCheckResult> {
  return runStockfishHealthCheck(timeoutMs);
}

function createEmptyBootFlags(): StockfishBootFlags {
  return {
    worker_booted_seen: false,
    stockfish_script_loaded_seen: false,
    wasm_path_reached: false,
    uciok_seen: false,
    readyok_seen: false,
    first_search_started: false,
    first_bestmove_received: false,
  };
}

function stockfishPhaseTimeoutMessage(
  phase: keyof typeof STOCKFISH_BOOT_TIMEOUTS_MS,
  timeoutMs: number
): string {
  if (phase === 'worker_booted') {
    return `Stockfish worker script did not start within ${timeoutMs}ms.`;
  }
  if (phase === 'stockfish_script_loaded') {
    return `Stockfish engine asset did not load within ${timeoutMs}ms.`;
  }
  if (phase === 'uciok_received') {
    return `Stockfish did not complete the UCI handshake within ${timeoutMs}ms.`;
  }
  if (phase === 'readyok_received') {
    return `Stockfish did not report readyok within ${timeoutMs}ms.`;
  }
  return `Stockfish did not return the first best move within ${timeoutMs}ms.`;
}

function getStockfishEnvironment(): StockfishEnvironment {
  if (import.meta.env.MODE === 'test') return 'test';
  if (import.meta.env.DEV) return 'dev';
  if (typeof window !== 'undefined' && window.location.port === '4173') return 'preview';
  if (import.meta.env.PROD) return 'build';
  return 'unknown';
}

function getUserAgent(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  return navigator.userAgent || 'unknown';
}
