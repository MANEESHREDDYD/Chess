import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLocalMatchesForPlayer } from '../data/db';
import {
  getPlayerProgressSummary,
  scanAndGrantAchievements,
  type PlayerProgressSummary,
} from '../progression/progression';
import { usePlayerStore } from '../state/playerStore';
import { useSettingsStore } from '../state/settingsStore';

const MODE_CARDS = [
  {
    title: 'Regular Chess',
    text: 'Play Stockfish locally with the stable engine runtime.',
    route: '/play',
    action: 'Play Chess',
  },
  {
    title: 'Mirror Chess',
    text: 'Face deterministic personality variants built from your StyleVector.',
    route: '/mirror',
    action: 'Play Mirror',
  },
  {
    title: 'Story Campaign',
    text: 'Progress through mission-based Kurukshetra chapters.',
    route: '/story',
    action: 'Open Campaign',
  },
  {
    title: 'Clue Chess Training',
    text: 'Train motifs with adaptive clue levels, review, streak, boss, and kids modes.',
    route: '/clue-chess',
    action: 'Train',
  },
  {
    title: 'Analytics',
    text: 'Review local CP-loss, weak motifs, imports, Mirror feedback, and next actions.',
    route: '/analytics',
    action: 'View Analytics',
  },
  {
    title: 'Profile / Progression',
    text: 'Track XP, badges, chapter progress, and local player state.',
    route: '/progress',
    action: 'Open Profile',
  },
];

export default function Home() {
  const { activePlayer, clearActivePlayer } = usePlayerStore();
  const { activeTheme } = useSettingsStore();
  const [matchCount, setMatchCount] = useState(0);
  const [progress, setProgress] = useState<PlayerProgressSummary | null>(null);

  useEffect(() => {
    if (activePlayer) {
      void getLocalMatchesForPlayer(activePlayer.id).then((matches) => setMatchCount(matches.length));
      void scanAndGrantAchievements(activePlayer.id).then(() => {
        void getPlayerProgressSummary(activePlayer.id).then(setProgress);
      });
    } else {
      setProgress(null);
    }
  }, [activePlayer]);

  const isKurukshetra = activeTheme === 'mahabharata';

  return (
    <section className="home">
      <div className="home-hero">
        <p className="home-eyebrow">
          {isKurukshetra ? 'Kurukshetra-inspired theme active' : 'Local-first chess improvement platform'}
        </p>
        <h1 className="home-title">
          Play a chess opponent built from how <em>you</em> play.
        </h1>
        <p className="home-lede">
          MIRROR combines regular chess, a personalized Mirror opponent, story campaign missions,
          adaptive clue training, and local analytics into one improvement loop.
        </p>

        {activePlayer ? (
          <section className="home-profile-card ui-panel">
            <div className="home-profile-card__header">
              <div>
                <span className="ui-badge">Active profile</span>
                <h2>{activePlayer.display_name}</h2>
              </div>
              <button className="btn btn-ghost" onClick={clearActivePlayer} type="button">
                Switch Profile
              </button>
            </div>
            <div className="home-profile-card__stats">
              {progress ? (
                <>
                  <Metric label="Level" value={`${progress.level} (${progress.total_xp} XP)`} />
                  <Metric label="Streak" value={`${progress.current_streak_days} days`} />
                  <Metric
                    label="Story"
                    value={`${progress.story_chapters_complete}/${progress.story_total_chapters}`}
                  />
                  <Metric
                    label="Focus"
                    value={progress.weakest_motif ? progress.weakest_motif.replace(/_/g, ' ') : 'insufficient data'}
                  />
                </>
              ) : (
                <>
                  <Metric label="Calibration" value={activePlayer.calibration_status ?? 'not started'} />
                  <Metric label="Local games" value={matchCount} />
                  <Metric
                    label="Detected Elo"
                    value={
                      activePlayer.detected_elo !== undefined
                        ? `${activePlayer.detected_elo} (${activePlayer.elo_band})`
                        : 'insufficient data'
                    }
                  />
                </>
              )}
            </div>
            <p className="home-profile-card__action">
              {progress?.next_action ?? 'Calibrate, import games, or play Mirror to strengthen personalization.'}
            </p>
            <div className="home-actions">
              <Link to="/progress" className="btn btn-primary">
                View Progression
              </Link>
              <Link to="/calibration" className="btn btn-secondary">
                {activePlayer.calibration_status === 'complete' ? 'Recalibrate' : 'Start Calibration'}
              </Link>
              <Link to="/import-pgn" className="btn btn-ghost">
                Import Games
              </Link>
            </div>
          </section>
        ) : (
          <div className="home-actions">
            <Link to="/onboarding" className="btn btn-primary">
              Create Player Profile
            </Link>
            <Link to="/play" className="btn btn-ghost">
              Free Play
            </Link>
          </div>
        )}

        <section className="home-mode-grid" aria-label="MIRROR product modes">
          {MODE_CARDS.map((card) => (
            <article key={card.title} className="home-mode-card">
              <h2>{card.title}</h2>
              <p>{card.text}</p>
              <Link to={card.route} className="btn btn-secondary">
                {card.action}
              </Link>
            </article>
          ))}
        </section>

        <p className="home-privacy">
          Gameplay and training data stay on this device unless you explicitly export or use optional backup.
        </p>
        <div className="home-links">
          <Link to="/backup">Backup or Export Your Data</Link>
          <Link to="/account">Optional Cloud Account</Link>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
