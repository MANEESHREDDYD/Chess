import { useMemo, useState } from 'react';
import {
  getBestMove,
  getStockfishDiagnostics,
  runStockfishBootDiagnostics,
  waitForEngine,
  type StockfishDiagnosticsSnapshot,
  type StockfishHealthCheckResult,
} from '../engine/stockfishBridge';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

type CheckState = {
  status: 'idle' | 'running' | 'passed' | 'failed';
  message: string;
  result: StockfishHealthCheckResult | { bestMove?: string | null } | null;
  diagnostics: StockfishDiagnosticsSnapshot;
};

export default function StockfishDiagnostics() {
  const [check, setCheck] = useState<CheckState>(() => ({
    status: 'idle',
    message: 'No check has run yet.',
    result: null,
    diagnostics: getStockfishDiagnostics(),
  }));

  const severity = useMemo(() => {
    if (check.status === 'passed') return '#166534';
    if (check.status === 'failed') return '#991b1b';
    return '#334155';
  }, [check.status]);

  async function runBootCheck() {
    setCheck((current) => ({ ...current, status: 'running', message: 'Running boot check...' }));
    try {
      const result = await runStockfishBootDiagnostics(25000);
      setCheck({
        status: result.ok ? 'passed' : 'failed',
        message: result.ok ? 'Boot, UCI, ready, and first search passed.' : result.error?.message ?? 'Boot check failed.',
        result,
        diagnostics: result.diagnostics ?? getStockfishDiagnostics(),
      });
    } catch (error) {
      setCheck({
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
        result: null,
        diagnostics: getStockfishDiagnostics(),
      });
    }
  }

  async function runUciCheck() {
    setCheck((current) => ({ ...current, status: 'running', message: 'Running UCI readiness check...' }));
    try {
      await waitForEngine(25000);
      setCheck({
        status: 'passed',
        message: 'Shared Stockfish worker reached readyok.',
        result: null,
        diagnostics: getStockfishDiagnostics(),
      });
    } catch (error) {
      setCheck({
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
        result: null,
        diagnostics: getStockfishDiagnostics(),
      });
    }
  }

  async function runFirstMoveCheck() {
    setCheck((current) => ({ ...current, status: 'running', message: 'Running first move check...' }));
    try {
      const bestMove = await getBestMove(START_FEN, 8, 15000);
      setCheck({
        status: bestMove ? 'passed' : 'failed',
        message: bestMove ? `First move returned ${bestMove}.` : 'Stockfish returned no first move.',
        result: { bestMove },
        diagnostics: getStockfishDiagnostics(),
      });
    } catch (error) {
      setCheck({
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
        result: null,
        diagnostics: getStockfishDiagnostics(),
      });
    }
  }

  async function copyDiagnostics() {
    await navigator.clipboard.writeText(JSON.stringify(check, null, 2));
  }

  return (
    <div className="stockfish-diagnostics">
      <header className="review-header">
        <div>
          <p className="eyebrow">Engine Reliability</p>
          <h1>Stockfish Diagnostics</h1>
          <p className="muted">
            Local deterministic checks for worker construction, worker script startup, Stockfish asset loading,
            UCI readiness, readyok, and first search. No secrets or gameplay records are uploaded.
          </p>
        </div>
      </header>

      <section className="review-panel">
        <div className="diagnostic-actions">
          <button className="btn btn-primary" onClick={runBootCheck} disabled={check.status === 'running'}>
            Run boot check
          </button>
          <button className="btn btn-secondary" onClick={runUciCheck} disabled={check.status === 'running'}>
            Run UCI check
          </button>
          <button className="btn btn-secondary" onClick={runFirstMoveCheck} disabled={check.status === 'running'}>
            Run first move check
          </button>
          <button className="btn btn-ghost" onClick={copyDiagnostics}>
            Copy diagnostics JSON
          </button>
        </div>
        <p style={{ color: severity, fontWeight: 700 }}>{check.message}</p>
        <dl className="play-meta">
          <dt>Worker source</dt>
          <dd>{check.diagnostics.workerSourceKind}</dd>
          <dt>Worker URL</dt>
          <dd>{check.diagnostics.workerUrl}</dd>
          <dt>Environment</dt>
          <dd>{check.diagnostics.environment}</dd>
          <dt>Engine state</dt>
          <dd>{check.diagnostics.state}</dd>
        </dl>
      </section>

      <section className="review-panel">
        <h2>Boot phase timeline</h2>
        {check.diagnostics.bootTimeline.length === 0 ? (
          <p className="muted">No boot events recorded yet.</p>
        ) : (
          <ol className="diagnostic-timeline">
            {check.diagnostics.bootTimeline.map((event, index) => (
              <li key={`${event.phase}-${index}`}>
                <strong>{event.phase}</strong>
                <span>{event.elapsed_ms}ms</span>
                {event.worker_source_kind ? <span>{event.worker_source_kind}</span> : null}
                {event.wasm_path ? <span>{event.wasm_path}</span> : null}
                {typeof event.wasm_reached === 'boolean' ? (
                  <span>wasm {event.wasm_reached ? 'reachable' : 'not reached'}</span>
                ) : null}
                {event.message ? <p>{event.message}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="review-panel">
        <h2>Recent raw engine messages</h2>
        <pre className="diagnostic-json">{JSON.stringify(check.diagnostics.rawWorkerMessages, null, 2)}</pre>
      </section>
    </div>
  );
}
