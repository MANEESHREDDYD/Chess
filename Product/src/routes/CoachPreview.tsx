import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayerStore } from '../state/playerStore';
import {
  buildCoachContextFromLocalData,
  generateLocalTrainingPlan,
  generateNextActionSummary,
  generateWeaknessSummary,
} from '../coach/localCoach';
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
  const weakestMotif = context.puzzle_weakness_summary.weakest_motif || 'Insufficient data';
  const dueReviews = context.spaced_repetition_summary.due_reviews_count;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '2rem' }}>
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Local Coach Preview</h1>
        <p style={{ margin: 0, color: 'var(--ink-soft)' }}>
          This version uses a local deterministic coach. GenAI coaching is planned as a future optional feature.
        </p>
      </div>

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
        <h2>Weakest motif</h2>
        <p>{weakestMotif.replace(/_/g, ' ')}</p>
        <p style={{ color: 'var(--ink-soft)' }}>{weaknessSummary}</p>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Suggested next action</h2>
        <p>{nextActionSummary}</p>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Review queue summary</h2>
        <p>
          {dueReviews} due review{dueReviews === 1 ? '' : 's'} from {context.spaced_repetition_summary.total_reviews} total review records.
        </p>
        {context.spaced_repetition_summary.due_motifs.length > 0 && (
          <p style={{ color: 'var(--ink-soft)' }}>
            Due motifs: {context.spaced_repetition_summary.due_motifs.map((motif) => motif.replace(/_/g, ' ')).join(', ')}
          </p>
        )}
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Story progress recommendation</h2>
        <p>{context.story_progress_summary.recommendation}</p>
        <p style={{ color: 'var(--ink-soft)' }}>
          Completed {context.story_progress_summary.completed_chapters} of {context.story_progress_summary.total_chapters} chapters.
        </p>
      </section>

      <section style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: 8 }}>
        <h2>Future GenAI coach note</h2>
        <p>
          A future optional GenAI coach can consume the summarized context shape after explicit user consent.
          Raw PGN, FEN, account links, and backup files remain local-private by default.
        </p>
      </section>
    </div>
  );
}
