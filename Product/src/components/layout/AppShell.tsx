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
      const boardRects = [...document.querySelectorAll('.board-frame, .battlefield-stage')]
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.width > 0);

      // Candidate placements computed geometrically (mirrors the CSS), so the
      // toggle is never moved just to measure it — no transient default-
      // position frame that screenshots/users could catch over the board.
      const SIZE = 40;
      const MARGIN = 16;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const bottomOffset = vw <= 900 ? 74 : MARGIN; // matches the ≤900px CSS rule
      const headerH = document.querySelector('.nova-header')?.getBoundingClientRect().height ?? 64;
      const candidates: Array<{ dodge: string | null; left: number; top: number }> = [
        { dodge: null, left: vw - MARGIN - SIZE, top: vh - bottomOffset - SIZE },
        { dodge: 'left', left: MARGIN, top: vh - bottomOffset - SIZE },
        { dodge: 'raise', left: vw - MARGIN - SIZE, top: headerH + 12 },
      ];
      const clear = (c: { left: number; top: number }) =>
        boardRects.every(
          (b) => c.left + SIZE < b.left || c.left > b.right || c.top + SIZE < b.top || c.top > b.bottom
        );
      const pick = candidates.find(clear) ?? candidates[0];
      if (pick.dodge === null) toggle.removeAttribute('data-dodge');
      else if (toggle.getAttribute('data-dodge') !== pick.dodge) toggle.setAttribute('data-dodge', pick.dodge);
    };
    update();
    window.addEventListener('resize', update);
    // Boards announce mount/unmount; re-evaluate after their layout settles.
    const onBoardLayout = () => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(update));
    };
    window.addEventListener('mirror:board-layout', onBoardLayout);
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
    const interval = window.setInterval(update, 300);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('mirror:board-layout', onBoardLayout);
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
