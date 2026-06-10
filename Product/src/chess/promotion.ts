import { Chess } from 'chess.js';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export type PromotionCheckInput = {
  fen: string;
  sourceSquare: string;
  targetSquare: string;
  piece?: string;
};

const PROMOTION_PIECES = new Set<PromotionPiece>(['q', 'r', 'b', 'n']);
const SQUARE_PATTERN = /^[a-h][1-8]$/;

export function normalizePromotionPiece(piece?: string): PromotionPiece | null {
  if (!piece) return null;
  const symbol = piece.length >= 2 ? piece[piece.length - 1].toLowerCase() : piece.toLowerCase();
  return PROMOTION_PIECES.has(symbol as PromotionPiece) ? (symbol as PromotionPiece) : null;
}

export function isLegalPromotionMove({
  fen,
  sourceSquare,
  targetSquare,
  piece,
}: PromotionCheckInput): boolean {
  if (!SQUARE_PATTERN.test(sourceSquare) || !SQUARE_PATTERN.test(targetSquare)) return false;

  try {
    const chess = new Chess(fen);
    const boardPiece = chess.get(sourceSquare as never);
    if (!boardPiece || boardPiece.type !== 'p') return false;

    if (piece) {
      const pieceColor = piece[0] === 'w' ? 'w' : piece[0] === 'b' ? 'b' : null;
      const pieceType = piece.length >= 2 ? piece[1].toLowerCase() : piece.toLowerCase();
      if (pieceType !== 'p') return false;
      if (pieceColor && pieceColor !== boardPiece.color) return false;
    }

    const targetRank = targetSquare[1];
    const reachesPromotionRank =
      (boardPiece.color === 'w' && targetRank === '8') ||
      (boardPiece.color === 'b' && targetRank === '1');
    if (!reachesPromotionRank) return false;

    return chess
      .moves({ square: sourceSquare as never, verbose: true })
      .some((move) => {
        const promotedPiece = normalizePromotionPiece(String(move.promotion ?? ''));
        return move.from === sourceSquare && move.to === targetSquare && Boolean(promotedPiece);
      });
  } catch {
    return false;
  }
}
