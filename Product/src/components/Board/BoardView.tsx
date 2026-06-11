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

const MAX_BOARD_WIDTH = 680;
/* Board frame chrome (padding + border) that sits around the chessboard. */
const FRAME_CHROME_PX = 18;

/* Tournament-neutral Classic board (MIRROR Mono Signal). Warm colors are
   allowed only inside themed (Kurukshetra) board squares, never the shell. */
const CLASSIC_LIGHT_SQUARE = '#e8eaed';
const CLASSIC_DARK_SQUARE = '#a8b4c0';

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
  const boardStageRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(480);
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
    const stage = boardStageRef.current;
    if (!stage) return;

    // Measure the board-stage, whose width is fully CSS-determined (grid
    // column capped by viewport height) and never stretched by the rendered
    // chessboard itself. Measuring a content-driven box here previously
    // created a resize feedback loop that inflated the board past its column.
    const syncBoardWidth = () => {
      const width = Math.floor(stage.clientWidth) - FRAME_CHROME_PX;
      if (width > 0) setBoardWidth(Math.min(MAX_BOARD_WIDTH, width));
    };

    syncBoardWidth();
    const observer = new ResizeObserver(syncBoardWidth);
    observer.observe(stage);
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
              // Pieces occupy ~82% of the square (Phase 9) so they never spill
              // outside the board or read as oversized.
              width: squareWidth ? `${Math.round(squareWidth * 0.82)}px` : '82%',
              height: squareWidth ? `${Math.round(squareWidth * 0.82)}px` : '82%',
              margin: squareWidth ? `${Math.round(squareWidth * 0.09)}px` : '9%',
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
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.22)',
        ...(themeManifest.board.background ? {
          backgroundImage: `url(${getThemeAssetUrl(themeManifest.id, themeManifest.board.background)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        } : {})
      }
    : {
        borderRadius: '10px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
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
    // Functional interaction layer (Mono Signal): blue = selection/last move,
    // red = check only. No gold decoration on the board.
    const styles: Record<string, CSSProperties> = {};
    for (const square of lastMoveSquares) {
      styles[square] = {
        ...(styles[square] ?? {}),
        background: 'rgba(10, 132, 255, 0.26)',
      };
    }
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...(styles[selectedSquare] ?? {}),
        boxShadow: 'inset 0 0 0 3px rgba(10, 132, 255, 0.9)',
      };
    }
    for (const square of boardHelpers.selectedMoves) {
      const piece = boardHelpers.chess?.get(square as never);
      styles[square] = {
        ...(styles[square] ?? {}),
        background: piece
          ? 'radial-gradient(circle, rgba(10, 132, 255, 0.45) 34%, transparent 38%)'
          : 'radial-gradient(circle, rgba(10, 132, 255, 0.34) 18%, transparent 22%)',
      };
    }
    if (boardHelpers.kingSquare) {
      styles[boardHelpers.kingSquare] = {
        ...(styles[boardHelpers.kingSquare] ?? {}),
        boxShadow: 'inset 0 0 0 4px rgba(255, 69, 58, 0.9)',
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
    <div className="board-shell">
      {isMahabharata && (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, textAlign: playerColor === 'white' ? 'left' : 'right', opacity: 0.8 }}>
          {playerColor === 'white' ? 'Kaurava (Black)' : 'Pandava (White)'}
        </div>
      )}
      <div className="board-stage" ref={boardStageRef} data-qa="board-stage">
        <div className={`board-frame ${flashCapture ? 'capture-flash' : ''}`}>
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
            customDarkSquareStyle={themeManifest ? { backgroundColor: themeManifest.board.darkSquare } : { backgroundColor: CLASSIC_DARK_SQUARE }}
            customLightSquareStyle={themeManifest ? { backgroundColor: themeManifest.board.lightSquare } : { backgroundColor: CLASSIC_LIGHT_SQUARE }}
            customSquareStyles={customSquareStyles}
            customPieces={customPieces}
            animationDuration={180}
            promotionDialogVariant="modal"
            arePremovesAllowed={false}
          />
        </div>
      </div>
      {isMahabharata && (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, textAlign: playerColor === 'white' ? 'right' : 'left', opacity: 0.8 }}>
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
