import { useGameStore } from '../../state/gameStore';
import { loadThemeManifest, isStandardTheme } from '../../lib/theme';
import { useSettingsStore } from '../../state/settingsStore';
import { useEffect, useState } from 'react';
import { BoardView } from './BoardView';

type Promotion = 'q' | 'r' | 'b' | 'n';

type PendingPromotion = {
  from: string;
  to: string;
} | null;

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
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion>(null);

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

  const handleDrop = (sourceSquare: string, targetSquare: string): boolean => {
    if (status !== 'playing' || engineThinking) return false;
    return makePlayerMove(sourceSquare, targetSquare);
  };

  const handlePromotionCheck = (
    sourceSquare: string,
    targetSquare: string,
    piece: string
  ): boolean => {
    if (piece[1] !== 'P') return false;

    const targetRank = targetSquare[1];
    const isWhitePromotion = piece[0] === 'w' && targetRank === '8';
    const isBlackPromotion = piece[0] === 'b' && targetRank === '1';
    if (!isWhitePromotion && !isBlackPromotion) return false;

    setPendingPromotion({ from: sourceSquare, to: targetSquare });
    return true;
  };

  const handlePromotionPieceSelect = (piece?: string): boolean => {
    if (!piece || !pendingPromotion) {
      setPendingPromotion(null);
      return false;
    }

    const promotion = piece[1].toLowerCase() as Promotion;
    const ok = makePlayerMove(pendingPromotion.from, pendingPromotion.to, promotion);
    setPendingPromotion(null);
    return ok;
  };

  return (
    <BoardView
      fen={position}
      playerColor={playerColor}
      status={status}
      engineThinking={engineThinking}
      onPieceDrop={handleDrop}
      onPromotionCheck={handlePromotionCheck}
      onPromotionPieceSelect={handlePromotionPieceSelect}
      themeManifest={themeManifest}
      themeError={themeError}
    />
  );
}
