import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayerStore } from '../state/playerStore';
import {
  buildCoachContextFromLocalData,
  buildCoachContextJson,
  buildCoachReportMarkdown,
  generateLocalTrainingPlan,
  generateNextActionSummary,
  generateWeaknessSummary,
  getCoachExportDate,
} from '../coach/localCoach';
import { buildCoachSafetyReport } from '../coach/coachSafety';
import type { LocalTrainingPlan, MirrorCoachContext } from '../coach/coachTypes';

type CoachPreviewState =
  | { status: 'idle' | 'loading' }
  | {
      status: 'ready';
      context: MirrorCoachContext;
      plan: LocalTrainingPlan;
      weaknessSummary: string;
      nextActionSummary: string;
    }
  | { status: 'error'; message: string };

export default function CoachPreview() {
  const activePlayer = usePlayerStore((state) => state.activePlayer);
  const [state, setState] = useState<CoachPreviewState>({ status: 'idle' });

  useEffect(() => {
    if (!activePlayer) {
      setState({ status: 'idle' });
      return;
    }

    const playerId = activePlayer.id;
    let cancelled = false;
    async function loadCoach() {
      setState({ status: 'loading' });
      try {
        const context = await buildCoachContextFromLocalData(playerId);
        if (cancelled) return;
        setState({
          status: 'ready',
          context,
          plan: generateLocalTrainingPlan(context),
          weaknessSummary: generateWeaknessSummary(context),
          nextActionSummary: generateNextActionSummary(context),
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Could not build local coach preview.';
        setState({ status: 'error', message });
      }
    }

    void loadCoach();
    return () => {
      cancelled = true;
    };
  }, [activePlayer]);

  if (!activePlayer) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '2rem' }}>
        <h1>Local Coach Preview</h1>
        <p>Select or create a local player profile to generate a deterministic coach preview.</p>
        <Link to="/onboarding" className="btn btn-primary">Create Profile</Link>
      </div>
    );
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '2rem' }}>
        <h1>Local Coach Preview</h1>
        <p>Building local coach context...</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '2rem' }}>
        <h1>Local Coach Preview</h1>
        <p style={{ color: 'var(--danger-color)' }}>{state.message}</p>
      </div>
    );
  }

  if (state.status !== 'ready') {
    return null;
  }

  const { context, plan, weaknessSummary, nextActionSummary } = state;
  const exportDate = getCoachExportDate(context.generated_at);
  const insufficientFlags = context.coach_summary.insufficient_data_flags;
  const markdownExport = buildCoachReportMarkdown(context);
  const jsonExport = buildCoachContextJson(context);
  const markdownFilename = `mirror-coach-report-${exportDate}.md`;
  const jsonFilename = `mirror-coach-context-${exportDate}.json`;
  const safetyFilename = `mirror-coach-safety-report-${exportDate}.json`;
  const safetyReport = buildCoachSafetyReport({
    cards: context.coach_cards,
    context,
    markdown: markdownExport,
    json: jsonExport,
    filenames: [markdownFilename, jsonFilename, safetyFilename],
  });

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '2rem' }}>
      <header style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <p style={{ margin: '0 0 0.35rem', color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
          This coach is deterministic and local-only. GenAI coaching is a future optional feature.
        </p>
        <h1 style={{ marginBottom: '0.5rem' }}>Local Coach Preview</h1>
        <p style={{ margin: 0, color: 'var(--ink-soft)' }}>
          {context.coach_summary.recommended_focus_area} with {context.coach_summary.confidence_level} confidence.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              downloadTextFile(
                markdownFilename,
                markdownExport,
                'text/markdown;charset=utf-8'
              )
            }
          >
            Export Markdown
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              downloadTextFile(
                jsonFilename,
                jsonExport,
                'application/json;charset=utf-8'
              )
            }
          >
            Export JSON Context
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              downloadTextFile(
                safetyFilename,
                `${JSON.stringify(safetyReport, null, 2)}\n`,
                'application/json;charset=utf-8'
              )
            }
          >
            Export safety report
          </button>
        </div>
      </header>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Coach summary</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <Metric label="Focus" value={context.coach_summary.recommended_focus_area} />
          <Metric label="Weakest motif" value={formatValue(context.coach_summary.weakest_motif)} />
          <Metric label="Strongest motif" value={formatValue(context.coach_summary.strongest_motif)} />
          <Metric label="Due reviews" value={String(context.coach_summary.review_due_count)} />
          <Metric label="Achievements" value={String(context.coach_summary.achievement_count)} />
          <Metric label="StyleVector" value={context.coach_summary.style_vector_available ? 'available' : 'missing'} />
        </div>
      </section>

      {insufficientFlags.length > 0 && (
        <section style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--warning-color, #fbbf24)', paddingLeft: '1rem' }}>
          <h2>Insufficient data warnings</h2>
          <ul>
            {insufficientFlags.map((flag) => (
              <li key={flag}>{flag.replace(/_/g, ' ')}</li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Prioritized coach cards</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {context.coach_cards.map((card) => (
            <article
              key={card.id}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '1rem',
                background: 'var(--surface-color)',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <p style={{ margin: '0 0 0.25rem', color: 'var(--ink-soft)', fontSize: '0.85rem' }}>
                    Priority {card.priority} | {card.type} | {card.confidence} confidence
                  </p>
                  <h3 style={{ margin: 0 }}>{card.title}</h3>
                </div>
                <span style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>{card.source}</span>
              </div>
              <p>{card.summary}</p>
              <p><strong>Recommendation:</strong> {card.recommendation}</p>
              <details>
                <summary>Evidence</summary>
                <ul>
                  {card.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Safety/Evaluation</h2>
        <p style={{ color: 'var(--ink-soft)' }}>
          Safety checks are deterministic local checks. They do not use an LLM.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <Metric label="Status" value={safetyReport.passed ? 'passed' : 'failed'} />
          <Metric label="Errors" value={String(safetyReport.summary.error)} />
          <Metric label="Warnings" value={String(safetyReport.summary.warning)} />
          <Metric label="Info" value={String(safetyReport.summary.info)} />
          <Metric label="Cards checked" value={String(safetyReport.checked_cards)} />
        </div>
        {safetyReport.findings.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {safetyReport.findings.map((finding) => (
              <article
                key={`${finding.id}-${finding.card_id || 'context'}-${finding.field || 'field'}`}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '0.75rem',
                  background: 'var(--surface-color)',
                }}
              >
                <p style={{ margin: '0 0 0.25rem', color: 'var(--ink-soft)', fontSize: '0.85rem' }}>
                  {finding.severity} | {finding.category}
                  {finding.card_id ? ` | ${finding.card_id}` : ''}
                  {finding.field ? ` | ${finding.field}` : ''}
                </p>
                <p style={{ margin: '0 0 0.25rem' }}>{finding.message}</p>
                <p style={{ margin: 0, color: 'var(--ink-soft)' }}>{finding.recommendation}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>No safety findings.</p>
        )}
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Current training focus</h2>
        <p>{plan.current_focus}</p>
        <ul>
          {plan.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Evidence section</h2>
        <p>{weaknessSummary}</p>
        <p>{nextActionSummary}</p>
        <p style={{ color: 'var(--ink-soft)' }}>
          Recent analysis quality: {context.analysis_quality_summary.analyses_completed} completed analyses,
          average CP loss {context.analysis_quality_summary.average_cp_loss}, trend {context.analysis_quality_summary.trend}.
        </p>
      </section>

      <section style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: 8 }}>
        <h2>Future GenAI coach note</h2>
        <p>
          A future optional GenAI coach can use this same summarized context after explicit user consent.
          Runtime GenAI coaching is not implemented here, and raw PGN, FEN, account links, and backup files remain local-private by default.
        </p>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.75rem' }}>
      <p style={{ margin: '0 0 0.25rem', color: 'var(--ink-soft)', fontSize: '0.85rem' }}>{label}</p>
      <p style={{ margin: 0, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function formatValue(value?: string): string {
  return value ? value.replace(/_/g, ' ') : 'insufficient data';
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
