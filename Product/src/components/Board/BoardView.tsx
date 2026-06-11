import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { isLegalPromotionMove, normalizePromotionPiece } from '../../chess/promotion';
import { getSquareFromPointer } from '../../chess/boardGeometry';
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
  /** Square currently under the pointer while dragging a piece (plus its
   *  stage-relative rect for the overlay ring). Owned by US, computed from
   *  the LIVE grid rect via boardGeometry: react-chessboard's own drop
   *  highlight tracks react-dnd hover state, which sticks to the source
   *  square, and the library also ignores customSquareStyles updates while a
   *  drag is active — so the ring is rendered as our own overlay. */
  const [dragTarget, setDragTarget] = useState<{
    square: string;
    left: number;
    top: number;
    size: number;
  } | null>(null);
  const dragTargetSquare = dragTarget?.square ?? null;
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
      setDragTarget(null);
    }
  }, [fen]);

  // Theme or orientation changes invalidate every transient interaction state
  // (selection, drop target, pending promotion, last-move tint) — a stale
  // highlight from the previous orientation would point at the wrong square.
  useEffect(() => {
    setSelectedSquare(null);
    setPendingPromotion(null);
    setLastMoveSquares([]);
    setDragTarget(null);
  }, [playerColor, themeManifest]);

  // Geometry-true drag-target tracking: on pointerdown over a piece, follow
  // the pointer with the live grid rect (a1..h8 union) so the highlighted
  // square is ALWAYS the square under the pointer — fresh rects every event,
  // so scroll, resize, zoom, and theme switches can never skew it.
  useEffect(() => {
    const stage = boardStageRef.current;
    if (!stage) return;

    const gridRect = () => {
      const a1 = stage.querySelector('[data-square="a1"]')?.getBoundingClientRect();
      const h8 = stage.querySelector('[data-square="h8"]')?.getBoundingClientRect();
      if (!a1 || !h8) return null;
      const left = Math.min(a1.left, h8.left);
      const top = Math.min(a1.top, h8.top);
      return {
        left,
        top,
        width: Math.max(a1.right, h8.right) - left,
        height: Math.max(a1.bottom, h8.bottom) - top,
      };
    };

    let tracking = false;

    const update = (event: { clientX: number; clientY: number }) => {
      if (!tracking) return;
      const rect = gridRect();
      if (!rect) return;
      const hit = getSquareFromPointer({
        boardRect: rect,
        clientX: event.clientX,
        clientY: event.clientY,
        orientation: playerColor,
      });
      if (!hit.inside || !hit.square) {
        setDragTarget(null);
        return;
      }
      // Stage-relative rect for the overlay ring (file/rank -> screen cell,
      // then offset by the stage's own rect).
      const stageRect = stage.getBoundingClientRect();
      const col = playerColor === 'white' ? (hit.file as number) : 7 - (hit.file as number);
      const row = playerColor === 'white' ? 7 - (hit.rank as number) : (hit.rank as number);
      const size = rect.width / 8;
      setDragTarget({
        square: hit.square,
        left: rect.left - stageRect.left + col * size,
        top: rect.top - stageRect.top + row * size,
        size,
      });
    };

    const stopTracking = () => {
      if (!tracking) return;
      tracking = false;
      setDragTarget(null);
      window.removeEventListener('pointermove', update, true);
      window.removeEventListener('dragover', update, true);
      window.removeEventListener('pointerup', stopTracking, true);
      window.removeEventListener('dragend', stopTracking, true);
      window.removeEventListener('drop', stopTracking, true);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest('[data-piece]')) return;
      tracking = true;
      // `pointermove` covers pointer-based drags; once an HTML5 drag starts
      // the browser silences pointer events (after a pointercancel) and fires
      // `dragover` instead — listen to both so tracking never goes blind.
      // (`pointercancel` is deliberately NOT a stop signal for that reason.)
      window.addEventListener('pointermove', update, true);
      window.addEventListener('dragover', update, true);
      window.addEventListener('pointerup', stopTracking, true);
      window.addEventListener('dragend', stopTracking, true);
      window.addEventListener('drop', stopTracking, true);
      update(event);
    };

    // Capture phase: the board library stops propagation on piece pointerdown,
    // which would silently disable bubbling listeners here.
    stage.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      stage.removeEventListener('pointerdown', onPointerDown, true);
      stopTracking();
    };
  }, [playerColor]);

  // Announce board layout so shell-level placement logic (the appearance
  // switch dodge) can react synchronously instead of waiting for a poll tick.
  useEffect(() => {
    window.dispatchEvent(new Event('mirror:board-layout'));
    return () => {
      window.dispatchEvent(new Event('mirror:board-layout'));
    };
  }, []);

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
      <div
        className="board-stage"
        ref={boardStageRef}
        data-qa="board-stage"
        data-drag-target={dragTargetSquare ?? ''}
      >
        {dragTarget ? (
          <div
            className="board-drag-ring"
            data-qa="drag-ring"
            data-square={dragTarget.square}
            style={{
              left: `${dragTarget.left}px`,
              top: `${dragTarget.top}px`,
              width: `${dragTarget.size}px`,
              height: `${dragTarget.size}px`,
            }}
            aria-hidden="true"
          />
        ) : null}
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
            /* react-dnd hover state can stick to the SOURCE square, painting
               the drop ring away from the pointer — our geometry-true
               dragTargetSquare (customSquareStyles) replaces it. */
            customDropSquareStyle={{}}
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
