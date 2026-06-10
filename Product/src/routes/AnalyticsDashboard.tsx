import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buildAnalyticsDashboardJson,
  buildAnalyticsDashboardMarkdown,
  buildAnalyticsDashboardSnapshot,
  getAnalyticsExportDate,
} from '../analytics/dashboardService';
import type {
  AnalyticsDashboardSnapshot,
  AnalyticsRecommendedAction,
  GameReviewAnalyticsSummary,
  MotifAnalyticsRow,
  StyleVectorMetric,
} from '../analytics/dashboardTypes';
import { usePlayerStore } from '../state/playerStore';

type DashboardState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; snapshot: AnalyticsDashboardSnapshot }
  | { status: 'error'; message: string };

export default function AnalyticsDashboard() {
  const activePlayerId = usePlayerStore((state) => state.activePlayerId);
  const activePlayer = usePlayerStore((state) => state.activePlayer);
  const [state, setState] = useState<DashboardState>({ status: 'idle' });

  useEffect(() => {
    const playerId = activePlayerId ?? activePlayer?.id ?? null;
    let cancelled = false;

    async function loadDashboard() {
      setState({ status: 'loading' });
      try {
        const snapshot = await buildAnalyticsDashboardSnapshot(playerId);
        if (!cancelled) setState({ status: 'ready', snapshot });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not build analytics dashboard.';
        if (!cancelled) setState({ status: 'error', message });
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [activePlayer, activePlayerId]);

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <section className="analytics-dashboard">
        <p className="home-eyebrow">Advanced analytics</p>
        <h1>Building local dashboard...</h1>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="analytics-dashboard">
        <p className="home-eyebrow">Advanced analytics</p>
        <h1>Analytics unavailable</h1>
        <p className="mirror-alert">{state.message}</p>
      </section>
    );
  }

  if (state.status !== 'ready') {
    return null;
  }

  const snapshot = state.snapshot;
  const exportDate = getAnalyticsExportDate(snapshot.generated_at);
  const markdown = buildAnalyticsDashboardMarkdown(snapshot);
  const json = buildAnalyticsDashboardJson(snapshot);

  return (
    <section className="analytics-dashboard">
      <header className="analytics-dashboard__hero">
        <div>
          <p className="home-eyebrow">Advanced analytics</p>
          <h1>Player intelligence dashboard</h1>
          <p>
            Local-first analytics from MIRROR games, imports, reviews, StyleVector, puzzles,
            story progress, and coach-ready recommendations. Runtime GenAI and cloud upload are not used.
          </p>
        </div>
        <div className="analytics-dashboard__exports">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => downloadTextFile(`mirror-analytics-dashboard-${exportDate}.md`, markdown, 'text/markdown;charset=utf-8')}
          >
            Export Markdown
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => downloadTextFile(`mirror-analytics-snapshot-${exportDate}.json`, json, 'application/json;charset=utf-8')}
          >
            Export JSON
          </button>
        </div>
      </header>

      <section className="analytics-dashboard__summary-grid" aria-label="Player intelligence summary">
        <MetricCard label="Local games" value={snapshot.player_summary.total_local_games} action={snapshot.player_summary.recommendation} />
        <MetricCard label="Reviewed games" value={snapshot.review_summary.reviewed_games_count} action={snapshot.review_summary.recommended_action} />
        <MetricCard label="Imported games" value={snapshot.imported_game_summary.imported_games_count} action={snapshot.imported_game_summary.recommendation} />
        <MetricCard label="Due reviews" value={snapshot.review_queue_summary.due_reviews_count} action={snapshot.review_queue_summary.recommendation} />
        <MetricCard label="Mirror matches" value={snapshot.mirror_summary.mirror_matches_count} action={snapshot.mirror_summary.recommendation} />
        <MetricCard label="Story level" value={snapshot.progression_summary.level} action={snapshot.progression_summary.recommendation} />
      </section>

      <section className="analytics-dashboard__section analytics-dashboard__section--wide">
        <SectionHeader
          title="Data quality"
          action={snapshot.data_quality.findings.length > 0
            ? 'Fix the highest-priority missing data area before trusting deeper trends.'
            : 'Data quality looks healthy; continue the review and Mirror loop.'}
        />
        {snapshot.data_quality.findings.length > 0 ? (
          <div className="analytics-dashboard__finding-list">
            {snapshot.data_quality.findings.map((finding) => (
              <article key={finding.id} className={`analytics-dashboard__finding analytics-dashboard__finding--${finding.severity}`}>
                <strong>{finding.message}</strong>
                <span>{finding.recommended_action}</span>
                {finding.route ? <Link to={finding.route}>Open</Link> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="analytics-dashboard__muted">No blocking data-quality findings.</p>
        )}
      </section>

      <div className="analytics-dashboard__two-col">
        <ReviewSummaryPanel summary={snapshot.review_summary} />
        <StyleVectorPanel metrics={snapshot.stylevector_summary.metrics} snapshot={snapshot} />
      </div>

      <div className="analytics-dashboard__two-col">
        <MotifPanel rows={snapshot.puzzle_summary.motif_rows} snapshot={snapshot} />
        <ReviewQueuePanel snapshot={snapshot} />
      </div>

      <div className="analytics-dashboard__two-col">
        <ImportedGamesPanel snapshot={snapshot} />
        <MirrorPanel snapshot={snapshot} />
      </div>

      <div className="analytics-dashboard__two-col">
        <StoryPanel snapshot={snapshot} />
        <ActionsPanel actions={snapshot.recommended_actions} />
      </div>
    </section>
  );
}

function ReviewSummaryPanel({ summary }: { summary: GameReviewAnalyticsSummary }) {
  return (
    <section className="analytics-dashboard__section">
      <SectionHeader title="Game Review Pro summary" action={summary.recommended_action} />
      <div className="analytics-dashboard__metric-row">
        <MiniMetric label="Avg CP loss" value={summary.average_cp_loss} />
        <MiniMetric label="Accuracy" value={`${summary.accuracy_estimate}%`} />
        <MiniMetric label="Blunders" value={summary.blunder_count} />
        <MiniMetric label="Mistakes" value={summary.mistake_count} />
      </div>
      <p className="analytics-dashboard__interpretation">{summary.interpretation}</p>
      <div className="analytics-dashboard__bar-list">
        {summary.phase_weakness_bars.map((row) => (
          <BarRow
            key={row.phase}
            label={row.phase}
            value={row.average_cp_loss}
            max={Math.max(1, ...summary.phase_weakness_bars.map((item) => item.average_cp_loss))}
            note={`${row.reviewed_moves} move(s), ${row.blunders} blunder(s)`}
          />
        ))}
      </div>
      <ClassificationDistribution summary={summary} />
      {summary.latest_key_moment ? (
        <p className="analytics-dashboard__muted">
          Latest key moment: Move {summary.latest_key_moment.move_number} {summary.latest_key_moment.san}.{' '}
          {summary.latest_key_moment.route ? <Link to={summary.latest_key_moment.route}>Open review</Link> : null}
        </p>
      ) : (
        <p className="analytics-dashboard__muted">Insufficient data: no key moment has been reviewed yet.</p>
      )}
    </section>
  );
}

function StyleVectorPanel({
  metrics,
  snapshot,
}: {
  metrics: StyleVectorMetric[];
  snapshot: AnalyticsDashboardSnapshot;
}) {
  return (
    <section className="analytics-dashboard__section">
      <SectionHeader title="StyleVector profile" action={snapshot.stylevector_summary.recommendation} />
      {snapshot.stylevector_summary.available ? (
        <>
          <div className="analytics-dashboard__chips">
            <span>Source: {snapshot.stylevector_summary.evidence_source}</span>
            <span>Confidence: {snapshot.stylevector_summary.confidence}</span>
            <span>Elo band: {snapshot.stylevector_summary.detected_elo_band}</span>
            <span>Minor: {snapshot.stylevector_summary.preferred_minor}</span>
          </div>
          <div className="analytics-dashboard__bar-list">
            {metrics.map((metric) => (
              <BarRow key={metric.id} label={metric.label} value={metric.value} max={100} note={metric.interpretation} />
            ))}
          </div>
          <p className="analytics-dashboard__muted">
            Openings: White {formatList(snapshot.stylevector_summary.opening_white_top3)};
            Black {formatList(snapshot.stylevector_summary.opening_black_top3)}.
          </p>
        </>
      ) : (
        <p className="analytics-dashboard__empty-note">
          Insufficient data: complete calibration or import user-attributed PGNs before reading StyleVector charts.
        </p>
      )}
    </section>
  );
}

function MotifPanel({ rows, snapshot }: { rows: MotifAnalyticsRow[]; snapshot: AnalyticsDashboardSnapshot }) {
  const maxWeakness = Math.max(1, ...rows.map((row) => row.failed + row.review_lapses + row.review_mistakes + row.due_reviews));
  return (
    <section className="analytics-dashboard__section">
      <SectionHeader title="Weak motif analytics" action={snapshot.puzzle_summary.recommended_action} />
      <p className="analytics-dashboard__interpretation">{snapshot.puzzle_summary.interpretation}</p>
      {rows.length > 0 ? (
        <div className="analytics-dashboard__bar-list">
          {rows.slice(0, 8).map((row) => (
            <BarRow
              key={row.motif}
              label={formatMotif(row.motif)}
              value={row.failed + row.review_lapses + row.review_mistakes + row.due_reviews}
              max={maxWeakness}
              note={`${row.solved_rate}% solved, ${row.due_reviews} due review(s), ${row.review_mistakes} review issue(s)`}
            />
          ))}
        </div>
      ) : (
        <p className="analytics-dashboard__empty-note">Insufficient data: solve Clue Chess puzzles or review games with motif tags.</p>
      )}
    </section>
  );
}

function ReviewQueuePanel({ snapshot }: { snapshot: AnalyticsDashboardSnapshot }) {
  const queue = snapshot.review_queue_summary;
  return (
    <section className="analytics-dashboard__section">
      <SectionHeader title="Puzzle review queue" action={queue.recommendation} />
      <div className="analytics-dashboard__metric-row">
        <MiniMetric label="Due" value={queue.due_reviews_count} />
        <MiniMetric label="Overdue" value={queue.overdue_reviews_count} />
        <MiniMetric label="Upcoming" value={queue.upcoming_reviews_count} />
        <MiniMetric label="Avg interval" value={`${queue.average_interval_days}d`} />
      </div>
      {queue.queue_preview.length > 0 ? (
        <div className="analytics-dashboard__mini-list">
          {queue.queue_preview.map((item) => (
            <span key={item.puzzle_id}>
              {formatMotif(item.motif)} due {new Date(item.next_due_at).toLocaleDateString()} ({item.lapses} lapse(s))
            </span>
          ))}
        </div>
      ) : (
        <p className="analytics-dashboard__empty-note">No due queue yet. Solve or retry puzzles to create review data.</p>
      )}
    </section>
  );
}

function ImportedGamesPanel({ snapshot }: { snapshot: AnalyticsDashboardSnapshot }) {
  const imported = snapshot.imported_game_summary;
  return (
    <section className="analytics-dashboard__section">
      <SectionHeader title="Imported-game coverage" action={imported.recommendation} />
      <div className="analytics-dashboard__metric-row">
        <MiniMetric label="Valid" value={imported.valid_games_count} />
        <MiniMetric label="Invalid/partial" value={imported.invalid_or_partial_count} />
        <MiniMetric label="Reviewed" value={imported.reviewed_imported_games_count} />
        <MiniMetric label="Analyzed" value={`${imported.analysis_coverage_percent}%`} />
      </div>
      <div className="analytics-dashboard__chips">
        {Object.entries(imported.source_breakdown).map(([source, count]) => (
          <span key={source}>{source}: {count}</span>
        ))}
        {Object.keys(imported.source_breakdown).length === 0 ? <span>Insufficient data: no imports yet</span> : null}
      </div>
    </section>
  );
}

function MirrorPanel({ snapshot }: { snapshot: AnalyticsDashboardSnapshot }) {
  const mirror = snapshot.mirror_summary;
  return (
    <section className="analytics-dashboard__section">
      <SectionHeader title="Mirror performance" action={mirror.recommendation} />
      <div className="analytics-dashboard__metric-row">
        <MiniMetric label="Matches" value={mirror.mirror_matches_count} />
        <MiniMetric label="Felt like me" value={mirror.felt_like_me_count} />
        <MiniMetric label="Too random" value={mirror.too_random_count} />
        <MiniMetric label="Modes" value={mirror.personality_modes_played.length} />
      </div>
      <p className="analytics-dashboard__muted">
        Latest: {mirror.latest_result ?? 'insufficient data'} in {mirror.latest_mode ?? 'unknown mode'}.
      </p>
      <div className="analytics-dashboard__chips">
        {Object.entries(mirror.feedback_tags).map(([tag, count]) => (
          <span key={tag}>{tag.replace(/_/g, ' ')}: {count}</span>
        ))}
      </div>
    </section>
  );
}

function StoryPanel({ snapshot }: { snapshot: AnalyticsDashboardSnapshot }) {
  const story = snapshot.story_summary;
  const progression = snapshot.progression_summary;
  return (
    <section className="analytics-dashboard__section">
      <SectionHeader title="Story and progression" action={story.recommendation} />
      <div className="analytics-dashboard__metric-row">
        <MiniMetric label="XP" value={progression.xp} />
        <MiniMetric label="Level" value={progression.level} />
        <MiniMetric label="Badges" value={progression.achievements_count} />
        <MiniMetric label="Streak" value={progression.current_streak_days} />
      </div>
      <BarRow
        label={progression.story_rank}
        value={story.completed_chapters}
        max={Math.max(1, story.total_chapters)}
        note={`${story.completed_chapters}/${story.total_chapters} chapters complete`}
      />
      <p className="analytics-dashboard__muted">
        Current: {story.current_act ?? 'Story'} {story.current_chapter_title ?? 'not started'}.
      </p>
    </section>
  );
}

function ActionsPanel({ actions }: { actions: AnalyticsRecommendedAction[] }) {
  return (
    <section className="analytics-dashboard__section">
      <SectionHeader title="Recommended next actions" action="Highest-priority action should be the next 20-minute improvement step." />
      <div className="analytics-dashboard__action-list">
        {actions.map((action) => (
          <article key={action.id} className="analytics-dashboard__action">
            <span>{action.priority}</span>
            <div>
              <strong>{action.title}</strong>
              <p>{action.reason}</p>
              <small>Evidence: {action.evidence.join(' ')}</small>
              {action.route ? <Link to={action.route}>Open</Link> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClassificationDistribution({ summary }: { summary: GameReviewAnalyticsSummary }) {
  if (summary.classification_distribution.length === 0) {
    return <p className="analytics-dashboard__empty-note">Insufficient data: no move labels yet.</p>;
  }

  const max = Math.max(...summary.classification_distribution.map((item) => item.count), 1);
  return (
    <div className="analytics-dashboard__bar-list" aria-label="Move classification distribution">
      {summary.classification_distribution.map((item) => (
        <BarRow key={item.label} label={item.label.replace(/_/g, ' ')} value={item.count} max={max} note="Move label count" />
      ))}
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action: string }) {
  return (
    <header className="analytics-dashboard__section-header">
      <h2>{title}</h2>
      <p>{action}</p>
    </header>
  );
}

function MetricCard({ label, value, action }: { label: string; value: number | string; action: string }) {
  return (
    <article className="analytics-dashboard__metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{action}</p>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="analytics-dashboard__mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BarRow({ label, value, max, note }: { label: string; value: number; max: number; note: string }) {
  const width = useMemo(() => `${Math.max(4, Math.min(100, (value / Math.max(1, max)) * 100))}%`, [max, value]);
  return (
    <div className="analytics-dashboard__bar-row">
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
      <div className="analytics-dashboard__bar-track" aria-hidden="true">
        <span style={{ width }} />
      </div>
      <p>{note}</p>
    </div>
  );
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'insufficient data';
}

function formatMotif(value: string): string {
  return value.replace(/_/g, ' ');
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
