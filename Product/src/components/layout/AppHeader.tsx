import { Link } from 'react-router-dom';
import { AppNav } from './AppNav';
import { BoardThemeMenu } from './BoardThemeMenu';
import { AudioControl } from './AudioControl';
import { MoreMenu } from './MoreMenu';

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
    <header className="nova-header">
      <div className="nova-header__inner">
        <Link to="/" className="nova-brand" aria-label="MIRROR home">
          <span className="nova-brand__word">MIRROR</span>
        </Link>

        <AppNav />

        <div className="nova-commands">
          <BoardThemeMenu activeTheme={activeTheme} setActiveTheme={setActiveTheme} />
          <AudioControl
            audioEnabled={audioEnabled}
            audioVolume={audioVolume}
            setAudioEnabled={setAudioEnabled}
            setAudioVolume={setAudioVolume}
          />
          <MoreMenu />
        </div>
      </div>
    </header>
  );
}
