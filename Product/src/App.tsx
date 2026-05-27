import { Routes, Route, Link } from 'react-router-dom';
import Home from './routes/Home';
import Play from './routes/Play';
import About from './routes/About';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          MIRROR
        </Link>
        <nav className="app-nav">
          <Link to="/play">Play</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <span>MIRROR · Stage 0 prototype</span>
        <span>·</span>
        <Link to="/about">Credits &amp; GPL notices</Link>
      </footer>
    </div>
  );
}
