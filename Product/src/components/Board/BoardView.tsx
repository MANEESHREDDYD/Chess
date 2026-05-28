import { useEffect, useMemo, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { getThemeAssetUrl, type ThemeManifest } from '../../lib/theme';

type Color = 'white' | 'black';
type Status = 'idle' | 'playing' | 'game-over';
type Promotion = 'q' | 'r' | 'b' | 'n';

type BoardViewProps = {
  fen: string;
  playerColor: Color;
  status: Status;
  engineThinking: boolean;
  onPieceDrop: (from: string, to: string, promotion?: Promotion) => boolean;
  onPromotionCheck: (sourceSquare: string, targetSquare: string, piece: string) => boolean;
  onPromotionPieceSelect: (piece?: string) => boolean;
  themeManifest: ThemeManifest | null;
  themeError?: string | null;
};

type CustomPieceRendererProps = {
  squareWidth?: number;
};

export function BoardView({
  fen,
  playerColor,
  status,
  engineThinking,
  onPieceDrop,
  onPromotionCheck,
  onPromotionPieceSelect,
  themeManifest,
  themeError,
}: BoardViewProps) {
  const boardFrameRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(520);

  useEffect(() => {
    const frame = boardFrameRef.current;
    if (!frame) return;

    const syncBoardWidth = () => {
      const width = Math.floor(frame.clientWidth);
      if (width > 0) setBoardWidth(Math.min(520, width));
    };

    syncBoardWidth();
    const observer = new ResizeObserver(syncBoardWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const customPieces = useMemo(() => {
    if (!themeManifest) return undefined;

    return Object.fromEntries(
      Object.entries(themeManifest.pieces).map(([pieceKey, assetPath]) => [
        pieceKey,
        ({ squareWidth }: CustomPieceRendererProps) => (
          <img
            alt=""
            draggable={false}
            src={getThemeAssetUrl(themeManifest.id, assetPath)}
            style={{
              width: squareWidth ? `${squareWidth}px` : '100%',
              height: squareWidth ? `${squareWidth}px` : '100%',
              pointerEvents: 'none',
              userSelect: 'none',
              objectFit: 'contain',
            }}
          />
        ),
      ])
    );
  }, [themeManifest]);

  const boardStyle: Record<string, string | number> = themeManifest
    ? {
        borderRadius: '4px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        backgroundImage: `url(${getThemeAssetUrl(themeManifest.id, themeManifest.board.background)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : {
        borderRadius: '4px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      };

  const handleDrop = (sourceSquare: string, targetSquare: string): boolean => {
    if (status !== 'playing' || engineThinking) return false;
    return onPieceDrop(sourceSquare, targetSquare);
  };

  return (
    <div className="board-frame" ref={boardFrameRef}>
      {themeError ? <p className="board-theme-error">Theme load failed: {themeError}</p> : null}
      <Chessboard
        position={fen}
        onPieceDrop={handleDrop}
        onPromotionCheck={onPromotionCheck}
        onPromotionPieceSelect={onPromotionPieceSelect}
        boardOrientation={playerColor}
        boardWidth={boardWidth}
        customBoardStyle={boardStyle}
        customDarkSquareStyle={themeManifest ? { backgroundColor: themeManifest.board.darkSquare } : { backgroundColor: '#5c3e2a' }}
        customLightSquareStyle={themeManifest ? { backgroundColor: themeManifest.board.lightSquare } : { backgroundColor: '#e8dcc4' }}
        customPieces={customPieces}
        animationDuration={240}
        arePremovesAllowed={false}
      />
    </div>
  );
}
