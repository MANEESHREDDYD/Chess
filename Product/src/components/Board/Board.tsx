import { useGameStore } from '../../state/gameStore';
import { loadThemeManifest, isStandardTheme } from '../../lib/theme';
import { useSettingsStore } from '../../state/settingsStore';
import { useEffect, useState } from 'react';
import { BoardView } from './BoardView';

type Promotion = 'q' | 'r' | 'b' | 'n';

export function Board() {
  const activeTheme = useSettingsStore((s) => s.activeTheme);
  const position = useGameStore((s) => s.fen);
  const playerColor = useGameStore((s) => s.playerColor);
  const status = useGameStore((s) => s.status);
  const engineThinking = useGameStore((s) => s.engineThinking);
  const makePlayerMove = useGameStore((s) => s.makePlayerMove);
  const [themeManifest, setThemeManifest] = useState<Awaited<ReturnType<typeof loadThemeManifest>>>(
    null
  );
  const [themeError, setThemeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTheme() {
      if (isStandardTheme(activeTheme)) {
        setThemeManifest(null);
        setThemeError(null);
        return;
      }

      try {
        const manifest = await loadThemeManifest(activeTheme);
        if (!cancelled) {
          setThemeManifest(manifest);
          setThemeError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setThemeManifest(null);
          setThemeError(error instanceof Error ? error.message : 'Failed to load theme.');
        }
      }
    }

    void loadTheme();

    return () => {
      cancelled = true;
    };
  }, [activeTheme]);

  const handleDrop = (sourceSquare: string, targetSquare: string, promotion?: Promotion): boolean => {
    if (status !== 'playing' || engineThinking) return false;
    return makePlayerMove(sourceSquare, targetSquare, promotion);
  };

  return (
    <BoardView
      fen={position}
      playerColor={playerColor}
      status={status}
      engineThinking={engineThinking}
      onPieceDrop={handleDrop}
      onPromotionCheck={() => true}
      onPromotionPieceSelect={() => false}
      themeManifest={themeManifest}
      themeError={themeError}
    />
  );
}
