import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import * as localCoachModule from './localCoach';
import {
  buildCoachContextFromLocalData,
  generateLocalTrainingPlan,
  generateNextActionSummary,
  generateWeaknessSummary,
} from './localCoach';
import { deleteMirrorDb, openMirrorDb, type StyleVector } from '../data/db';
import { usePlayerStore } from '../state/playerStore';
import CoachPreview from '../routes/CoachPreview';

const playerId = 'coach-player-1';

const vector: StyleVector = {
  opening_white_top3: ['e4'],
  opening_black_top3: ['c5'],
  avg_move_time_ms: 12000,
  time_pressure_blunder_rate: 0.35,
  exchange_willingness: 0.6,
  preferred_minor: 'knight',
  motif_blindness: {
    fork: 0.1,
    pin: 0.8,
    skewer: 0.3,
    removing_the_defender: 0.4,
  },
  endgame_strength: 0.5,
  swindle_preference: null,
  detected_elo: 1350,
  elo_band: 'initiate',
  schema_version: 1,
};

beforeEach(async () => {
  await deleteMirrorDb();
  usePlayerStore.setState({ activePlayerId: null, activePlayer: null });
});

afterEach(async () => {
  await deleteMirrorDb();
});

describe('local deterministic coach', () => {
  it('builds coach context without cloud dependencies', async () => {
    await seedPlayerWithCoachData();

    const context = await buildCoachContextFromLocalData(playerId);

    expect(context.privacy_flags.local_only).toBe(true);
    expect(context.privacy_flags.uploads_private_data).toBe(false);
    expect(context.privacy_flags.safe_to_send_to_llm).toBe(false);
    expect(context.player_profile_summary.player_found).toBe(true);
    expect(context.player_profile_summary.total_games).toBe(1);
    expect(context.style_vector_summary.behavioral_field_count).toBe(11);
  });

  it('handles missing player data safely', async () => {
    const context = await buildCoachContextFromLocalData('missing-player');

    expect(context.player_profile_summary.player_found).toBe(false);
    expect(context.privacy_flags.safe_to_send_to_llm).toBe(false);
    expect(generateNextActionSummary(context)).toMatch(/Create or select/);
  });

  it('handles no puzzle history with insufficient data behavior', async () => {
    await seedPlayerOnly();

    const context = await buildCoachContextFromLocalData(playerId);

    expect(context.puzzle_weakness_summary.has_history).toBe(false);
    expect(generateWeaknessSummary(context)).toMatch(/Insufficient data/);
  });

  it('identifies weak motif from available local data', async () => {
    await seedPlayerWithCoachData();

    const context = await buildCoachContextFromLocalData(playerId);

    expect(context.puzzle_weakness_summary.weakest_motif).toBe('pin');
    expect(generateWeaknessSummary(context)).toContain('pin');
  });

  it('returns deterministic recommendations for the same context', async () => {
    await seedPlayerWithCoachData();
    const context = await buildCoachContextFromLocalData(playerId);

    const planA = generateLocalTrainingPlan(context);
    const planB = generateLocalTrainingPlan(context);
    const actionA = generateNextActionSummary(context);
    const actionB = generateNextActionSummary(context);

    expect(planA).toEqual(planB);
    expect(actionA).toBe(actionB);
  });

  it('does not include LLM or paid API dependencies', () => {
    const exportedFunctions = Object.values(localCoachModule).filter(
      (value) => typeof value === 'function'
    ) as unknown as Array<(...args: unknown[]) => unknown>;
    const source = exportedFunctions
      .map((value) => value.toString())
      .join('\n')
      .toLowerCase();

    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('openai');
    expect(source).not.toContain('anthropic');
    expect(source).not.toContain('gemini');
    expect(source).not.toContain('apikey');
    expect(source).not.toContain('supabase');
  });

  it('/coach-preview route renders local coach preview', async () => {
    await seedPlayerWithCoachData();
    usePlayerStore.setState({
      activePlayerId: playerId,
      activePlayer: {
        id: playerId,
        display_name: 'Coach Tester',
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
        current_style_vector_id: 'sv-coach-1',
        calibration_status: 'complete',
      },
    });

    render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/coach-preview'] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: '/coach-preview',
            element: createElement(CoachPreview),
          })
        )
      )
    );

    expect(await screen.findByText('Local Coach Preview')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/local deterministic coach/i)).toBeInTheDocument();
      expect(screen.getAllByText(/pin/i).length).toBeGreaterThan(0);
    });
  });
});

async function seedPlayerOnly() {
  const db = await openMirrorDb();
  await db.put('players', {
    id: playerId,
    display_name: 'Coach Tester',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    calibration_status: 'complete',
  });
}

async function seedPlayerWithCoachData() {
  await seedPlayerOnly();
  const db = await openMirrorDb();

  await db.put('players', {
    id: playerId,
    display_name: 'Coach Tester',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    current_style_vector_id: 'sv-coach-1',
    calibration_status: 'complete',
    detected_elo: 1350,
    elo_band: 'initiate',
  });

  await db.put('style_vectors', {
    id: 'sv-coach-1',
    player_id: playerId,
    source: 'calibration',
    vector,
    computed_at: '2026-06-01T01:00:00.000Z',
  });

  await db.put('local_matches', {
    id: 'match-coach-1',
    player_id: playerId,
    mode: 'computer',
    side: 'white',
    actual_side: 'white',
    difficulty: 'Casual',
    result: 'white_win',
    result_label: 'White wins',
    pgn: '1. e4 e5 1-0',
    move_count: 2,
    created_at: '2026-06-01T02:00:00.000Z',
    completed_at: '2026-06-01T02:10:00.000Z',
  });

  await db.put('saved_analyses', {
    id: 'analysis-coach-1',
    player_id: playerId,
    match_id: 'match-coach-1',
    match_type: 'computer',
    source: 'local_stockfish',
    engine_depth: 10,
    status: 'complete',
    created_at: '2026-06-01T02:15:00.000Z',
    completed_at: '2026-06-01T02:16:00.000Z',
    pgn: '1. e4 e5 1-0',
    summary: {
      total_moves: 2,
      analyzed_moves: 2,
      average_cp_loss: 48,
      accuracy_estimate: 78,
      best_count: 1,
      good_count: 0,
      inaccuracy_count: 0,
      mistake_count: 1,
      blunder_count: 0,
    },
    moves: [],
  });

  await db.put('clue_attempts', {
    id: 'clue-coach-1',
    player_id: playerId,
    puzzle_id: 'pin-1',
    source: 'seed',
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    solution_moves: ['a2a3'],
    attempted_moves: ['a2a4'],
    motif: 'pin',
    difficulty: 'casual',
    hints_used: 1,
    solved: false,
    started_at: '2026-06-01T03:00:00.000Z',
    completed_at: '2026-06-01T03:01:00.000Z',
    created_at: '2026-06-01T03:00:00.000Z',
    total_steps: 1,
  });

  await db.put('clue_attempts', {
    id: 'clue-coach-2',
    player_id: playerId,
    puzzle_id: 'fork-1',
    source: 'seed',
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    solution_moves: ['a2a3'],
    attempted_moves: ['a2a3'],
    motif: 'fork',
    difficulty: 'casual',
    hints_used: 0,
    solved: true,
    started_at: '2026-06-01T03:05:00.000Z',
    completed_at: '2026-06-01T03:06:00.000Z',
    created_at: '2026-06-01T03:05:00.000Z',
    total_steps: 1,
  });

  await db.put('puzzle_reviews', {
    id: `${playerId}:pin-1`,
    player_id: playerId,
    puzzle_id: 'pin-1',
    motif: 'pin',
    difficulty: 'casual',
    is_multi_move: false,
    next_due_at: '2020-01-01T00:00:00.000Z',
    interval_days: 0,
    ease: 2.0,
    attempts: 2,
    lapses: 2,
    solved_streak: 0,
    last_result: 'failed',
    updated_at: '2026-06-01T03:02:00.000Z',
  });

  await db.put('story_progress', {
    id: `${playerId}_ch01`,
    player_id: playerId,
    chapter_id: 'ch01',
    status: 'available',
    attempts: 0,
    updated_at: '2026-06-01T04:00:00.000Z',
  });
}
