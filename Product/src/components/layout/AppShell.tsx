import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from './AppHeader';

type AppShellProps = {
  children: ReactNode;
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  audioVolume: number;
  setAudioVolume: (volume: number) => void;
};

export function AppShell({
  children,
  activeTheme,
  setActiveTheme,
  audioEnabled,
  setAudioEnabled,
  audioVolume,
  setAudioVolume,
}: AppShellProps) {
  return (
    <div className={`app-shell-v2 ${activeTheme === 'mahabharata' ? 'theme-mahabharata' : ''}`}>
      <AppHeader
        activeTheme={activeTheme}
        audioEnabled={audioEnabled}
        audioVolume={audioVolume}
        setActiveTheme={setActiveTheme}
        setAudioEnabled={setAudioEnabled}
        setAudioVolume={setAudioVolume}
      />
      <main className="app-main-v2">{children}</main>
      <footer className="app-footer-v2">
        <span>MIRROR local-first prototype</span>
        <Link to="/about">Credits and GPL notices</Link>
        <Link to="/about-project">About this project</Link>
      </footer>
    </div>
  );
}
