import { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { useGameStore } from '../../state/gameStore';

type Promotion = 'q' | 'r' | 'b' | 'n';

export function Board() {
  const position = useGameStore((s) => s.fen);
  const playerColor = useGameStore((s) => s.playerColor);
  const status = useGameStore((s) => s.status);
  const engineThinking = useGameStore((s) => s.engineThinking);
  const makePlayerMove = useGameStore((s) => s.makePlayerMove);

  // Pending promotion state — when react-chessboard detects a promotion drag,
  // we hold it here until the user picks a piece.
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const handleDrop = (sourceSquare: string, targetSquare: string): boolean => {
    if (status !== 'playing' || engineThinking) return false;
    // Non-promotion path. Promotion is handled by onPromotionCheck +
    // onPromotionPieceSelect, not by this handler.
    return makePlayerMove(sourceSquare, targetSquare);
  };

  // react-chessboard v4 calls this BEFORE drop to ask "is this a promotion?"
  // Return true to open the promotion piece picker UI, false to fall through to onPieceDrop.
  const onPromotionCheck = (
    sourceSquare: string,
    targetSquare: string,
    piece: string
  ): boolean => {
    // piece is like 'wP' or 'bP'. Promotion only happens for pawns reaching the back rank.
    if (piece[1] !== 'P') return false;
    const targetRank = targetSquare[1];
    const isWhitePromotion = piece[0] === 'w' && targetRank === '8';
    const isBlackPromotion = piece[0] === 'b' && targetRank === '1';
    if (!isWhitePromotion && !isBlackPromotion) return false;
    // Cache so onPromotionPieceSelect can use these squares.
    setPendingPromotion({ from: sourceSquare, to: targetSquare });
    return true;
  };

  // Called when the user clicks a piece in the promotion picker, or when picker is cancelled.
  // Returning true tells the library the move was applied; false reverts the board.
  const onPromotionPieceSelect = (piece?: string): boolean => {
    if (!piece || !pendingPromotion) {
      setPendingPromotion(null);
      return false;
    }
    // piece is like 'wQ' or 'bN'. Lowercase the second char for chess.js.
    const promotion = piece[1].toLowerCase() as Promotion;
    const ok = makePlayerMove(pendingPromotion.from, pendingPromotion.to, promotion);
    setPendingPromotion(null);
    return ok;
  };

  return (
    <div className="board-frame">
      <Chessboard
        position={position}
        onPieceDrop={handleDrop}
        onPromotionCheck={onPromotionCheck}
        onPromotionPieceSelect={onPromotionPieceSelect}
        boardOrientation={playerColor}
        boardWidth={520}
        customBoardStyle={{
          borderRadius: '4px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
        customDarkSquareStyle={{ backgroundColor: '#5c3e2a' }}
        customLightSquareStyle={{ backgroundColor: '#e8dcc4' }}
        animationDuration={240}
        arePremovesAllowed={false}
      />
    </div>
  );
}
