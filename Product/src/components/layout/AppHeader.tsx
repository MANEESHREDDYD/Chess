import { Link } from 'react-router-dom';
import { AppNav } from './AppNav';

type AppHeaderProps = {
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  audioVolume: number;
  setAudioVolume: (volume: number) => void;
};

export function AppHeader({
  activeTheme,
  setActiveTheme,
  audioEnabled,
  setAudioEnabled,
  audioVolume,
  setAudioVolume,
}: AppHeaderProps) {
  return (
    <header className="app-header-v2">
      <div className="app-header-v2__top">
        <Link to="/" className="brand-v2" aria-label="MIRROR home">
          <span>MIRROR</span>
          <small>AI chess training</small>
        </Link>
        <div className="app-toolbar theme-toggle" aria-label="Theme and audio settings">
          <label>
            <span>Theme</span>
            <select value={activeTheme} onChange={(event) => setActiveTheme(event.target.value)}>
              <option value="standard">Classic</option>
              <option value="mahabharata">Kurukshetra</option>
            </select>
          </label>
          <button
            aria-label={audioEnabled ? 'Mute audio' : 'Enable audio'}
            aria-pressed={audioEnabled}
            className="app-toolbar__icon"
            onClick={() => setAudioEnabled(!audioEnabled)}
            type="button"
          >
            {audioEnabled ? 'Audio on' : 'Audio off'}
          </button>
          {audioEnabled ? (
            <label className="app-toolbar__volume">
              <span>Volume</span>
              <input
                max="1"
                min="0"
                onChange={(event) => setAudioVolume(parseFloat(event.target.value))}
                step="0.05"
                type="range"
                value={audioVolume}
              />
            </label>
          ) : null}
        </div>
      </div>
      <AppNav />
    </header>
  );
}
