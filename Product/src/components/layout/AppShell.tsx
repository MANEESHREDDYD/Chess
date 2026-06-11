import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { AppearanceToggle, type UiTheme } from './AppearanceToggle';
import { cx } from '../ui/classNames';

const UI_THEME_STORAGE_KEY = 'mirror-ui-theme';

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
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => readStoredUiTheme());

  useEffect(() => {
    try {
      window.localStorage?.setItem(UI_THEME_STORAGE_KEY, uiTheme);
    } catch {
      /* storage may be unavailable (private mode / sandboxed contexts) */
    }
    if (typeof document !== 'undefined') {
      // MIRROR Nova reads tokens from html[data-ui-theme]; the legacy
      // attribute/classes keep not-yet-migrated routes themed during migration.
      document.documentElement.dataset.uiTheme = uiTheme;
      document.documentElement.dataset.mirrorUiTheme = uiTheme;
      document.documentElement.style.colorScheme = uiTheme;
    }
  }, [uiTheme]);

  // The appearance switch must never cover board squares at rest. Dodge
  // ladder: bottom-right (default) -> bottom-left -> top-right, re-evaluated
  // on resize and on a cheap interval that catches route/layout changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => {
      const toggle = document.querySelector('.nova-appearance');
      if (!toggle) return;
      const boards = [...document.querySelectorAll('.board-frame, .battlefield-stage')];
      const overlapsBoard = () => {
        const r = toggle.getBoundingClientRect();
        return boards.some((b) => {
          const x = b.getBoundingClientRect();
          if (x.width === 0) return false;
          return !(r.right < x.left || r.left > x.right || r.bottom < x.top || r.top > x.bottom);
        });
      };
      toggle.removeAttribute('data-dodge');
      if (!overlapsBoard()) return;
      toggle.setAttribute('data-dodge', 'left');
      if (overlapsBoard()) toggle.setAttribute('data-dodge', 'raise');
    };
    update();
    window.addEventListener('resize', update);
    // Boards can mount asynchronously (player/profile loads, route data), so
    // react to DOM changes immediately instead of waiting for the next tick.
    let raf = 0;
    const observer = new MutationObserver(() => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(update, 800);
    return () => {
      window.removeEventListener('resize', update);
      observer.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div
      className={cx('nova-shell', 'app-shell-v2', `ui-theme-${uiTheme}`, activeTheme === 'mahabharata' && 'theme-mahabharata')}
      data-ui-theme={uiTheme}
    >
      <AppHeader
        activeTheme={activeTheme}
        audioEnabled={audioEnabled}
        audioVolume={audioVolume}
        setActiveTheme={setActiveTheme}
        setAudioEnabled={setAudioEnabled}
        setAudioVolume={setAudioVolume}
      />
      <main className="nova-main">{children}</main>
      <AppearanceToggle theme={uiTheme} setTheme={setUiTheme} />
      <footer className="nova-footer">
        <span>MIRROR local-first command center</span>
        <Link to="/about">Credits and GPL notices</Link>
        <Link to="/about-project">About this project</Link>
      </footer>
    </div>
  );
}

function readStoredUiTheme(): UiTheme {
  try {
    return window.localStorage?.getItem(UI_THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
