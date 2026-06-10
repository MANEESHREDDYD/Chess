import { describe, expect, it } from 'vitest';
import {
  assertImportedGameReviewable,
  buildGameReviewFromSource,
  compareRetryMove,
  exportGameReviewMarkdown,
} from './gameReviewService';
import type { CandidateProvider } from './gameReviewService';
import type { ImportedGameRecord } from '../data/db';

describe('gameReviewService', () => {
  it('generates a local review from a valid game source', async () => {
    const review = await buildGameReviewFromSource(
      {
        source_type: 'imported_game',
        source_id: 'ig-test',
        player_id: 'player-1',
        pgn: `[Event "Fixture"]
[White "Local"]
[Black "Opponent"]
[Result "*"]

1. e4 e5 2. Qh5 Nc6 *`,
        reviewed_side: 'white',
        source_label: 'Imported game',
      },
      {
        depth: 1,
        maxMoves: 4,
        reviewedSide: 'white',
        styleVector: null,
        candidateProvider: fixtureCandidateProvider(),
      }
    );

    expect(review.move_reviews).toHaveLength(4);
    expect(review.move_reviews.some((move) => move.classification !== 'unknown')).toBe(true);
    expect(review.key_moments.length).toBeGreaterThan(0);
    expect(review.personalized_summary.insufficient_data).toContain('stylevector_missing');
    expect(review.recommended_actions.some((action) => action.type === 'retry')).toBe(true);
  });

  it('rejects invalid imported games before review', () => {
    const invalid = makeImportedGame({ legal_status: 'invalid' });

    expect(() => assertImportedGameReviewable(invalid)).toThrow(/Invalid imported games cannot be reviewed/);
  });

  it('allows valid imported games to be reviewed', () => {
    expect(() => assertImportedGameReviewable(makeImportedGame({ legal_status: 'valid' }))).not.toThrow();
  });

  it('compares retry attempts against the reviewed best move', () => {
    const reviewMove = {
      fen_before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      best_move: 'e2e4',
    } as Parameters<typeof compareRetryMove>[0];

    expect(compareRetryMove(reviewMove, 'e2e4').status).toBe('correct');
    expect(compareRetryMove(reviewMove, 'e2e5').status).toBe('invalid');
    expect(compareRetryMove(reviewMove, 'd2d4').status).toBe('still_risky');
  });

  it('redacts obvious secret words from markdown export', async () => {
    const review = await buildGameReviewFromSource(
      {
        source_type: 'local_match',
        source_id: 'access_token_fixture',
        player_id: 'player-1',
        pgn: '1. e4 e5 *',
        reviewed_side: 'both',
        source_label: 'Local match',
      },
      {
        depth: 1,
        maxMoves: 2,
        reviewedSide: 'both',
        styleVector: null,
        candidateProvider: fixtureCandidateProvider(),
      }
    );

    const markdown = exportGameReviewMarkdown(review);
    expect(markdown).not.toMatch(/access_token/i);
    expect(markdown).not.toMatch(/service_role/i);
  });
});

function fixtureCandidateProvider(): CandidateProvider {
  let call = 0;
  const beforeScores = [
    { move: 'e2e4', cp: 20 },
    { move: 'e7e5', cp: 20 },
    { move: 'g1f3', cp: 220 },
    { move: 'b8c6', cp: 30 },
  ];
  const afterScores = [
    { move: 'e7e5', cp: -20 },
    { move: 'g1f3', cp: -20 },
    { move: 'b8c6', cp: 100 },
    { move: 'g1f3', cp: -10 },
  ];

  return async (_fen, multipv) => {
    const pairIndex = Math.floor(call / 2);
    const score = call % 2 === 0 ? beforeScores[pairIndex] ?? beforeScores[0] : afterScores[pairIndex] ?? afterScores[0];
    call += 1;
    return [
      {
        move: score.move,
        cp: score.cp,
        mate: null,
        multipv: 1,
        pv: [score.move],
      },
      ...(multipv > 1
        ? [{
            move: 'a2a3',
            cp: Math.max(score.cp - 40, -500),
            mate: null,
            multipv: 2,
            pv: ['a2a3'],
          }]
        : []),
    ];
  };
}

function makeImportedGame(patch: Partial<ImportedGameRecord>): ImportedGameRecord {
  return {
    id: 'ig-test',
    player_id: 'player-1',
    source: 'manual_pgn',
    imported_at: '2026-06-01T00:00:00.000Z',
    headers: { White: 'Local', Black: 'Opponent' },
    pgn_text: '1. e4 e5 *',
    normalized_pgn: '1. e4 e5 *',
    move_count: 2,
    final_fen: 'fen',
    legal_status: 'valid',
    validation_errors: [],
    analysis_status: 'not_analyzed',
    stylevector_applied: false,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...patch,
  };
}
