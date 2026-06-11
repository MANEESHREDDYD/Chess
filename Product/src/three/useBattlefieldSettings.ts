import { useCallback, useEffect, useState } from 'react';

export type BoardRenderMode = '2d' | '3d';

const STORAGE_KEY = 'mirror-board-render-mode';

export function detectWebGl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type BattlefieldSettings = {
  /** What the user asked for (persisted). */
  requestedMode: BoardRenderMode;
  setRequestedMode: (mode: BoardRenderMode) => void;
  /** What we can actually render after WebGL/reduced-motion gating. */
  effectiveMode: BoardRenderMode;
  /** Why 3D was refused (for the quiet fallback notice). Null when effective=requested. */
  fallbackReason: 'no-webgl' | 'reduced-motion' | null;
  webGlAvailable: boolean;
  reducedMotion: boolean;
};

/**
 * 2D/3D board mode with hard fallbacks. 3D is available on EVERY device and
 * viewport size (user requirement) — only a missing WebGL context or the
 * user's own reduced-motion preference resolves to the stable 2D board.
 * Small screens simply render the scene at a capped device-pixel ratio.
 */
export function useBattlefieldSettings(): BattlefieldSettings {
  const [requestedMode, setRequestedModeState] = useState<BoardRenderMode>(() => {
    try {
      return window.localStorage?.getItem(STORAGE_KEY) === '3d' ? '3d' : '2d';
    } catch {
      return '2d';
    }
  });
  const [webGlAvailable] = useState<boolean>(() => detectWebGl());
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotion = () => setReducedMotion(media?.matches ?? false);
    media?.addEventListener?.('change', onMotion);
    return () => {
      media?.removeEventListener?.('change', onMotion);
    };
  }, []);

  const setRequestedMode = useCallback((mode: BoardRenderMode) => {
    setRequestedModeState(mode);
    try {
      window.localStorage?.setItem(STORAGE_KEY, mode);
    } catch {
      /* storage unavailable — mode stays session-local */
    }
  }, []);

  let fallbackReason: BattlefieldSettings['fallbackReason'] = null;
  if (requestedMode === '3d') {
    if (!webGlAvailable) fallbackReason = 'no-webgl';
    else if (reducedMotion) fallbackReason = 'reduced-motion';
  }

  return {
    requestedMode,
    setRequestedMode,
    effectiveMode: requestedMode === '3d' && fallbackReason === null ? '3d' : '2d',
    fallbackReason,
    webGlAvailable,
    reducedMotion,
  };
}
