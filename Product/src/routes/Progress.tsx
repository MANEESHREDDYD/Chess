import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageFrame } from '../components/layout/PageFrame';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { MetricCard } from '../components/ui/MetricCard';
import { getPlayerProgressSummary, scanAndGrantAchievements, type PlayerProgressSummary } from '../progression/progression';
import { usePlayerStore } from '../state/playerStore';

export const Progress: React.FC = () => {
  const navigate = useNavigate();
  const activePlayer = usePlayerStore((s) => s.activePlayer);
  const loadActivePlayer = usePlayerStore((s) => s.loadActivePlayer);
  const [summary, setSummary] = useState<PlayerProgressSummary | null>(null);
  const [attemptedProfileLoad, setAttemptedProfileLoad] = useState(false);

  useEffect(() => {
    if (!activePlayer) {
      if (!attemptedProfileLoad) {
        void loadActivePlayer().finally(() => setAttemptedProfileLoad(true));
        return;
      }
      navigate('/');
      return;
    }

    let isMounted = true;
    const load = async () => {
      await scanAndGrantAchievements(activePlayer.id);
      const data = await getPlayerProgressSummary(activePlayer.id);
      if (isMounted) setSummary(data);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [activePlayer, attemptedProfileLoad, loadActivePlayer, navigate]);

  if (!activePlayer || !summary) {
    return (
      <PageFrame className="profile-page">
        <EmptyState eyebrow="Profile" title="Loading player profile">
          MIRROR is preparing your local progression summary.
        </EmptyState>
      </PageFrame>
    );
  }

  const nextLevelXp = Math.pow(summary.level, 2) * 100;
  const currentLevelBaseXp = Math.pow(summary.level - 1, 2) * 100;
  const xpInCurrentLevel = summary.total_xp - currentLevelBaseXp;
  const xpRequiredForNext = nextLevelXp - currentLevelBaseXp;
  const progressPercent = Math.min(100, Math.max(0, (xpInCurrentLevel / xpRequiredForNext) * 100));
  const xpText = `${xpInCurrentLevel} / ${xpRequiredForNext} XP`;

  return (
    <PageFrame className="profile-page">
      <PageHeader
        actions={<Badge variant="active">{summary.current_streak_days} day streak</Badge>}
        eyebrow="Profile and progression"
        title={activePlayer.display_name}
      >
        Your local MIRROR identity, training activity, and next improvement action.
      </PageHeader>

      <section className="profile-hero">
        <Card className="profile-hero__main" variant="battlefield">
          <div>
            <span className="page-header__eyebrow">Battle profile preview</span>
            <h2>Level {summary.level}</h2>
            <p>{summary.next_action}</p>
          </div>
          <div className="profile-xp">
            <div>
              <span>{xpText}</span>
              <strong>{Math.round(progressPercent)}%</strong>
            </div>
            <div className="profile-xp__track" aria-label={`XP progress ${xpText}`}>
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </Card>
        <Card className="profile-backup-card" variant="game-panel">
          <h2>Backup your progress</h2>
          <p>Export your local gameplay, puzzle, review, and analytics data when you want a manual copy.</p>
          <ButtonLink to="/backup" variant="primary">
            Open Backup
          </ButtonLink>
        </Card>
      </section>

      <section className="profile-metric-grid" aria-label="Core profile metrics">
        <MetricCard label="Games played" value={summary.total_games} action="Play or import games to expand this." />
        <MetricCard label="Mirror matches" value={summary.total_mirror_matches} action="Use Mirror to pressure-test your habits." />
        <MetricCard label="Analyses saved" value={summary.total_analyses} action="Review games to unlock CP-loss trends." />
        <MetricCard
          label="Story chapters"
          value={`${summary.story_chapters_complete} / ${summary.story_total_chapters}`}
          action="Continue campaign missions when ready."
        />
        <MetricCard
          label="Puzzles solved"
          value={`${summary.clue_solved} / ${summary.clue_attempts}`}
          action="Adaptive Clue Chess improves this signal."
        />
        <MetricCard
          label="Solve rate"
          value={`${summary.clue_solved_rate.toFixed(1)}%`}
          action={summary.weakest_motif ? `Train ${summary.weakest_motif.replace(/_/g, ' ')} next.` : 'More puzzle data needed.'}
        />
      </section>

      <section className="profile-layout">
        <Card className="profile-progression-card" variant="elevated">
          <h2>Progression</h2>
          <div className="profile-stat-list">
            <ProfileStat label="XP" value={xpText} />
            <ProfileStat label="Level" value={`Level ${summary.level}`} />
            <ProfileStat label="Streak" value={`${summary.current_streak_days} day streak`} />
            <ProfileStat
              label="Story"
              value={`${summary.story_chapters_complete} / ${summary.story_total_chapters} chapters`}
            />
            <ProfileStat label="Multi-move solved" value={summary.multi_move_solved} />
            <ProfileStat
              label="Weakest motif"
              value={summary.weakest_motif ? summary.weakest_motif.replace(/_/g, ' ') : 'Insufficient data'}
            />
          </div>
        </Card>

        <Card className="profile-action-card" variant="game-panel">
          <h2>Training next action</h2>
          <p>{summary.next_action}</p>
          <div className="profile-action-grid">
            <ButtonLink to="/analytics" variant="primary">
              Open Analytics
            </ButtonLink>
            <ButtonLink to="/clue-chess" variant="secondary">
              Train Clue Chess
            </ButtonLink>
            <ButtonLink to="/mirror" variant="secondary">
              Play Mirror
            </ButtonLink>
            <ButtonLink to="/import-pgn" variant="ghost">
              Import Games
            </ButtonLink>
          </div>
        </Card>
      </section>

      <section className="profile-activity">
        <h2>Recent activity</h2>
        {summary.achievements.length === 0 ? (
          <EmptyState eyebrow="Activity" title="No achievements earned yet">
            Play, review, import, or train to start filling your local profile timeline.
          </EmptyState>
        ) : (
          <div className="profile-achievement-grid">
            {summary.achievements.map((achievement) => (
              <Card key={achievement.id} className="profile-achievement" variant="default">
                <Badge variant="success">Achievement</Badge>
                <h3>{achievement.title}</h3>
                <p>{achievement.description}</p>
                <time>{new Date(achievement.earned_at).toLocaleDateString()}</time>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageFrame>
  );
};

function ProfileStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
