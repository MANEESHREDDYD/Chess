import { NavLink } from 'react-router-dom';
import { cx } from '../ui/classNames';
import {
  AnalyticsIcon,
  ClueIcon,
  MirrorIcon,
  PlayIcon,
  ProfileIcon,
  StoryIcon,
  type IconProps,
} from '../ui/icons';

type NavItem = {
  to: string;
  label: string;
  Icon: (props: IconProps) => JSX.Element;
};

const PRIMARY_NAV: NavItem[] = [
  { to: '/play', label: 'Play', Icon: PlayIcon },
  { to: '/mirror', label: 'Mirror', Icon: MirrorIcon },
  { to: '/story', label: 'Story', Icon: StoryIcon },
  { to: '/clue-chess', label: 'Clue', Icon: ClueIcon },
  { to: '/analytics', label: 'Analytics', Icon: AnalyticsIcon },
  { to: '/progress', label: 'Profile', Icon: ProfileIcon },
];

export function AppNav() {
  return (
    <nav className="nova-nav" aria-label="Primary navigation">
      {PRIMARY_NAV.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          aria-label={label}
          className={({ isActive }) => cx('nova-nav__link', isActive && 'is-active')}
        >
          <Icon size={18} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
