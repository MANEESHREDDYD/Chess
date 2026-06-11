import { NovaPopover } from '../ui/NovaPopover';
import { cx } from '../ui/classNames';
import { BoardIcon, CheckIcon, ChevronDownIcon } from '../ui/icons';

type BoardThemeOption = {
  value: string;
  label: string;
  description: string;
};

const BOARD_THEME_OPTIONS: BoardThemeOption[] = [
  { value: 'standard', label: 'Classic', description: 'Clean standard board' },
  { value: 'mahabharata', label: 'Kurukshetra', description: 'Warm battlefield-inspired 2D theme' },
];

type BoardThemeMenuProps = {
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
};

export function BoardThemeMenu({ activeTheme, setActiveTheme }: BoardThemeMenuProps) {
  const selected = BOARD_THEME_OPTIONS.find((option) => option.value === activeTheme) ?? BOARD_THEME_OPTIONS[0];

  return (
    <NovaPopover
      ariaLabel="Board theme"
      panelRole="listbox"
      renderTrigger={({ triggerProps }) => (
        <button
          type="button"
          className="nova-trigger nova-trigger--board"
          data-popover-trigger
          aria-label={`Board theme: ${selected.label}`}
          {...triggerProps}
        >
          <span className="nova-trigger__icon">
            <BoardIcon size={18} />
          </span>
          <span className="nova-trigger__label">
            <span className="nova-trigger__eyebrow">Board Theme</span>
            <span className="nova-trigger__value" data-board-theme-value>
              {selected.label}
            </span>
          </span>
          <span className="nova-trigger__chevron" aria-hidden="true">
            <ChevronDownIcon size={16} />
          </span>
        </button>
      )}
    >
      {(close) =>
        BOARD_THEME_OPTIONS.map((option) => {
          const isActive = option.value === activeTheme;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={isActive}
              className={cx('nova-menu-item', isActive && 'is-active')}
              onClick={() => {
                setActiveTheme(option.value);
                close();
              }}
            >
              <span className="nova-menu-item__icon">
                <BoardIcon size={18} />
              </span>
              <span className="nova-menu-item__body">
                <span className="nova-menu-item__title">{option.label}</span>
                <span className="nova-menu-item__desc">{option.description}</span>
              </span>
              <span className="nova-menu-item__check">{isActive ? <CheckIcon size={16} /> : null}</span>
            </button>
          );
        })
      }
    </NovaPopover>
  );
}
