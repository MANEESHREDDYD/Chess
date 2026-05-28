import { describe, expect, it } from 'vitest';
import { buildSelfRecognitionChallenge } from './selfRecognition';
import type { StyleVector } from '../../ml/styleVector';
import type { MirrorDecisionTrace } from '../../engine/mirrorOpponent';

const vector: StyleVector = {
  opening_white_top3: ['e4'],
  opening_black_top3: ['e5'],
  avg_move_time_ms: 9_000,
  time_pressure_blunder_rate: 0.7,
  exchange_willingness: 0.8,
  preferred_minor: 'bishop',
  motif_blindness: {
    fork: 0.6,
    pin: 0.5,
    skewer: 0.5,
    removing_the_defender: 0.7,
  },
  endgame_strength: 0.55,
  swindle_preference: 'swindle',
  detected_elo: 1500,
  elo_band: 'initiate',
  schema_version: 1,
};

describe('buildSelfRecognitionChallenge', () => {
  it('builds one real snippet and two deterministic decoys', () => {
    const challenge = buildSelfRecognitionChallenge(vector, [trace()], 'match-1');

    expect(challenge.correctOptionId).toBe('real');
    expect(challenge.options).toHaveLength(3);
    expect(challenge.options.map((option) => option.id).sort()).toEqual([
      'cautious-decoy',
      'opposite-decoy',
      'real',
    ]);
    expect(challenge.options.find((option) => option.id === 'real')?.lines[0]).toContain('overrode');
  });
});

function trace(): MirrorDecisionTrace {
  return {
    move: 'e4d5',
    san: 'exd5',
    stockfishTopMove: 'e4e5',
    stockfishTopSan: 'e5',
    overrodeStockfish: true,
    styleDimension: 'exchange_willingness',
    styleBias: 30,
    stockfishTopEngineScore: 20,
    rerankedEngineScore: 0,
    rerankedTotalScore: 30,
    reason: 'exchange',
    tendency: 0.8,
    detail: 'capture or trade candidate',
  };
}
