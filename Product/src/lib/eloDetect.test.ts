import { describe, expect, it } from 'vitest';
import { computeDetectedElo, computeDetectedEloFromScores, eloBandFromRating } from './eloDetect';

describe('eloBandFromRating', () => {
  it.each([
    [1199, 'apprentice'],
    [1200, 'initiate'],
    [1499, 'initiate'],
    [1500, 'adept'],
    [1799, 'adept'],
    [1800, 'master'],
  ] as const)('maps %i to %s', (elo, band) => {
    expect(eloBandFromRating(elo)).toBe(band);
  });
});

describe('computeDetectedElo', () => {
  it('uses the locked formula and band assignment', () => {
    expect(
      computeDetectedElo({
        task1: { correct_count: 3 },
        task3: { outcome: 'partial' },
        task4: { correct_count: 2 },
        task8: { result: 'draw', avg_cp_loss: 60 },
      })
    ).toEqual({ detected_elo: 1655, elo_band: 'adept' });
  });

  it('keeps all-timeout data at the 1000 apprentice baseline', () => {
    expect(computeDetectedElo({})).toEqual({ detected_elo: 1000, elo_band: 'apprentice' });
  });

  it('uses the conservative cp-loss fallback when an early loss has no cp data', () => {
    expect(
      computeDetectedElo({
        task1: { correct_count: 3 },
        task3: { outcome: 'partial' },
        task4: { correct_count: 2 },
        task8: { result: 'loss', avg_cp_loss: null },
      })
    ).toEqual({ detected_elo: 1490, elo_band: 'initiate' });
  });

  it('clamps score inputs to the 800-2100 safety range', () => {
    expect(computeDetectedEloFromScores({ tactical: -5, endgame: -5, vyasa: -5 })).toEqual({
      detected_elo: 800,
      elo_band: 'apprentice',
    });
    expect(computeDetectedEloFromScores({ tactical: 5, endgame: 5, vyasa: 5 })).toEqual({
      detected_elo: 2100,
      elo_band: 'master',
    });
  });
});
