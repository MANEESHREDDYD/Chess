import { NavLink } from 'react-router-dom';
import { NovaPopover } from '../ui/NovaPopover';
import { cx } from '../ui/classNames';
import {
  CheckIcon,
  ChevronDownIcon,
  CoachIcon,
  CalibrationIcon,
  DiagnosticsIcon,
  ImportIcon,
  InfoIcon,
  MoreIcon,
  type IconProps,
} from '../ui/icons';

type MoreItem = {
  to: string;
  label: string;
  description: string;
  Icon: (props: IconProps) => JSX.Element;
};

const MORE_ITEMS: MoreItem[] = [
  { to: '/import-pgn', label: 'Import games', description: 'Bring in local PGN history', Icon: ImportIcon },
  { to: '/coach-preview', label: 'Coach', description: 'Local deterministic guidance', Icon: CoachIcon },
  { to: '/calibration', label: 'Calibration', description: 'Tune your StyleVector', Icon: CalibrationIcon },
  { to: '/about', label: 'About', description: 'Project and license notes', Icon: InfoIcon },
  { to: '/stockfish-diagnostics', label: 'Engine diagnostics', description: 'Boot, UCI, and worker checks', Icon: DiagnosticsIcon },
];

export function MoreMenu() {
  return (
    <NovaPopover
      ariaLabel="More destinations"
      panelRole="menu"
      renderTrigger={({ triggerProps }) => (
        <button
          type="button"
          className="nova-trigger nova-trigger--more"
          data-popover-trigger
          aria-label="More"
          {...triggerProps}
        >
          <span className="nova-trigger__icon">
            <MoreIcon size={18} />
          </span>
          <span className="nova-trigger__label-text">More</span>
          <span className="nova-trigger__chevron" aria-hidden="true">
            <ChevronDownIcon size={16} />
          </span>
        </button>
      )}
    >
      {(close) =>
        MORE_ITEMS.map(({ to, label, description, Icon }) => (
          <NavLink
            key={to}
            to={to}
            role="menuitem"
            onClick={close}
            className={({ isActive }) => cx('nova-menu-item', isActive && 'is-active')}
          >
            {({ isActive }) => (
              <>
                <span className="nova-menu-item__icon">
                  <Icon size={18} />
                </span>
                <span className="nova-menu-item__body">
                  <span className="nova-menu-item__title">{label}</span>
                  <span className="nova-menu-item__desc">{description}</span>
                </span>
                <span className="nova-menu-item__check">
                  {isActive ? <CheckIcon size={16} /> : null}
                </span>
              </>
            )}
          </NavLink>
        ))
      }
    </NovaPopover>
  );
}
