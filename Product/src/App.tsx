import { Routes, Route, Link } from 'react-router-dom';
import Home from './routes/Home';
import Calibration from './routes/Calibration';
import Play from './routes/Play';
import Mirror from './routes/Mirror';
import ClueChess from './routes/ClueChess';
import Story from './routes/Story';
import About from './routes/About';
import { Onboarding } from './routes/Onboarding';
import { Progress } from './routes/Progress';
import Backup from './routes/Backup';
import CoachPreview from './routes/CoachPreview';
import PgnImport from './routes/PgnImport';
import GameReview from './routes/GameReview';
import AnalyticsDashboard from './routes/AnalyticsDashboard';
import StockfishDiagnostics from './routes/StockfishDiagnostics';
import { Account } from './routes/Account';
import { AboutProject } from './routes/AboutProject';
import DevMirrorVerification from './routes/DevMirrorVerification';
import DevInspector from './routes/DevInspector';
import { useEffect } from 'react';
import { usePlayerStore } from './state/playerStore';
import { useSettingsStore } from './state/settingsStore';

export default function App() {
  const loadActivePlayer = usePlayerStore(s => s.loadActivePlayer);
  const { activeTheme, setActiveTheme, audioEnabled, setAudioEnabled, audioVolume, setAudioVolume } = useSettingsStore();

  useEffect(() => {
    void loadActivePlayer();
  }, [loadActivePlayer]);

  return (
    <div className={`app-shell ${activeTheme === 'mahabharata' ? 'theme-mahabharata' : ''}`}>
      <header className="app-header">
        <Link to="/" className="brand">
          MIRROR
        </Link>
        <nav className="app-nav">
          <Link to="/calibration">Calibration</Link>
          <Link to="/mirror">Mirror</Link>
          <Link to="/story">Story</Link>
          <Link to="/clue-chess">Clue</Link>
          <Link to="/play">Play</Link>
          <Link to="/import-pgn">Import games</Link>
          <Link to="/analytics">Analytics</Link>
          <Link to="/progress">Progress</Link>
          <Link to="/coach-preview">Coach</Link>
          <Link to="/stockfish-diagnostics">Engine diagnostics</Link>
          <Link to="/about">About</Link>
        </nav>
        <div className="theme-toggle" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Theme:</span>
          <select 
            value={activeTheme} 
            onChange={(e) => setActiveTheme(e.target.value)}
            style={{ padding: '0.2rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--surface-color)' }}
          >
            <option value="standard">Classic</option>
            <option value="mahabharata">Kurukshetra</option>
          </select>
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 0.5rem' }} />
          <button 
            onClick={() => setAudioEnabled(!audioEnabled)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '0.2rem',
              opacity: audioEnabled ? 1 : 0.5
            }}
            title={audioEnabled ? 'Mute Audio' : 'Enable Audio'}
          >
            {audioEnabled ? '🔊' : '🔇'}
          </button>
          {audioEnabled && (
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={audioVolume} 
              onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
              style={{ width: '60px' }}
              title="Volume"
            />
          )}
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/calibration" element={<Calibration />} />
          <Route path="/mirror" element={<Mirror />} />
          <Route path="/story" element={<Story />} />
          <Route path="/clue-chess" element={<ClueChess />} />
          <Route path="/play" element={<Play />} />
          <Route path="/import-pgn" element={<PgnImport />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/review/:sourceType/:sourceId" element={<GameReview />} />
          <Route path="/stockfish-diagnostics" element={<StockfishDiagnostics />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/coach-preview" element={<CoachPreview />} />
          <Route path="/backup" element={<Backup />} />
          <Route path="/account" element={<Account />} />
          <Route path="/about" element={<About />} />
          <Route path="/about-project" element={<AboutProject />} />
          {import.meta.env.DEV && (
            <>
              <Route path="/dev/mirror-verification" element={<DevMirrorVerification />} />
              <Route path="/dev/inspector" element={<DevInspector />} />
            </>
          )}
        </Routes>
      </main>
      <footer className="app-footer">
        <span>MIRROR | MVP prototype</span>
        <span>|</span>
        <Link to="/about">Credits &amp; GPL notices</Link>
        <span>|</span>
        <Link to="/about-project">About this project</Link>
      </footer>
    </div>
  );
}
