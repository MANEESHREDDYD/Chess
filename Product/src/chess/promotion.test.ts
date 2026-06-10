import { describe, expect, it } from 'vitest';
import { isLegalPromotionMove, normalizePromotionPiece } from './promotion';

describe('promotion legality', () => {
  const pieceFen = '4k3/8/8/8/8/8/8/RNBQKBNR w KQ - 0 1';

  it.each([
    ['knight', 'b1', 'b8', 'wN'],
    ['bishop', 'c1', 'c8', 'wB'],
    ['rook', 'a1', 'a8', 'wR'],
    ['queen', 'd1', 'd8', 'wQ'],
    ['king', 'e1', 'e2', 'wK'],
  ])('%s move never triggers promotion', (_label, sourceSquare, targetSquare, piece) => {
    expect(isLegalPromotionMove({ fen: pieceFen, sourceSquare, targetSquare, piece })).toBe(false);
  });

  it('allows a white pawn to promote only on rank 8', () => {
    expect(
      isLegalPromotionMove({
        fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
        sourceSquare: 'a7',
        targetSquare: 'a8',
        piece: 'wP',
      })
    ).toBe(true);

    expect(
      isLegalPromotionMove({
        fen: '4k3/8/P7/8/8/8/8/4K3 w - - 0 1',
        sourceSquare: 'a6',
        targetSquare: 'a7',
        piece: 'wP',
      })
    ).toBe(false);
  });

  it('allows a black pawn to promote only on rank 1', () => {
    expect(
      isLegalPromotionMove({
        fen: '4k3/8/8/8/8/8/p7/4K3 b - - 0 1',
        sourceSquare: 'a2',
        targetSquare: 'a1',
        piece: 'bP',
      })
    ).toBe(true);

    expect(
      isLegalPromotionMove({
        fen: '4k3/8/8/8/8/p7/8/4K3 b - - 0 1',
        sourceSquare: 'a3',
        targetSquare: 'a2',
        piece: 'bP',
      })
    ).toBe(false);
  });

  it('requires the legal engine to expose the move as a promotion', () => {
    expect(
      isLegalPromotionMove({
        fen: '4k3/8/P7/8/8/8/8/4K3 w - - 0 1',
        sourceSquare: 'a6',
        targetSquare: 'a8',
        piece: 'wP',
      })
    ).toBe(false);
  });

  it('does not depend on board orientation state', () => {
    const input = {
      fen: '4k3/7P/8/8/8/8/8/4K3 w - - 0 1',
      sourceSquare: 'h7',
      targetSquare: 'h8',
      piece: 'wP',
    };
    expect(isLegalPromotionMove(input)).toBe(true);
    expect(isLegalPromotionMove({ ...input, piece: 'wP' })).toBe(true);
  });

  it('normalizes promotion pieces from react-chessboard and SAN-like inputs', () => {
    expect(normalizePromotionPiece('wQ')).toBe('q');
    expect(normalizePromotionPiece('bN')).toBe('n');
    expect(normalizePromotionPiece('r')).toBe('r');
    expect(normalizePromotionPiece('wP')).toBe(null);
    expect(normalizePromotionPiece(undefined)).toBe(null);
  });
});
