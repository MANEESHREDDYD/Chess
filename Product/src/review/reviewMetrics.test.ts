import { describe, expect, it } from 'vitest';
import { computeReviewMetrics, estimateAccuracyFromCpLoss } from './reviewMetrics';
import type { MoveReview } from './reviewTypes';

describe('reviewMetrics', () => {
  it('keeps accuracy estimates bounded', () => {
    expect(estimateAccuracyFromCpLoss(0)).toBe(100);
    expect(estimateAccuracyFromCpLoss(100)).toBe(55);
    expect(estimateAccuracyFromCpLoss(1000)).toBe(0);
  });

  it('computes side and phase summaries', () => {
    const moves: MoveReview[] = [
      makeMove({ ply: 1, side: 'white', cpLoss: 0, classification: 'best', phase: 'opening' }),
      makeMove({ ply: 2, side: 'black', cpLoss: 80, classification: 'inaccuracy', phase: 'opening' }),
      makeMove({ ply: 3, side: 'white', cpLoss: 260, classification: 'blunder', phase: 'middlegame' }),
      makeMove({ ply: 4, side: 'black', cpLoss: 140, classification: 'mistake', phase: 'endgame' }),
    ];

    const metrics = computeReviewMetrics(moves);

    expect(metrics.white.average_cp_loss).toBe(130);
    expect(metrics.white.blunder_count).toBe(1);
    expect(metrics.black.mistake_count).toBe(1);
    expect(metrics.phase_summary.weakest_phase).toBe('middlegame');
  });
});

function makeMove(args: {
  ply: number;
  side: 'white' | 'black';
  cpLoss: number;
  classification: MoveReview['classification'];
  phase: MoveReview['phase'];
}): MoveReview {
  return {
    ply: args.ply,
    move_number: Math.ceil(args.ply / 2),
    san: 'e4',
    fen_before: 'fen',
    side: args.side,
    cp_loss: args.cpLoss,
    classification: args.classification,
    phase: args.phase,
    motif_tags: ['unknown'],
    is_turning_point: false,
    retry_available: true,
    explanation: 'fixture',
    evidence: ['fixture'],
  };
}
