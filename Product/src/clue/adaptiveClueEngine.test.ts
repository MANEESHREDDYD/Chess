import { describe, expect, it } from 'vitest';
import { seedPuzzles } from '../data/cluePuzzles';
import type { ClueAttemptRecord, PuzzleReviewRecord, StyleVectorRecord } from '../data/db';
import type { GameReviewRecord } from '../review/reviewTypes';
import {
  buildAdaptiveClue,
  buildBossPuzzleSequence,
  buildFinalReveal,
  calculateClueScore,
  chooseStartingClueLevel,
  generateClueVariants,
  getClueLevels,
  inferWeakMotif,
  selectAdaptiveCluePuzzle,
  updateStreakState,
} from './adaptiveClueEngine';
import type { AdaptiveClueContext } from './clueTypes';

describe('adaptive clue engine', () => {
  it('generates clue levels one through five without revealing exact SAN before final reveal', () => {
    const puzzle = seedPuzzles.find((item) => item.motif === 'fork') ?? seedPuzzles[0];

    expect(getClueLevels()).toEqual([1, 2, 3, 4, 5]);
    for (const level of getClueLevels()) {
      const variants = generateClueVariants(puzzle, level);
      expect(variants.length).toBeGreaterThan(0);
      expect(variants[0].level).toBe(level);
      expect(variants[0].text).not.toContain('Nf3');
    }

    expect(buildFinalReveal(puzzle).why_it_works).toContain(puzzle.solution_moves[0]);
  });

  it('starts weak motifs at easier clue levels from local evidence', () => {
    const context = makeContext({
      attempts: [
        makeAttempt({ id: 'a1', motif: 'fork', solved: false }),
        makeAttempt({ id: 'a2', motif: 'fork', solved: false }),
      ],
    });
    const puzzle = seedPuzzles.find((item) => item.motif === 'fork') ?? seedPuzzles[0];

    expect(inferWeakMotif(context)).toBe('fork');
    expect(chooseStartingClueLevel(puzzle, context, 'adaptive', { weakMotif: 'fork' })).toBe(1);
  });

  it('starts strong motifs with lighter clues when solved cleanly', () => {
    const context = makeContext({
      attempts: [
        makeAttempt({ id: 'a1', motif: 'pin', solved: true, hintsUsed: 0 }),
        makeAttempt({ id: 'a2', motif: 'pin', solved: true, hintsUsed: 0 }),
      ],
    });
    const puzzle = seedPuzzles.find((item) => item.motif === 'pin') ?? seedPuzzles[0];

    expect(chooseStartingClueLevel(puzzle, context, 'adaptive')).toBe(4);
  });

  it('uses neutral insufficient-data behavior without inventing weakness', () => {
    const context = makeContext();
    const selection = selectAdaptiveCluePuzzle(context, 'adaptive');

    expect(selection.insufficient_data).toBe(true);
    expect(selection.evidence.join(' ')).toContain('Insufficient personalization data');
    expect(selection.reason).toContain('balanced seed puzzle');
  });

  it('prioritizes due review puzzles in review mode', () => {
    const duePuzzle = seedPuzzles.find((item) => item.motif === 'pin') ?? seedPuzzles[0];
    const context = makeContext({
      puzzleReviews: [makeReview({ puzzleId: duePuzzle.id, motif: duePuzzle.motif, nextDueAt: '2020-01-01T00:00:00.000Z' })],
    });

    const selection = selectAdaptiveCluePuzzle(context, 'review');

    expect(selection.puzzle.id).toBe(duePuzzle.id);
    expect(selection.due_review).toBe(true);
  });

  it('builds adaptive clues with evidence or an insufficient-data note', () => {
    const context = makeContext();
    const puzzle = seedPuzzles[0];
    const clue = buildAdaptiveClue({ puzzle, level: 2, mode: 'adaptive', context });

    expect(clue).not.toBeNull();
    expect(clue?.insufficient_data).toBe(true);
    expect(clue?.evidence.join(' ')).toContain('Insufficient personalization data');
  });

  it('scores streaks and final reveals deterministically', () => {
    const solved = calculateClueScore({
      solved: true,
      clue_level_used: 2,
      attempts_used: 1,
      due_review: true,
      streak_count: 2,
      boss_completed: false,
      used_final_reveal: false,
    });
    const revealed = calculateClueScore({
      solved: false,
      attempts_used: 3,
      due_review: false,
      streak_count: 2,
      boss_completed: false,
      used_final_reveal: true,
    });

    expect(solved.training_score).toBeGreaterThan(revealed.training_score);
    expect(updateStreakState({ count: 2, best: 3, lives: 2 }, true)).toMatchObject({ count: 3, best: 3, lives: 2 });
    expect(updateStreakState({ count: 2, best: 3, lives: 2 }, false)).toMatchObject({ count: 0, best: 3, lives: 1 });
  });

  it('creates a boss puzzle sequence around the weakest motif', () => {
    const context = makeContext({
      styleVector: makeStyleVector({
        motif_blindness: { fork: 0.9, pin: 0.1, skewer: 0.1, removing_the_defender: 0.2 },
      }),
    });

    const sequence = buildBossPuzzleSequence(context, 'fork');

    expect(sequence.puzzle_ids.length).toBeGreaterThanOrEqual(3);
    expect(sequence.puzzle_ids.length).toBeLessThanOrEqual(5);
    expect(sequence.motif).toBe('fork');
  });

  it('kids mode uses simpler wording', () => {
    const puzzle = seedPuzzles[0];
    const text = generateClueVariants(puzzle, 3, 'kids')[0].text;

    expect(text).toContain('Try this:');
    expect(text.toLowerCase()).not.toContain('fatal');
  });
});

function makeContext(input: {
  attempts?: ClueAttemptRecord[];
  puzzleReviews?: PuzzleReviewRecord[];
  gameReviews?: GameReviewRecord[];
  styleVector?: StyleVectorRecord | null;
  requestedMotif?: string | null;
} = {}): AdaptiveClueContext {
  return {
    player_id: 'player-test',
    style_vector: input.styleVector ?? null,
    clue_attempts: input.attempts ?? [],
    puzzle_reviews: input.puzzleReviews ?? [],
    game_reviews: input.gameReviews ?? [],
    requested_motif: input.requestedMotif ?? null,
    analytics_weak_motif: input.requestedMotif ?? null,
    due_review_motifs: [],
    generated_at: '2026-06-10T00:00:00.000Z',
  };
}

function makeAttempt(input: {
  id: string;
  motif: ClueAttemptRecord['motif'];
  solved: boolean;
  hintsUsed?: number;
}): ClueAttemptRecord {
  return {
    id: input.id,
    player_id: 'player-test',
    puzzle_id: `${input.motif}-puzzle`,
    source: 'seed',
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    solution_moves: ['a2a3'],
    attempted_moves: input.solved ? ['a2a3'] : ['a2a4'],
    motif: input.motif,
    difficulty: 'beginner',
    hints_used: input.hintsUsed ?? 1,
    solved: input.solved,
    started_at: '2026-06-10T00:00:00.000Z',
    created_at: '2026-06-10T00:00:00.000Z',
    attempts_before_solve: input.solved ? 1 : 2,
  };
}

function makeReview(input: { puzzleId: string; motif: string; nextDueAt: string }): PuzzleReviewRecord {
  return {
    id: `player-test:${input.puzzleId}`,
    player_id: 'player-test',
    puzzle_id: input.puzzleId,
    motif: input.motif,
    next_due_at: input.nextDueAt,
    interval_days: 1,
    ease: 2.5,
    attempts: 2,
    lapses: 1,
    solved_streak: 0,
    last_result: 'failed',
    updated_at: '2026-06-10T00:00:00.000Z',
  };
}

function makeStyleVector(patch: Partial<StyleVectorRecord['vector']>): StyleVectorRecord {
  return {
    id: 'sv-test',
    player_id: 'player-test',
    source: 'calibration',
    computed_at: '2026-06-10T00:00:00.000Z',
    vector: {
      opening_white_top3: ['e4'],
      opening_black_top3: ['e5'],
      avg_move_time_ms: 9000,
      time_pressure_blunder_rate: 0.2,
      exchange_willingness: 0.5,
      preferred_minor: 'knight',
      motif_blindness: { fork: 0.2, pin: 0.2, skewer: 0.2, removing_the_defender: 0.2 },
      endgame_strength: 0.5,
      swindle_preference: 'principled',
      detected_elo: 1100,
      elo_band: 'initiate',
      schema_version: 1,
      ...patch,
    },
  };
}
