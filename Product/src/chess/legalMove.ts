/**
 * Centralized legal move validation using chess.js.
 *
 * This is the single source of truth for whether a move is legal and whether
 * it requires promotion. Route-level handlers must NOT decide legality
 * independently — they delegate here.
 *
 * IMPORTANT: A fresh Chess instance is created for every check so the caller's
 * live game object is never mutated during validation.
 */

import { Chess } from 'chess.js';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export type LegalMoveCheck = {
  legal: boolean;
  requiresPromotion: boolean;
  reason?: string;
  move?: {
    from: string;
    to: string;
    promotion?: PromotionPiece;
    san?: string;
    lan?: string;
  };
};

const SQUARE_RE = /^[a-h][1-8]$/;
const PROMO_SET = new Set<PromotionPiece>(['q', 'r', 'b', 'n']);

/**
 * Check whether a move is legal and whether it requires promotion.
 *
 * If `promotion` is supplied the move is validated as a promotion move.
 * If `promotion` is omitted but the move is a legal pawn-to-final-rank move,
 * the return value has `requiresPromotion: true` — the caller should show a
 * promotion dialog and then call again with the chosen piece.
 */
export function checkLegalMove(params: {
  fen: string;
  from: string;
  to: string;
  promotion?: PromotionPiece;
}): LegalMoveCheck {
  const { fen, from, to, promotion } = params;

  // --- Input guard ---
  if (!SQUARE_RE.test(from) || !SQUARE_RE.test(to)) {
    return { legal: false, requiresPromotion: false, reason: 'Invalid square format' };
  }

  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return { legal: false, requiresPromotion: false, reason: 'Invalid FEN' };
  }

  // Get the piece on the source square
  const piece = chess.get(from as never);
  if (!piece) {
    return { legal: false, requiresPromotion: false, reason: 'No piece on source square' };
  }

  // Get all legal moves from the source square
  const legalMoves = chess.moves({ square: from as never, verbose: true });
  // Find legal moves that end on the target square
  const matchingMoves = legalMoves.filter((m) => m.to === to);

  if (matchingMoves.length === 0) {
    return { legal: false, requiresPromotion: false, reason: 'No legal move from source to target' };
  }

  // Check if any of the matching moves are promotions (chess.js sets the
  // `promotion` flag on pawn-to-final-rank moves).
  const promotionMoves = matchingMoves.filter((m) => m.promotion);
  const isPromotionMove = promotionMoves.length > 0;

  // --- Non-promotion case ---
  if (!isPromotionMove) {
    // The move is legal and does not require promotion.
    // If the caller supplied a promotion piece anyway, ignore it (non-pawn or
    // non-final-rank pawn — promotion is irrelevant).
    const m = matchingMoves[0];
    return {
      legal: true,
      requiresPromotion: false,
      move: {
        from: m.from,
        to: m.to,
        san: m.san,
        lan: m.lan,
      },
    };
  }

  // --- Promotion case ---
  // The move involves a pawn reaching its final rank. chess.js requires a
  // `promotion` value to actually execute the move.

  if (!promotion) {
    // Caller did not specify promotion piece — tell them they must.
    return {
      legal: true,
      requiresPromotion: true,
      reason: 'Pawn reaches final rank — choose promotion piece',
    };
  }

  // Validate the chosen promotion piece
  if (!PROMO_SET.has(promotion)) {
    return {
      legal: false,
      requiresPromotion: true,
      reason: `Invalid promotion piece: ${promotion}`,
    };
  }

  // Find the exact move matching the chosen promotion
  const exactPromo = promotionMoves.find((m) => m.promotion === promotion);
  if (!exactPromo) {
    return {
      legal: false,
      requiresPromotion: true,
      reason: `Promotion to ${promotion} is not legal here`,
    };
  }

  return {
    legal: true,
    requiresPromotion: false,
    move: {
      from: exactPromo.from,
      to: exactPromo.to,
      promotion,
      san: exactPromo.san,
      lan: exactPromo.lan,
    },
  };
}
