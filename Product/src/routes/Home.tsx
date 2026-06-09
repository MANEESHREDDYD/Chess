import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { usePlayerStore } from '../state/playerStore';
import { useSettingsStore } from '../state/settingsStore';
import { getLocalMatchesForPlayer } from '../data/db';
import { getPlayerProgressSummary, scanAndGrantAchievements, type PlayerProgressSummary } from '../progression/progression';

export default function Home() {
  const { activePlayer, clearActivePlayer } = usePlayerStore();
  const { activeTheme } = useSettingsStore();
  const [matchCount, setMatchCount] = useState(0);
  const [progress, setProgress] = useState<PlayerProgressSummary | null>(null);

  useEffect(() => {
    if (activePlayer) {
      getLocalMatchesForPlayer(activePlayer.id).then(m => setMatchCount(m.length));
      scanAndGrantAchievements(activePlayer.id).then(() => {
        getPlayerProgressSummary(activePlayer.id).then(setProgress);
      });
    } else {
      setProgress(null);
    }
  }, [activePlayer]);

  const isKurukshetra = activeTheme === 'mahabharata';

  return (
    <div className="home">
      <div className="home-hero">
        <div className="home-eyebrow">
          {isKurukshetra ? '✦ Kurukshetra Theme Active ✦' : 'A local-first chess prototype'}
        </div>
        <h1 className="home-title">
          Play a chess opponent <br /> built from how <em>you</em> play.
        </h1>
        <p className="home-lede">
          MIRROR is an experiment. We are testing whether a chess opponent calibrated to your
          specific style - your openings, your time pressure, your tactical blind spots - actually
          feels like you.
        </p>
        
        {activePlayer ? (
          <div style={{ background: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Player Profile: {activePlayer.display_name}</h2>
              <button className="btn btn-ghost" onClick={clearActivePlayer} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>Switch Profile</button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', lineHeight: 1.6 }}>
              {progress ? (
                <>
                  <li><strong>Level:</strong> {progress.level} ({progress.total_xp} XP)</li>
                  <li><strong>Current Streak:</strong> {progress.current_streak_days} days</li>
                  <li><strong>Story Progress:</strong> {progress.story_chapters_complete} / {progress.story_total_chapters} chapters</li>
                  {progress.weakest_motif && <li><strong>Weakest Motif:</strong> <span className="capitalize">{progress.weakest_motif.replace(/_/g, ' ')}</span></li>}
                  <li style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--primary-color)', color: 'white', borderRadius: '4px' }}>
                    <strong>Suggested Action:</strong> {progress.next_action}
                  </li>
                </>
              ) : (
                <>
                  <li><strong>Calibration Status:</strong> {activePlayer.calibration_status}</li>
                  {activePlayer.detected_elo !== undefined && (
                    <li><strong>Detected Elo:</strong> {activePlayer.detected_elo} ({activePlayer.elo_band})</li>
                  )}
                  <li><strong>Local Games Played:</strong> {matchCount}</li>
                </>
              )}
            </ul>
            <div className="home-actions" style={{ justifyContent: 'flex-start' }}>
              <Link to="/progress" className="btn btn-primary">
                View Full Progression
              </Link>
              <Link to="/calibration" className="btn btn-secondary">
                {activePlayer.calibration_status === 'complete' ? 'Recalibrate' : 'Start Calibration'}
              </Link>
              <Link to="/mirror" className="btn btn-ghost">
                Play Mirror
              </Link>
            </div>
          </div>
        ) : (
          <div className="home-actions">
            <Link to="/onboarding" className="btn btn-primary">
              Create Player Profile
            </Link>
            <Link to="/play" className="btn btn-ghost">
              Free play
            </Link>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '2rem 0' }}>
          <div style={{ background: 'var(--surface-sunken, #eaeaea)', padding: '1rem', borderRadius: 8, textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 0.5rem 0' }}>Story Mode</h2>
            <p style={{ margin: '0 0 1rem 0' }}>Begin the apprentice's path through Kurukshetra.</p>
            <Link to="/story" className="btn btn-secondary">
              Play Story Mode
            </Link>
          </div>

          <div style={{ background: 'var(--surface-sunken, #eaeaea)', padding: '1rem', borderRadius: 8, textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 0.5rem 0' }}>Clue Chess</h2>
            <p style={{ margin: '0 0 1rem 0' }}>Train with adaptive hints based on your style.</p>
            <Link to="/clue-chess" className="btn btn-secondary">
              Play Clue Chess
            </Link>
          </div>
        </div>

        <p className="home-privacy">
          We don't track you. Games stay on your device unless you submit feedback.
        </p>

        <div style={{ marginTop: '2rem', textAlign: 'center', background: '#e0f2fe', padding: '1.5rem', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#0369a1' }}>Optional Cloud Sync (Beta)</h3>
          <p style={{ margin: '0 0 1rem 0', color: '#0c4a6e', fontSize: '0.95rem' }}>Link your local profile to a cloud account for future sync capabilities.</p>
          <Link to="/account" className="btn btn-secondary" style={{ background: '#0284c7', color: 'white' }}>
            Setup Cloud Account
          </Link>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link to="/backup" style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', textDecoration: 'underline' }}>
            Backup or Export Your Data
          </Link>
        </div>
      </div>
    </div>
  );
}
