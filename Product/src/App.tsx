import { Routes, Route, Link } from 'react-router-dom';
import Home from './routes/Home';
import Calibration from './routes/Calibration';
import Play from './routes/Play';
import Mirror from './routes/Mirror';
import About from './routes/About';
import { Onboarding } from './routes/Onboarding';
import DevMirrorVerification from './routes/DevMirrorVerification';
import DevInspector from './routes/DevInspector';
import { useEffect } from 'react';
import { usePlayerStore } from './state/playerStore';

export default function App() {
  const loadActivePlayer = usePlayerStore(s => s.loadActivePlayer);

  useEffect(() => {
    void loadActivePlayer();
  }, [loadActivePlayer]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          MIRROR
        </Link>
        <nav className="app-nav">
          <Link to="/calibration">Calibration</Link>
          <Link to="/mirror">Mirror</Link>
          <Link to="/play">Play</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/calibration" element={<Calibration />} />
          <Route path="/mirror" element={<Mirror />} />
          <Route path="/play" element={<Play />} />
          <Route path="/about" element={<About />} />
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
      </footer>
    </div>
  );
}
