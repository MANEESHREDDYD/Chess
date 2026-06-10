import { describe, expect, it } from 'vitest';
import { detectKeyMoments, markTurningPoints } from './keyMomentDetector';
import type { MoveReview } from './reviewTypes';

describe('keyMomentDetector', () => {
  it('detects largest loss, swing, repeated pattern, and marks turning points', () => {
    const moves: MoveReview[] = [
      makeMove(1, 'e4', 0, 'best', ['unknown'], 20, 20),
      makeMove(2, 'e5', 90, 'inaccuracy', ['pin'], 30, -80),
      makeMove(3, 'Qh5', 270, 'blunder', ['pin', 'queen_move_early'], 120, -180),
      makeMove(4, 'Nc6', 130, 'mistake', ['pin'], 50, -90),
    ];

    const moments = detectKeyMoments(moves);
    const marked = markTurningPoints(moves, moments);

    expect(moments.some((moment) => moment.type === 'largest_cp_loss')).toBe(true);
    expect(moments.some((moment) => moment.type === 'first_major_blunder')).toBe(true);
    expect(moments.some((moment) => moment.type === 'repeated_pattern')).toBe(true);
    expect(marked.find((move) => move.ply === 3)?.is_turning_point).toBe(true);
  });
});

function makeMove(
  ply: number,
  san: string,
  cpLoss: number,
  classification: MoveReview['classification'],
  motifTags: string[],
  evalBefore: number,
  evalAfter: number
): MoveReview {
  return {
    ply,
    move_number: Math.ceil(ply / 2),
    san,
    fen_before: 'fen',
    side: ply % 2 ? 'white' : 'black',
    eval_before: evalBefore,
    eval_after: evalAfter,
    best_move: 'e2e4',
    cp_loss: cpLoss,
    classification,
    phase: ply < 4 ? 'opening' : 'middlegame',
    motif_tags: motifTags,
    is_turning_point: false,
    retry_available: true,
    explanation: 'fixture',
    evidence: ['fixture evidence'],
  };
}
