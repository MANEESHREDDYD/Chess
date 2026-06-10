import { describe, expect, it } from 'vitest';
import {
  calculateCpLoss,
  classifyMove,
  engineScoreToCentipawns,
  normalizePlayedEvalForMover,
} from './moveClassifier';

describe('moveClassifier', () => {
  it('normalizes side-perspective evals and calculates CP loss', () => {
    const bestEvalForMover = engineScoreToCentipawns({ cp: 80, mate: null });
    const playedEvalForMover = normalizePlayedEvalForMover({ cp: -20, mate: null });

    expect(bestEvalForMover).toBe(80);
    expect(playedEvalForMover).toBe(20);
    expect(calculateCpLoss(bestEvalForMover, playedEvalForMover)).toBe(60);
  });

  it('uses deterministic classification thresholds', () => {
    expect(classifyMove({ cpLoss: 0 })).toBe('best');
    expect(classifyMove({ cpLoss: 25 })).toBe('excellent');
    expect(classifyMove({ cpLoss: 60 })).toBe('good');
    expect(classifyMove({ cpLoss: 120 })).toBe('inaccuracy');
    expect(classifyMove({ cpLoss: 250 })).toBe('mistake');
    expect(classifyMove({ cpLoss: 251 })).toBe('blunder');
  });

  it('handles mate scores without flipping the mover perspective incorrectly', () => {
    expect(engineScoreToCentipawns({ cp: null, mate: 3 })).toBe(9997);
    expect(engineScoreToCentipawns({ cp: null, mate: -2 })).toBe(-9998);
    expect(normalizePlayedEvalForMover({ cp: null, mate: 2 })).toBe(-9998);
  });

  it('marks missed wins only when the engine evidence supports it', () => {
    expect(classifyMove({ cpLoss: 700, bestEvalForMover: 900, playedEvalForMover: 100 })).toBe('missed_win');
    expect(classifyMove({ cpLoss: 700, bestEvalForMover: 300, playedEvalForMover: -400 })).toBe('blunder');
  });
});
