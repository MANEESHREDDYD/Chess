import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { isLegalPromotionMove, normalizePromotionPiece } from '../../chess/promotion';
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

type PendingPromotion = {
  from: string;
  to: string;
} | null;

export function BoardView({
  fen,
  playerColor,
  status,
  engineThinking,
  onPieceDrop,
  onPromotionCheck,
  themeManifest,
  themeError,
}: BoardViewProps) {
  const boardFrameRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(520);
  const [flashCapture, setFlashCapture] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [lastMoveSquares, setLastMoveSquares] = useState<string[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion>(null);
  const prevFenRef = useRef(fen);

  useEffect(() => {
    if (fen !== prevFenRef.current) {
      // Check if piece count decreased
      const countPieces = (f: string) => f.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
      if (countPieces(fen) < countPieces(prevFenRef.current)) {
        setFlashCapture(true);
        setTimeout(() => setFlashCapture(false), 400);
      }
      prevFenRef.current = fen;
      setPendingPromotion(null);
      setSelectedSquare(null);
    }
  }, [fen]);

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
        borderRadius: '10px',
        boxShadow: '0 18px 44px rgba(37, 27, 14, 0.28)',
        ...(themeManifest.board.background ? {
          backgroundImage: `url(${getThemeAssetUrl(themeManifest.id, themeManifest.board.background)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        } : {})
      }
    : {
        borderRadius: '10px',
        boxShadow: '0 18px 44px rgba(37, 27, 14, 0.2)',
      };

  const handleDrop = (sourceSquare: string, targetSquare: string): boolean => {
    setPendingPromotion(null);
    setSelectedSquare(null);
    if (status !== 'playing' || engineThinking) return false;
    const accepted = onPieceDrop(sourceSquare, targetSquare);
    if (accepted) setLastMoveSquares([sourceSquare, targetSquare]);
    return accepted;
  };

  const handlePromotionCheck = (sourceSquare: string, targetSquare: string, piece: string): boolean => {
    const isLegalPromotion = isLegalPromotionMove({
      fen,
      sourceSquare,
      targetSquare,
      piece,
    });
    if (status !== 'playing' || engineThinking || !isLegalPromotion) {
      setPendingPromotion(null);
      return false;
    }

    const routeAllowsPromotion = onPromotionCheck(sourceSquare, targetSquare, piece);
    if (!routeAllowsPromotion) {
      setPendingPromotion(null);
      return false;
    }

    setPendingPromotion({ from: sourceSquare, to: targetSquare });
    return true;
  };

  const handlePromotionPieceSelect = (piece?: string): boolean => {
    const promotion = normalizePromotionPiece(piece);
    if (!promotion || !pendingPromotion) {
      setPendingPromotion(null);
      return false;
    }

    const accepted = onPieceDrop(pendingPromotion.from, pendingPromotion.to, promotion);
    if (accepted) {
      setLastMoveSquares([pendingPromotion.from, pendingPromotion.to]);
    }
    setPendingPromotion(null);
    return accepted;
  };

  const boardHelpers = useMemo(() => {
    try {
      const chess = new Chess(fen);
      const selectedMoves = selectedSquare
        ? chess.moves({ square: selectedSquare as never, verbose: true }).map((move) => move.to)
        : [];
      const kingSquare = findCheckedKingSquare(chess);
      return { chess, selectedMoves, kingSquare };
    } catch {
      return { chess: null, selectedMoves: [], kingSquare: null };
    }
  }, [fen, selectedSquare]);

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    for (const square of lastMoveSquares) {
      styles[square] = {
        ...(styles[square] ?? {}),
        background: 'linear-gradient(135deg, rgba(210, 166, 76, 0.42), rgba(210, 166, 76, 0.18))',
      };
    }
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...(styles[selectedSquare] ?? {}),
        boxShadow: 'inset 0 0 0 3px rgba(255, 224, 138, 0.95)',
      };
    }
    for (const square of boardHelpers.selectedMoves) {
      const piece = boardHelpers.chess?.get(square as never);
      styles[square] = {
        ...(styles[square] ?? {}),
        background: piece
          ? 'radial-gradient(circle, rgba(139, 38, 53, 0.52) 34%, transparent 38%)'
          : 'radial-gradient(circle, rgba(30, 58, 95, 0.38) 18%, transparent 22%)',
      };
    }
    if (boardHelpers.kingSquare) {
      styles[boardHelpers.kingSquare] = {
        ...(styles[boardHelpers.kingSquare] ?? {}),
        boxShadow: 'inset 0 0 0 4px rgba(139, 38, 53, 0.9)',
      };
    }
    return styles;
  }, [boardHelpers, lastMoveSquares, selectedSquare]);

  const handleSquareClick = (square: string): void => {
    if (status !== 'playing' || engineThinking || !boardHelpers.chess) return;

    if (selectedSquare) {
      const selectedMove = boardHelpers.chess
        .moves({ square: selectedSquare as never, verbose: true })
        .find((move) => move.to === square);
      if (selectedMove) {
        if (selectedMove.promotion) {
          setPendingPromotion({ from: selectedSquare, to: square });
          return;
        }
        const accepted = onPieceDrop(selectedSquare, square);
        if (accepted) setLastMoveSquares([selectedSquare, square]);
        setSelectedSquare(null);
        return;
      }
    }

    const piece = boardHelpers.chess.get(square as never);
    const turnColor = boardHelpers.chess.turn();
    if (piece && piece.color === turnColor) {
      setSelectedSquare(square);
      return;
    }

    setSelectedSquare(null);
  };

  const isMahabharata = themeManifest?.id === 'mahabharata';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '520px' }}>
      {isMahabharata && (
        <div style={{ fontSize: '13px', color: 'var(--ink-soft)', fontWeight: 600, textAlign: playerColor === 'white' ? 'left' : 'right', opacity: 0.8 }}>
          {playerColor === 'white' ? 'Kaurava (Black)' : 'Pandava (White)'}
        </div>
      )}
      <div className={`board-frame ${flashCapture ? 'capture-flash' : ''}`} ref={boardFrameRef}>
        {themeError ? <p className="board-theme-error">Theme load failed: {themeError}</p> : null}
        <Chessboard
          position={fen}
          onPieceDrop={handleDrop}
          onPromotionCheck={handlePromotionCheck}
          onPromotionPieceSelect={handlePromotionPieceSelect}
          onSquareClick={handleSquareClick}
          boardOrientation={playerColor}
          boardWidth={boardWidth}
          customBoardStyle={boardStyle}
          customDarkSquareStyle={themeManifest ? { backgroundColor: themeManifest.board.darkSquare } : { backgroundColor: '#6f4c33' }}
          customLightSquareStyle={themeManifest ? { backgroundColor: themeManifest.board.lightSquare } : { backgroundColor: '#eadfc8' }}
          customSquareStyles={customSquareStyles}
          customPieces={customPieces}
          animationDuration={240}
          promotionDialogVariant="modal"
          arePremovesAllowed={false}
        />
      </div>
      {isMahabharata && (
        <div style={{ fontSize: '13px', color: 'var(--ink-soft)', fontWeight: 600, textAlign: playerColor === 'white' ? 'right' : 'left', opacity: 0.8 }}>
          {playerColor === 'white' ? 'Pandava (White)' : 'Kaurava (Black)'}
        </div>
      )}
    </div>
  );
}

function findCheckedKingSquare(chess: Chess): string | null {
  if (!chess.inCheck()) return null;
  const color = chess.turn();
  const board = chess.board();
  for (let rankIndex = 0; rankIndex < board.length; rankIndex += 1) {
    for (let fileIndex = 0; fileIndex < board[rankIndex].length; fileIndex += 1) {
      const piece = board[rankIndex][fileIndex];
      if (piece?.type === 'k' && piece.color === color) {
        return `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
      }
    }
  }
  return null;
}
