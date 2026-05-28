import { describe, expect, it } from 'vitest';
import { sharpenMirrorVector } from './evolvingMirror';
import type { StyleVector } from './styleVector';
import type { MirrorDecisionTrace } from '../engine/mirrorOpponent';

const vector: StyleVector = {
  opening_white_top3: ['e4'],
  opening_black_top3: ['e5', 'd5'],
  avg_move_time_ms: 9_000,
  time_pressure_blunder_rate: 0.62,
  exchange_willingness: 0.86,
  preferred_minor: 'bishop',
  motif_blindness: {
    fork: 0.6,
    pin: 0.55,
    skewer: 0.5,
    removing_the_defender: 0.65,
  },
  endgame_strength: 0.55,
  swindle_preference: 'swindle',
  detected_elo: 1500,
  elo_band: 'initiate',
  schema_version: 1,
};

describe('sharpenMirrorVector', () => {
  it('keeps detected Elo bounded while reducing a punished exchange tendency', () => {
    const update = sharpenMirrorVector({
      vector,
      result: 'You won',
      traces: [trace('exchange_willingness'), trace('exchange_willingness')],
    });

    expect(update.vector.detected_elo).toBe(vector.detected_elo);
    expect(update.vector.exchange_willingness).toBeLessThan(vector.exchange_willingness);
    expect(update.deltaLine).toContain('studied that game');
  });

  it('closes motif blindness only a small amount after a player win', () => {
    const update = sharpenMirrorVector({
      vector,
      result: 'You won',
      traces: [trace('motif_blindness'), trace('motif_blindness')],
    });

    expect(update.vector.motif_blindness.fork).toBeCloseTo(0.565);
    expect(update.vector.detected_elo).toBe(1500);
  });
});

function trace(styleDimension: MirrorDecisionTrace['styleDimension']): MirrorDecisionTrace {
  return {
    move: 'e4d5',
    san: 'exd5',
    stockfishTopMove: 'e4e5',
    stockfishTopSan: 'e5',
    overrodeStockfish: true,
    styleDimension,
    styleBias: 24,
    stockfishTopEngineScore: 10,
    rerankedEngineScore: 0,
    rerankedTotalScore: 24,
    reason: 'exchange',
    tendency: 0.8,
    detail: 'capture or trade candidate',
  };
}
