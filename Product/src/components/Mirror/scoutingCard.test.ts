import { describe, expect, it } from 'vitest';
import { getScoutingTraits, scoutingCardShareText, summarizeMirrorRecord } from './scoutingCard';
import type { StyleVector } from '../../ml/styleVector';

const vector: StyleVector = {
  opening_white_top3: ['e4'],
  opening_black_top3: ['e5'],
  avg_move_time_ms: 9_000,
  time_pressure_blunder_rate: 0.72,
  exchange_willingness: 0.82,
  preferred_minor: 'bishop',
  motif_blindness: {
    fork: 0.6,
    pin: 0.5,
    skewer: 0.5,
    removing_the_defender: 0.7,
  },
  endgame_strength: 0.3,
  swindle_preference: 'swindle',
  detected_elo: 1500,
  elo_band: 'initiate',
  schema_version: 1,
};

describe('scoutingCard', () => {
  it('derives honest threshold traits from the style vector', () => {
    expect(getScoutingTraits(vector)).toEqual([
      'Accepts trades readily',
      'Vulnerable when the clock tightens',
      'Endgame is still the weak square',
      'Keeps messy counterplay alive',
    ]);
  });

  it('summarizes the local Mirror record', () => {
    expect(
      summarizeMirrorRecord([
        { id: '1', player_id: 'p', started_at: 'now', completed_at: 'now', result: 'You won' },
        { id: '2', player_id: 'p', started_at: 'now', completed_at: 'now', result: 'Mirror won' },
        { id: '3', player_id: 'p', started_at: 'now', completed_at: 'now', result: 'Draw' },
      ])
    ).toEqual({ playerWins: 1, mirrorWins: 1, draws: 1 });
  });

  it('builds deterministic share text', () => {
    expect(
      scoutingCardShareText({
        vector,
        record: { playerWins: 2, mirrorWins: 1, draws: 0 },
        line: 'It overrode Stockfish with d5.',
      })
    ).toContain('Record 2-1-0');
  });
});
