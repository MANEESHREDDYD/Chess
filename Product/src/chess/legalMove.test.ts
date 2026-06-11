import { describe, it, expect } from 'vitest';
import { checkLegalMove } from './legalMove';

// --- Test FENs ---
// Starting position
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// White pawn on e7, e8 empty so the pawn can promote (white to move).
// NOTE: the original fixture put the black king on e8 (and a second black
// king on h1), which made e7-e8 illegal by definition.
const WHITE_PROMO_FEN = '8/4P3/8/8/8/8/8/4K2k w - - 0 1';
// Black pawn on e2, can promote on e1 (black to move)
const BLACK_PROMO_FEN = '4k2K/8/8/8/8/8/4p3/RNBQ1BN1 b - - 0 1';
// White knight on g1, pawn on e2 (start-like, white to move)
const KNIGHT_FEN = '4k3/8/8/8/8/8/4P3/4K1N1 w - - 0 1';
// Black pawn on d5 (not near promotion, black to move)
const MID_PAWN_FEN = '4k3/8/8/3p4/8/8/8/4K3 b - - 0 1';

describe('checkLegalMove', () => {
  // --- Promotion Required ---

  it('White pawn e7→e8 requires promotion', () => {
    const result = checkLegalMove({ fen: WHITE_PROMO_FEN, from: 'e7', to: 'e8' });
    expect(result.legal).toBe(true);
    expect(result.requiresPromotion).toBe(true);
  });

  it('Black pawn e2→e1 requires promotion', () => {
    const result = checkLegalMove({ fen: BLACK_PROMO_FEN, from: 'e2', to: 'e1' });
    expect(result.legal).toBe(true);
    expect(result.requiresPromotion).toBe(true);
  });

  // --- Non-promotion pawn moves ---

  it('White pawn e2→e4 does NOT require promotion', () => {
    const result = checkLegalMove({ fen: START_FEN, from: 'e2', to: 'e4' });
    expect(result.legal).toBe(true);
    expect(result.requiresPromotion).toBe(false);
  });

  it('Black pawn e7→e5 does NOT require promotion (after 1.d4)', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';
    const result = checkLegalMove({ fen, from: 'e7', to: 'e5' });
    expect(result.legal).toBe(true);
    expect(result.requiresPromotion).toBe(false);
  });

  // --- Non-pawn pieces never promote ---

  it('Knight move never requires promotion', () => {
    const result = checkLegalMove({ fen: KNIGHT_FEN, from: 'g1', to: 'f3' });
    expect(result.legal).toBe(true);
    expect(result.requiresPromotion).toBe(false);
  });

  it('Bishop move never requires promotion', () => {
    const fen = '4k3/8/8/8/8/8/8/4K2B w - - 0 1';
    const result = checkLegalMove({ fen, from: 'h1', to: 'e4' });
    expect(result.legal).toBe(true);
    expect(result.requiresPromotion).toBe(false);
  });

  it('Rook move never requires promotion', () => {
    const fen = '4k3/8/8/8/8/8/8/R3K3 w Q - 0 1';
    const result = checkLegalMove({ fen, from: 'a1', to: 'a5' });
    expect(result.legal).toBe(true);
    expect(result.requiresPromotion).toBe(false);
  });

  it('Queen move never requires promotion', () => {
    const fen = '4k3/8/8/8/8/8/8/3QK3 w - - 0 1';
    const result = checkLegalMove({ fen, from: 'd1', to: 'd8' });
    expect(result.legal).toBe(true);
    expect(result.requiresPromotion).toBe(false);
  });

  it('King move never requires promotion', () => {
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    const result = checkLegalMove({ fen, from: 'e1', to: 'e2' });
    expect(result.legal).toBe(true);
    expect(result.requiresPromotion).toBe(false);
  });

  // --- Wrong-rank pawn ---

  it('Wrong-rank pawn move (d5→d4) does NOT require promotion', () => {
    const result = checkLegalMove({ fen: MID_PAWN_FEN, from: 'd5', to: 'd4' });
    expect(result.legal).toBe(true);
    expect(result.requiresPromotion).toBe(false);
  });

  // --- Illegal moves ---

  it('Illegal pawn move (e2→e5 from start) returns legal: false', () => {
    const result = checkLegalMove({ fen: START_FEN, from: 'e2', to: 'e5' });
    expect(result.legal).toBe(false);
    expect(result.requiresPromotion).toBe(false);
  });

  it('Moving empty square returns legal: false', () => {
    const result = checkLegalMove({ fen: START_FEN, from: 'e4', to: 'e5' });
    expect(result.legal).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('Invalid square format returns legal: false', () => {
    const result = checkLegalMove({ fen: START_FEN, from: 'z9', to: 'a1' });
    expect(result.legal).toBe(false);
    expect(result.reason).toContain('Invalid square');
  });

  // --- Promotion with specific piece ---

  it('Promotion with queen validates on final rank', () => {
    const result = checkLegalMove({ fen: WHITE_PROMO_FEN, from: 'e7', to: 'e8', promotion: 'q' });
    expect(result.legal).toBe(true);
    expect(result.requiresPromotion).toBe(false);
    expect(result.move?.promotion).toBe('q');
  });

  it('Promotion with rook validates on final rank', () => {
    const result = checkLegalMove({ fen: WHITE_PROMO_FEN, from: 'e7', to: 'e8', promotion: 'r' });
    expect(result.legal).toBe(true);
    expect(result.move?.promotion).toBe('r');
  });

  it('Promotion with bishop validates on final rank', () => {
    const result = checkLegalMove({ fen: WHITE_PROMO_FEN, from: 'e7', to: 'e8', promotion: 'b' });
    expect(result.legal).toBe(true);
    expect(result.move?.promotion).toBe('b');
  });

  it('Promotion with knight validates on final rank', () => {
    const result = checkLegalMove({ fen: WHITE_PROMO_FEN, from: 'e7', to: 'e8', promotion: 'n' });
    expect(result.legal).toBe(true);
    expect(result.move?.promotion).toBe('n');
  });

  // --- Promotion cannot be requested by non-pawn ---

  it('Non-pawn move with promotion param still returns requiresPromotion false', () => {
    const result = checkLegalMove({ fen: KNIGHT_FEN, from: 'g1', to: 'f3', promotion: 'q' });
    expect(result.legal).toBe(true);
    expect(result.requiresPromotion).toBe(false);
    // Promotion param is ignored for non-promotion moves
    expect(result.move?.promotion).toBeUndefined();
  });

  // --- Orientation does NOT affect legality ---

  it('Same FEN produces same legality regardless of hypothetical orientation', () => {
    // Orientation is a display concern. The FEN and from/to are always in
    // standard algebraic notation.
    const resultA = checkLegalMove({ fen: START_FEN, from: 'e2', to: 'e4' });
    const resultB = checkLegalMove({ fen: START_FEN, from: 'e2', to: 'e4' });
    expect(resultA.legal).toBe(resultB.legal);
    expect(resultA.requiresPromotion).toBe(resultB.requiresPromotion);
  });

  // --- Move data returned for legal moves ---

  it('Legal move returns san and from/to in move object', () => {
    const result = checkLegalMove({ fen: START_FEN, from: 'e2', to: 'e4' });
    expect(result.move).toBeDefined();
    expect(result.move!.from).toBe('e2');
    expect(result.move!.to).toBe('e4');
    expect(result.move!.san).toBeDefined();
  });

  // --- Invalid FEN ---

  it('Invalid FEN returns legal: false', () => {
    const result = checkLegalMove({ fen: 'not-a-fen', from: 'e2', to: 'e4' });
    expect(result.legal).toBe(false);
    expect(result.reason).toContain('FEN');
  });
});
