import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';

describe('game end conditions', () => {
  it('detects stalemate from a FEN position', () => {
    const game = new Chess('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1');

    expect(game.isStalemate()).toBe(true);
    expect(game.isGameOver()).toBe(true);
  });

  it('detects threefold repetition after a repeated move cycle', () => {
    const game = new Chess();

    game.move('Nf3');
    game.move('Nf6');
    game.move('Ng1');
    game.move('Ng8');
    game.move('Nf3');
    game.move('Nf6');
    game.move('Ng1');
    game.move('Ng8');

    expect(game.isThreefoldRepetition()).toBe(true);
    expect(game.isGameOver()).toBe(true);
  });

  it('detects insufficient material for king and knight versus king', () => {
    const game = new Chess('8/8/8/8/8/8/7N/Kk6 w - - 0 1');

    expect(game.isInsufficientMaterial()).toBe(true);
    expect(game.isGameOver()).toBe(true);
  });

  it('detects the fifty-move rule from the halfmove clock', () => {
    const game = new Chess('8/8/8/8/8/8/8/Kk6 w - - 100 1');

    expect(game.isDrawByFiftyMoves()).toBe(true);
    expect(game.isGameOver()).toBe(true);
  });

  it('allows a pawn promotion to the eighth rank', () => {
    const game = new Chess('4k3/3P4/8/8/8/8/8/4K3 w - - 0 1');

    const move = game.move({ from: 'd7', to: 'd8', promotion: 'q' });

    expect(move?.promotion).toBe('q');
    expect(game.get('d8')?.type).toBe('q');
    expect(game.get('d8')?.color).toBe('w');
  });
});