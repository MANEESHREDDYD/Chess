import { NavLink } from 'react-router-dom';

const PRIMARY_NAV = [
  { to: '/play', label: 'Play' },
  { to: '/mirror', label: 'Mirror' },
  { to: '/story', label: 'Story' },
  { to: '/clue-chess', label: 'Clue' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/progress', label: 'Profile' },
];

const SECONDARY_NAV = [
  { to: '/import-pgn', label: 'Import games' },
  { to: '/coach-preview', label: 'Coach' },
  { to: '/calibration', label: 'Calibration' },
  { to: '/about', label: 'About' },
];

export function AppNav() {
  return (
    <nav className="app-nav-v2" aria-label="Primary navigation">
      <div className="app-nav-v2__primary">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
            {item.label}
          </NavLink>
        ))}
      </div>
      <div className="app-nav-v2__secondary">
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
            {item.label}
          </NavLink>
        ))}
        <NavLink
          to="/stockfish-diagnostics"
          className={({ isActive }) => `app-nav-v2__system${isActive ? ' is-active' : ''}`}
        >
          Engine diagnostics
        </NavLink>
      </div>
    </nav>
  );
}
