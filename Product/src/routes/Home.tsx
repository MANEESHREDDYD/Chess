import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="home">
      <div className="home-hero">
        <div className="home-eyebrow">A chess prototype</div>
        <h1 className="home-title">
          Play a chess opponent <br /> built from how <em>you</em> play.
        </h1>
        <p className="home-lede">
          MIRROR is an experiment. We are testing whether a chess opponent calibrated to your
          specific style — your openings, your time pressure, your tactical blind spots — actually
          feels like you. Stage 0 is a bare prototype. No story, no theme, no signup. Just chess.
        </p>
        <div className="home-actions">
          <Link to="/calibration" className="btn btn-primary">
            Begin Calibration
          </Link>
          <Link to="/mirror" className="btn btn-secondary">
            Play Mirror
          </Link>
          <Link to="/play" className="btn btn-ghost">
            Free play
          </Link>
        </div>
        <p className="home-privacy">
          We don't track you. Games stay on your device unless you submit feedback.
        </p>
      </div>
    </div>
  );
}
