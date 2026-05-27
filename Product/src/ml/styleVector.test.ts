import { describe, expect, it } from 'vitest';
import aggressiveFixture from './__fixtures__/aggressiveCalibration.json';
import defensiveFixture from './__fixtures__/defensiveCalibration.json';
import {
  computeStyleVector,
  eloBandFromRating,
  type CalibrationRunData,
  type StyleVector,
} from './styleVector';

const aggressiveCalibration = aggressiveFixture as unknown as CalibrationRunData;
const defensiveCalibration = defensiveFixture as unknown as CalibrationRunData;

describe('computeStyleVector', () => {
  it('computes the aggressive fixture without NaN values', () => {
    const vector = computeStyleVector(aggressiveCalibration);

    expect(vector.opening_white_top3).toEqual(['e4']);
    expect(vector.opening_black_top3).toEqual(['e5', 'Nf6']);
    expect(vector.exchange_willingness).toBe(1);
    expect(vector.preferred_minor).toBe('bishop');
    expect(vector.swindle_preference).toBe('swindle');
    expect(vector.detected_elo).toBe(1165);
    expect(vector.elo_band).toBe('apprentice');
    expect(allNumbersAreFinite(vector)).toBe(true);
  });

  it('computes the defensive fixture without NaN values', () => {
    const vector = computeStyleVector(defensiveCalibration);

    expect(vector.opening_white_top3).toEqual(['d4']);
    expect(vector.exchange_willingness).toBe(0);
    expect(vector.preferred_minor).toBe('knight');
    expect(vector.endgame_strength).toBe(1);
    expect(vector.swindle_preference).toBe('principled');
    expect(vector.detected_elo).toBe(1830);
    expect(vector.elo_band).toBe('master');
    expect(allNumbersAreFinite(vector)).toBe(true);
  });

  it('differentiates aggressive and defensive fixtures on at least four dimensions', () => {
    const aggressive = computeStyleVector(aggressiveCalibration);
    const defensive = computeStyleVector(defensiveCalibration);
    const changed = changedStyleDimensions(aggressive, defensive);

    expect(changed).toEqual([
      'opening_white_top3',
      'opening_black_top3',
      'avg_move_time_ms',
      'time_pressure_blunder_rate',
      'exchange_willingness',
      'preferred_minor',
      'motif_blindness',
      'endgame_strength',
      'swindle_preference',
    ]);
    expect(changed.length).toBeGreaterThanOrEqual(4);
  });

  it('derives motif blindness and time pressure rate from raw tactical attempts', () => {
    const vector = computeStyleVector({
      task1: {
        correct_count: 2,
        attempts: [
          { motif: 'fork', correct: true },
          { motif: 'pin', correct: false },
          { motif: 'skewer', correct: true },
          { motif: 'removing_the_defender', correct: false, timed_out: true },
        ],
      },
      task4: {
        correct_count: 1,
        attempts: [
          { motif: 'fork', correct: false },
          { motif: 'pin', correct: false, timed_out: true },
          { motif: 'skewer', correct: true },
          { motif: 'removing_the_defender', correct: false },
        ],
      },
    });

    expect(vector.motif_blindness).toEqual({
      fork: 0.5,
      pin: 1,
      skewer: 0,
      removing_the_defender: 1,
    });
    expect(vector.time_pressure_blunder_rate).toBe(0.75);
  });

  it('uses NaN-safe defaults when every task times out or is absent', () => {
    const vector = computeStyleVector({
      task1: { correct_count: 0, total_count: 4 },
      task3: { outcome: 'none' },
      task4: { correct_count: 0, total_count: 4, time_pressure_blunder_rate: 1 },
      task5: { choice: null },
      task8: { result: 'abandoned', avg_cp_loss: null, avg_move_time_ms: null },
    });

    expect(vector.detected_elo).toBe(1000);
    expect(vector.elo_band).toBe('apprentice');
    expect(vector.swindle_preference).toBeNull();
    expect(allNumbersAreFinite(vector)).toBe(true);
  });

  it('handles a Task 8 resignation before usable move data exists', () => {
    const vector = computeStyleVector({
      task1: { correct_count: 3, total_count: 4 },
      task3: { outcome: 'partial' },
      task4: { correct_count: 2, total_count: 4 },
      task8: { result: 'loss', avg_cp_loss: null, avg_move_time_ms: Number.NaN },
    });

    expect(vector.avg_move_time_ms).toBe(0);
    expect(vector.detected_elo).toBe(1490);
    expect(vector.elo_band).toBe('initiate');
    expect(allNumbersAreFinite(vector)).toBe(true);
  });

  it('clamps malformed numeric inputs into the vector ranges', () => {
    const vector = computeStyleVector({
      task1: {
        correct_count: 99,
        motif_blindness: { fork: 2, pin: -1, skewer: Number.NaN },
      },
      task3: { score: 2 },
      task4: {
        correct_count: -4,
        time_pressure_blunder_rate: -0.25,
      },
      task7: {
        choices: [{ decision: 'accept' }, { decision: 'decline' }],
      },
      task8: { result: 'win', avg_cp_loss: -20, avg_move_time_ms: -5 },
    });

    expect(vector.avg_move_time_ms).toBe(0);
    expect(vector.time_pressure_blunder_rate).toBe(0);
    expect(vector.exchange_willingness).toBe(0.5);
    expect(vector.motif_blindness.fork).toBe(1);
    expect(vector.motif_blindness.pin).toBe(0);
    expect(vector.motif_blindness.skewer).toBe(1);
    expect(vector.endgame_strength).toBe(1);
    expect(vector.detected_elo).toBe(2100);
  });
});

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

function allNumbersAreFinite(vector: StyleVector): boolean {
  return collectNumbers(vector).every((value) => Number.isFinite(value) && !Number.isNaN(value));
}

function collectNumbers(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(collectNumbers);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(collectNumbers);
  }
  return [];
}

function changedStyleDimensions(left: StyleVector, right: StyleVector): string[] {
  const dimensions: Array<keyof Pick<
    StyleVector,
    | 'opening_white_top3'
    | 'opening_black_top3'
    | 'avg_move_time_ms'
    | 'time_pressure_blunder_rate'
    | 'exchange_willingness'
    | 'preferred_minor'
    | 'motif_blindness'
    | 'endgame_strength'
    | 'swindle_preference'
  >> = [
    'opening_white_top3',
    'opening_black_top3',
    'avg_move_time_ms',
    'time_pressure_blunder_rate',
    'exchange_willingness',
    'preferred_minor',
    'motif_blindness',
    'endgame_strength',
    'swindle_preference',
  ];

  return dimensions.filter((dimension) => {
    return JSON.stringify(left[dimension]) !== JSON.stringify(right[dimension]);
  });
}
