import { MoonIcon, SunIcon } from '../ui/icons';

export type UiTheme = 'dark' | 'light';

type AppearanceToggleProps = {
  theme: UiTheme;
  setTheme: (theme: UiTheme) => void;
};

/**
 * Single icon-only switch fixed to the bottom-right of the screen. It always
 * shows the appearance you can switch TO: in light mode it shows the moon
 * (go dark), in dark mode the sun (go light). Labels live in aria/title only.
 */
export function AppearanceToggle({ theme, setTheme }: AppearanceToggleProps) {
  const next: UiTheme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? 'Switch to dark appearance' : 'Switch to light appearance';
  return (
    <button
      type="button"
      className="nova-appearance"
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
    >
      {next === 'dark' ? <MoonIcon size={18} /> : <SunIcon size={18} />}
    </button>
  );
}
