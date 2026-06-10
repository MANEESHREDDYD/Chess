import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteMirrorDb, openMirrorDb, type StyleVector } from '../data/db';
import type { GameReviewRecord, MoveReview, PhaseSummary } from '../review/reviewTypes';
import { dashboardHasNoCloudDependency } from './dataQuality';
import {
  analyticsExportContainsUnsafeText,
  buildAnalyticsDashboardJson,
  buildAnalyticsDashboardMarkdown,
  buildAnalyticsDashboardSnapshot,
} from './dashboardService';

const playerId = 'analytics-player-1';

beforeEach(async () => {
  await deleteMirrorDb();
});

afterEach(async () => {
  await deleteMirrorDb();
});

describe('analytics dashboard service', () => {
  it('builds a full local dashboard snapshot from IndexedDB data', async () => {
    await seedFullAnalyticsData();

    const snapshot = await buildAnalyticsDashboardSnapshot(playerId);

    expect(snapshot.player_summary.player_found).toBe(true);
    expect(snapshot.player_summary.total_local_games).toBe(1);
    expect(snapshot.review_summary.reviewed_games_count).toBe(2);
    expect(snapshot.review_summary.average_cp_loss).toBeGreaterThan(0);
    expect(snapshot.review_summary.weakest_phase).toBe('middlegame');
    expect(snapshot.imported_game_summary.valid_games_count).toBe(1);
    expect(snapshot.imported_game_summary.invalid_or_partial_count).toBe(1);
    expect(snapshot.stylevector_summary.available).toBe(true);
    expect(snapshot.stylevector_summary.metrics.length).toBeGreaterThan(0);
    expect(snapshot.puzzle_summary.weakest_motif).toBe('pin');
    expect(snapshot.review_queue_summary.due_reviews_count).toBe(1);
    expect(snapshot.mirror_summary.feedback_tags.too_random).toBe(1);
    expect(snapshot.story_summary.completed_chapters).toBe(1);
    expect(snapshot.recommended_actions.length).toBeGreaterThan(0);
  });

  it('handles empty or missing local data with explicit data-quality findings', async () => {
    const snapshot = await buildAnalyticsDashboardSnapshot('missing-player');

    expect(snapshot.player_summary.player_found).toBe(false);
    expect(snapshot.data_quality.passed).toBe(false);
    expect(snapshot.data_quality.findings.some((finding) => finding.id === 'no-active-player')).toBe(true);
    expect(snapshot.recommended_actions[0].id).toBe('create-player-profile');
  });

  it('prioritizes recommended actions from local evidence', async () => {
    await seedFullAnalyticsData();

    const snapshot = await buildAnalyticsDashboardSnapshot(playerId);
    const priorities = snapshot.recommended_actions.map((action) => action.priority);

    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    expect(snapshot.recommended_actions.every((action) => action.evidence.length > 0)).toBe(true);
    expect(snapshot.recommended_actions.some((action) => action.type === 'review_puzzles')).toBe(true);
    expect(snapshot.recommended_actions.some((action) => action.route?.startsWith('/clue-chess?mode=adaptive'))).toBe(true);
  });

  it('generates summary exports without raw PGN, FEN, or token-like content', async () => {
    await seedFullAnalyticsData();

    const snapshot = await buildAnalyticsDashboardSnapshot(playerId);
    const markdown = buildAnalyticsDashboardMarkdown(snapshot);
    const json = buildAnalyticsDashboardJson(snapshot);

    expect(markdown).toContain('# MIRROR Advanced Analytics Dashboard');
    expect(json).toContain('mirror_analytics_dashboard_snapshot_v1');
    expect(analyticsExportContainsUnsafeText(markdown)).toBe(false);
    expect(analyticsExportContainsUnsafeText(json)).toBe(false);
    expect(markdown).not.toContain('1. e4 e5');
    expect(json).not.toContain('rnbqkbnr');
    expect(markdown.toLowerCase()).not.toContain('access_token');
    expect(json.toLowerCase()).not.toContain('service_role');
  });

  it('keeps the dashboard snapshot free of cloud or GenAI dependency markers', async () => {
    await seedFullAnalyticsData();

    const snapshot = await buildAnalyticsDashboardSnapshot(playerId);

    expect(dashboardHasNoCloudDependency(snapshot)).toBe(true);
    expect(JSON.stringify(snapshot).toLowerCase()).not.toContain('openai');
    expect(JSON.stringify(snapshot).toLowerCase()).not.toContain('anthropic');
    expect(JSON.stringify(snapshot).toLowerCase()).not.toContain('gemini');
  });
});

async function seedFullAnalyticsData() {
  const db = await openMirrorDb();
  await db.put('players', {
    id: playerId,
    display_name: 'Analytics Tester',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    current_style_vector_id: 'sv-analytics-1',
    calibration_status: 'complete',
  });
  await db.put('style_vectors', {
    id: 'sv-analytics-1',
    player_id: playerId,
    source: 'tuned',
    vector: makeStyleVector(),
    computed_at: '2026-06-02T00:00:00.000Z',
  });
  await db.put('local_matches', {
    id: 'local-analytics-1',
    player_id: playerId,
    mode: 'computer',
    side: 'white',
    actual_side: 'white',
    difficulty: 'Club',
    result: 'white_win',
    result_label: 'White wins',
    pgn: '1. e4 e5 1-0',
    move_count: 2,
    created_at: '2026-06-02T01:00:00.000Z',
    completed_at: '2026-06-02T01:15:00.000Z',
  });
  await db.put('mirror_matches', {
    id: 'mirror-analytics-1',
    player_id: playerId,
    started_at: '2026-06-03T01:00:00.000Z',
    completed_at: '2026-06-03T01:30:00.000Z',
    pgn: '1. d4 d5 1/2-1/2',
    result: 'draw',
    metadata: { personality_mode: 'current_self' },
  });
  await db.put('feedback', {
    id: 'feedback-analytics-1',
    player_id: playerId,
    mirror_match_id: 'mirror-analytics-1',
    style_vector_id: 'sv-analytics-1',
    felt_like_me: 'yes',
    perceived_strength: 'equal',
    created_at: '2026-06-03T01:35:00.000Z',
    metadata: {
      personality_mode: 'current_self',
      feedback_tags: ['felt_like_me', 'too_random'],
    },
  });
  await db.put('imported_games', {
    id: 'imported-valid-1',
    player_id: playerId,
    source: 'lichess_pgn',
    imported_at: '2026-06-04T00:00:00.000Z',
    headers: { Event: 'Local import', White: 'Analytics Tester', Black: 'Opponent', Result: '1-0' },
    pgn_text: '1. e4 e5 1-0',
    normalized_pgn: '1. e4 e5 1-0',
    result: '1-0',
    white: 'Analytics Tester',
    black: 'Opponent',
    user_color: 'white',
    move_count: 2,
    final_fen: 'final',
    legal_status: 'valid',
    validation_errors: [],
    analysis_status: 'analyzed',
    stylevector_applied: true,
    created_at: '2026-06-04T00:00:00.000Z',
    updated_at: '2026-06-04T00:00:00.000Z',
  });
  await db.put('imported_games', {
    id: 'imported-invalid-1',
    player_id: playerId,
    source: 'manual_pgn',
    imported_at: '2026-06-04T01:00:00.000Z',
    headers: { Event: 'Broken' },
    pgn_text: 'broken',
    normalized_pgn: '',
    move_count: 0,
    final_fen: 'unknown',
    legal_status: 'invalid',
    validation_errors: ['Invalid move.'],
    analysis_status: 'not_analyzed',
    stylevector_applied: false,
    created_at: '2026-06-04T01:00:00.000Z',
    updated_at: '2026-06-04T01:00:00.000Z',
  });
  await db.put('game_reviews', makeReview('review-local-1', 'local_match', 'local-analytics-1', '2026-06-05T00:00:00.000Z'));
  await db.put('game_reviews', makeReview('review-imported-1', 'imported_game', 'imported-valid-1', '2026-06-06T00:00:00.000Z'));
  await db.put('clue_attempts', {
    id: 'clue-pin-1',
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
    started_at: '2026-06-06T01:00:00.000Z',
    completed_at: '2026-06-06T01:05:00.000Z',
    created_at: '2026-06-06T01:00:00.000Z',
  });
  await db.put('clue_attempts', {
    id: 'clue-fork-1',
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
    started_at: '2026-06-06T02:00:00.000Z',
    completed_at: '2026-06-06T02:05:00.000Z',
    created_at: '2026-06-06T02:00:00.000Z',
  });
  await db.put('puzzle_reviews', {
    id: `${playerId}:pin-1`,
    player_id: playerId,
    puzzle_id: 'pin-1',
    motif: 'pin',
    difficulty: 'casual',
    is_multi_move: false,
    last_attempt_at: '2026-06-06T01:05:00.000Z',
    next_due_at: '2020-01-01T00:00:00.000Z',
    interval_days: 0,
    ease: 2,
    attempts: 2,
    lapses: 2,
    solved_streak: 0,
    last_result: 'failed',
    updated_at: '2026-06-06T01:06:00.000Z',
  });
  await db.put('story_progress', {
    id: `${playerId}_ch1_apprentice_arrives`,
    player_id: playerId,
    chapter_id: 'ch1_apprentice_arrives',
    status: 'complete',
    attempts: 1,
    completed_at: '2026-06-07T00:00:00.000Z',
    updated_at: '2026-06-07T00:00:00.000Z',
  });
  await db.put('story_progress', {
    id: `${playerId}_ch2_honest_move`,
    player_id: playerId,
    chapter_id: 'ch2_honest_move',
    status: 'available',
    attempts: 0,
    updated_at: '2026-06-07T00:00:00.000Z',
  });
  await db.put('achievements', {
    id: `${playerId}:first_review`,
    player_id: playerId,
    achievement_id: 'first_review',
    title: 'First Review',
    earned_at: '2026-06-05T00:00:00.000Z',
  });
}

function makeStyleVector(): StyleVector {
  return {
    opening_white_top3: ['e4', 'Nf3'],
    opening_black_top3: ['c5'],
    avg_move_time_ms: 9000,
    time_pressure_blunder_rate: 0.25,
    exchange_willingness: 0.65,
    preferred_minor: 'knight',
    motif_blindness: {
      fork: 0.15,
      pin: 0.85,
      skewer: 0.4,
      removing_the_defender: 0.35,
    },
    endgame_strength: 0.55,
    swindle_preference: 'swindle',
    detected_elo: 1420,
    elo_band: 'initiate',
    schema_version: 1,
  };
}

function makeReview(
  id: string,
  sourceType: GameReviewRecord['source_type'],
  sourceId: string,
  createdAt: string
): GameReviewRecord {
  const moves: MoveReview[] = [
    move(1, 1, 'e4', 'white', 5, 'best', 'opening', ['opening']),
    move(2, 1, 'e5', 'black', 35, 'good', 'opening', ['opening']),
    move(3, 2, 'Qh5', 'white', 180, 'mistake', 'middlegame', ['pin']),
    move(4, 2, 'Nc6', 'black', 260, 'blunder', 'middlegame', ['pin', 'tactical']),
  ];
  return {
    id,
    player_id: playerId,
    source_type: sourceType,
    source_id: sourceId,
    created_at: createdAt,
    analysis_depth: 8,
    engine_name: 'Stockfish',
    engine_version: 'local',
    total_moves: moves.length,
    reviewed_side: 'both',
    accuracy_white: 78,
    accuracy_black: 70,
    average_cp_loss_white: 92.5,
    average_cp_loss_black: 147.5,
    result: '1-0',
    phase_summary: phaseSummary(),
    key_moments: [
      {
        id: `${id}-moment-1`,
        type: 'largest_cp_loss',
        ply: 4,
        move_number: 2,
        san: 'Nc6',
        classification: 'blunder',
        phase: 'middlegame',
        reason: 'Largest CP-loss in the reviewed game.',
        evidence: ['Normalized CP loss: 260.'],
        suggested_retry: 'Retry the best move from this position.',
        cp_loss: 260,
        best_move: 'g8f6',
      },
    ],
    move_reviews: moves,
    personalized_summary: {
      headline: 'Pin tactics need attention.',
      notes: ['This aligns with StyleVector pin blindness evidence.'],
      evidence: ['motif_blindness.pin=0.85'],
      insufficient_data: [],
    },
    recommended_actions: [],
  };
}

function move(
  ply: number,
  moveNumber: number,
  san: string,
  side: MoveReview['side'],
  cpLoss: number,
  classification: MoveReview['classification'],
  phase: MoveReview['phase'],
  motifs: string[]
): MoveReview {
  return {
    ply,
    move_number: moveNumber,
    san,
    fen_before: `fixture-${ply}`,
    side,
    cp_loss: cpLoss,
    classification,
    phase,
    motif_tags: motifs,
    is_turning_point: classification === 'blunder',
    retry_available: true,
    explanation: `Fixture ${classification} with ${cpLoss} CP loss.`,
    evidence: [`Normalized CP loss: ${cpLoss}.`],
    best_move: 'g1f3',
  };
}

function phaseSummary(): PhaseSummary {
  return {
    opening: {
      phase: 'opening',
      moves: 2,
      average_cp_loss: 20,
      blunder_count: 0,
      mistake_count: 0,
      inaccuracy_count: 0,
      summary: 'Opening reviewed.',
    },
    middlegame: {
      phase: 'middlegame',
      moves: 2,
      average_cp_loss: 220,
      blunder_count: 1,
      mistake_count: 1,
      inaccuracy_count: 0,
      summary: 'Middlegame reviewed.',
    },
    endgame: {
      phase: 'endgame',
      moves: 0,
      average_cp_loss: 0,
      blunder_count: 0,
      mistake_count: 0,
      inaccuracy_count: 0,
      summary: 'No endgame moves reviewed.',
    },
    weakest_phase: 'middlegame',
    summary: 'Largest MIRROR internal CP-loss came in the middlegame.',
  };
}
