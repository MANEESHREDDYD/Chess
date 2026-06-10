import { describe, expect, it } from 'vitest';
import {
  buildPersonalizedSummary,
  buildRecommendedActions,
  buildStyleVectorNote,
} from './personalizedReview';
import type { StyleVector } from '../ml/styleVector';
import type { KeyMoment, MoveReview } from './reviewTypes';

describe('personalizedReview', () => {
  it('generates StyleVector notes only from available evidence', () => {
    const move = makeMove(['capture'], 'mistake');
    const note = buildStyleVectorNote(move, { styleVector: makeVector() });

    expect(note.note).toContain('exchange-willingness');
    expect(note.evidence[0]).toContain('0.72');
  });

  it('uses explicit insufficient-data behavior when StyleVector is missing', () => {
    const note = buildStyleVectorNote(makeMove(['pin'], 'blunder'));

    expect(note.note).toContain('Insufficient personal evidence');
    expect(note.evidence).toContain('No StyleVector was available for this review.');
  });

  it('builds recommended actions from key moments and motifs', () => {
    const move = makeMove(['pin'], 'blunder');
    const moment: KeyMoment = {
      id: 'largest-1',
      type: 'largest_cp_loss',
      ply: 1,
      move_number: 1,
      san: 'Qh5',
      classification: 'blunder',
      phase: 'opening',
      reason: 'Largest loss',
      evidence: ['CP loss: 300'],
      suggested_retry: 'Retry move 1',
      best_move: 'g1f3',
      cp_loss: 300,
    };
    const summary = buildPersonalizedSummary([move], [moment], { styleVector: makeVector(), clueWeakMotif: 'pin' });
    const actions = buildRecommendedActions([move], [moment], summary);

    expect(summary.headline).toContain('pin');
    expect(actions[0].type).toBe('retry');
    expect(actions.some((action) => action.route === '/clue-chess')).toBe(true);
  });
});

function makeMove(motifTags: string[], classification: MoveReview['classification'] = 'good'): MoveReview {
  return {
    ply: 1,
    move_number: 1,
    san: 'Qh5',
    fen_before: 'fen',
    side: 'white',
    cp_loss: 180,
    classification,
    phase: 'opening',
    motif_tags: motifTags,
    is_turning_point: false,
    retry_available: true,
    explanation: 'fixture',
    evidence: ['fixture'],
  };
}

function makeVector(): StyleVector {
  return {
    opening_white_top3: ['e4'],
    opening_black_top3: ['e5'],
    avg_move_time_ms: 10000,
    time_pressure_blunder_rate: 0.3,
    exchange_willingness: 0.72,
    preferred_minor: 'knight',
    motif_blindness: {
      fork: 0.1,
      pin: 0.65,
      skewer: 0.2,
      removing_the_defender: 0.2,
    },
    endgame_strength: 0.5,
    swindle_preference: 'principled',
    detected_elo: 1350,
    elo_band: 'initiate',
    schema_version: 1,
  };
}
