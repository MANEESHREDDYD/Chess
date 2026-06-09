import {
  getCurrentStyleVectorRecord,
  openMirrorDb,
  type AnalysisRecord,
  type ClueAttemptRecord,
  type PuzzleReviewRecord,
  type StoryProgressRecord,
} from '../data/db';
import { mahabharataStorySeed } from '../story/mahabharataStorySeed';
import { getPlayerProgressSummary } from '../progression/progression';
import { isDue } from '../training/spacedRepetition';
import type {
  AnalysisQualitySummary,
  LocalTrainingPlan,
  MirrorCoachContext,
  MotifWeaknessRow,
  PuzzleWeaknessSummary,
  SpacedRepetitionSummary,
  StoryProgressSummary,
  StyleVectorSummary,
} from './coachTypes';

const SOURCE_FILES = [
  'IndexedDB:players',
  'IndexedDB:style_vectors',
  'IndexedDB:saved_analyses',
  'IndexedDB:clue_attempts',
  'IndexedDB:puzzle_reviews',
  'IndexedDB:story_progress',
  'IndexedDB:achievements',
  'analytics_output/mirror_features.json',
];

export async function buildCoachContextFromLocalData(playerId: string): Promise<MirrorCoachContext> {
  const db = await openMirrorDb();
  const player = await db.get('players', playerId);

  if (!player) {
    return emptyCoachContext(playerId);
  }

  const [
    progress,
    styleVectorRecord,
    analyses,
    clueAttempts,
    puzzleReviews,
    storyProgress,
  ] = await Promise.all([
    getPlayerProgressSummary(playerId),
    getCurrentStyleVectorRecord(playerId),
    db.getAllFromIndex('saved_analyses', 'player_id', playerId),
    db.getAllFromIndex('clue_attempts', 'player_id', playerId),
    db.getAllFromIndex('puzzle_reviews', 'player_id', playerId),
    db.getAllFromIndex('story_progress', 'player_id', playerId),
  ]);

  const puzzleWeakness = buildPuzzleWeaknessSummary(clueAttempts, puzzleReviews);
  const analysisQuality = buildAnalysisQualitySummary(analyses);
  const spacedRepetition = buildSpacedRepetitionSummary(puzzleReviews);
  const storySummary = buildStoryProgressSummary(storyProgress, progress.current_story_chapter);
  const styleVectorSummary = styleVectorRecord
    ? buildStyleVectorSummary(styleVectorRecord)
    : emptyStyleVectorSummary();

  const context: MirrorCoachContext = {
    player_profile_summary: {
      player_id: player.id,
      display_name: player.display_name,
      player_found: true,
      calibration_status: player.calibration_status || 'not_started',
      detected_elo: player.detected_elo,
      elo_band: player.elo_band,
      total_games: progress.total_games,
      mirror_matches: progress.total_mirror_matches,
      analyses_completed: progress.total_analyses,
      achievements_count: progress.achievements.length,
      level: progress.level,
    },
    style_vector_summary: styleVectorSummary,
    recent_performance_summary: {
      total_games: progress.total_games,
      mirror_matches: progress.total_mirror_matches,
      analyses_completed: progress.total_analyses,
      clue_attempts: progress.clue_attempts,
      clue_solve_rate: round(progress.clue_solved_rate),
      multi_move_solve_rate: progress.multi_move_attempts
        ? round((progress.multi_move_solved / progress.multi_move_attempts) * 100)
        : 0,
      current_streak_days: progress.current_streak_days,
      best_streak_days: progress.best_streak_days,
    },
    puzzle_weakness_summary: puzzleWeakness,
    analysis_quality_summary: analysisQuality,
    spaced_repetition_summary: spacedRepetition,
    story_progress_summary: storySummary,
    recommended_next_actions: buildRecommendedActions(
      puzzleWeakness,
      analysisQuality,
      spacedRepetition,
      storySummary,
      progress.next_action
    ),
    privacy_flags: {
      local_only: true,
      contains_raw_pgn: false,
      contains_raw_fen: false,
      uploads_private_data: false,
      safe_to_send_to_llm: false,
      local_private_by_default: [
        'player id and display name',
        'raw PGN',
        'raw FEN',
        'full move history',
        'account links',
        'backup JSON files',
      ],
    },
    generated_at: new Date().toISOString(),
    source_files: SOURCE_FILES,
  };

  return context;
}

export function generateLocalTrainingPlan(context: MirrorCoachContext): LocalTrainingPlan {
  const weakest = context.puzzle_weakness_summary.weakest_motif;
  const dueCount = context.spaced_repetition_summary.due_reviews_count;
  const focus = weakest
    ? `Repair ${formatMotif(weakest)} pattern recognition`
    : 'Collect enough local data for personalized coaching';

  const steps = [
    dueCount > 0
      ? `Clear ${dueCount} due review${dueCount === 1 ? '' : 's'} in Clue Chess.`
      : 'Play or solve one fresh local training item.',
    weakest
      ? `Solve a short focused set on ${formatMotif(weakest)}.`
      : 'Complete several clue attempts so motif weakness can be measured.',
    context.analysis_quality_summary.analyses_completed > 0
      ? 'Review the latest analysis summary and compare CP-loss against your average.'
      : 'Analyze one completed game to seed CP-loss coaching.',
  ];

  if (context.story_progress_summary.current_story_chapter) {
    steps.push(`Continue Story Mode at ${context.story_progress_summary.current_story_chapter}.`);
  }

  return {
    title: 'Local MIRROR Training Plan',
    current_focus: focus,
    steps,
    rationale: weakest
      ? `The local data points to ${formatMotif(weakest)} as the current weakest motif.`
      : 'There is insufficient motif history, so the safest plan is to gather more local evidence.',
  };
}

export function generateWeaknessSummary(context: MirrorCoachContext): string {
  const puzzle = context.puzzle_weakness_summary;
  if (!puzzle.has_history || !puzzle.weakest_motif) {
    return puzzle.insufficient_data_reason || 'Insufficient data: no puzzle history is available yet.';
  }

  const row = puzzle.motif_stats.find((item) => item.motif === puzzle.weakest_motif);
  if (!row) {
    return 'Insufficient data: the weakest motif could not be resolved from local stats.';
  }

  return `${formatMotif(row.motif)} is the current weakest motif: ${row.solved} solved from ${row.attempts} attempts, ${row.failed} failed attempts, and ${row.review_lapses} review lapses.`;
}

export function generateNextActionSummary(context: MirrorCoachContext): string {
  const nextAction = context.recommended_next_actions[0];
  if (nextAction) return nextAction;

  if (!context.player_profile_summary.player_found) {
    return 'Create or select a local player profile before coaching.';
  }

  return 'Play one local game or solve one clue puzzle to create enough coaching data.';
}

function buildStyleVectorSummary(
  record: NonNullable<Awaited<ReturnType<typeof getCurrentStyleVectorRecord>>>
): StyleVectorSummary {
  const vector = record.vector;
  return {
    available: true,
    style_vector_id: record.id,
    source: record.source,
    computed_at: record.computed_at,
    behavioral_field_count: 11,
    dimensionality_note:
      'StyleVector has 11 behavioral/profile fields plus schema_version metadata in the current code.',
    opening_white_top3: vector.opening_white_top3,
    opening_black_top3: vector.opening_black_top3,
    avg_move_time_ms: vector.avg_move_time_ms,
    time_pressure_blunder_rate: vector.time_pressure_blunder_rate,
    exchange_willingness: vector.exchange_willingness,
    preferred_minor: vector.preferred_minor,
    motif_blindness: vector.motif_blindness,
    endgame_strength: vector.endgame_strength,
    swindle_preference: vector.swindle_preference,
    detected_elo: vector.detected_elo,
    elo_band: vector.elo_band,
  };
}

function emptyStyleVectorSummary(): StyleVectorSummary {
  return {
    available: false,
    behavioral_field_count: 11,
    dimensionality_note:
      'StyleVector has 11 behavioral/profile fields plus schema_version metadata in the current code.',
    opening_white_top3: [],
    opening_black_top3: [],
    avg_move_time_ms: 0,
    time_pressure_blunder_rate: 0,
    exchange_willingness: 0,
    preferred_minor: 'unknown',
    motif_blindness: {},
    endgame_strength: 0,
    swindle_preference: null,
  };
}

function buildPuzzleWeaknessSummary(
  clueAttempts: ClueAttemptRecord[],
  puzzleReviews: PuzzleReviewRecord[]
): PuzzleWeaknessSummary {
  const byMotif = new Map<string, MotifWeaknessRow>();

  for (const attempt of clueAttempts) {
    const motif = attempt.motif || 'unknown';
    const row = getMotifRow(byMotif, motif);
    row.attempts += 1;
    if (attempt.solved) {
      row.solved += 1;
    } else {
      row.failed += 1;
    }
  }

  for (const review of puzzleReviews) {
    const motif = review.motif || 'unknown';
    const row = getMotifRow(byMotif, motif);
    row.review_lapses += review.lapses;
    if (isDue(review.next_due_at, new Date())) {
      row.due_reviews += 1;
    }
  }

  const motifStats = Array.from(byMotif.values()).map((row) => ({
    ...row,
    solved_rate: row.attempts ? round((row.solved / row.attempts) * 100) : 0,
  }));

  if (motifStats.length === 0) {
    return {
      has_history: false,
      motif_stats: [],
      insufficient_data_reason: 'Insufficient data: no clue attempts or puzzle reviews exist yet.',
    };
  }

  const weakest = [...motifStats].sort((a, b) => {
    if (a.solved_rate !== b.solved_rate) return a.solved_rate - b.solved_rate;
    if (b.failed !== a.failed) return b.failed - a.failed;
    if (b.review_lapses !== a.review_lapses) return b.review_lapses - a.review_lapses;
    return a.motif.localeCompare(b.motif);
  })[0];

  const strongest = [...motifStats]
    .filter((row) => row.attempts > 0)
    .sort((a, b) => {
      if (b.solved_rate !== a.solved_rate) return b.solved_rate - a.solved_rate;
      if (b.solved !== a.solved) return b.solved - a.solved;
      if (b.attempts !== a.attempts) return b.attempts - a.attempts;
      return a.motif.localeCompare(b.motif);
    })[0];

  return {
    has_history: true,
    weakest_motif: weakest?.motif,
    strongest_motif: strongest?.motif,
    motif_stats: motifStats.sort((a, b) => a.motif.localeCompare(b.motif)),
  };
}

function getMotifRow(rows: Map<string, MotifWeaknessRow>, motif: string): MotifWeaknessRow {
  const existing = rows.get(motif);
  if (existing) return existing;

  const row: MotifWeaknessRow = {
    motif,
    attempts: 0,
    solved: 0,
    failed: 0,
    solved_rate: 0,
    review_lapses: 0,
    due_reviews: 0,
  };
  rows.set(motif, row);
  return row;
}

function buildAnalysisQualitySummary(analyses: AnalysisRecord[]): AnalysisQualitySummary {
  const completed = analyses
    .filter((analysis) => analysis.status === 'complete')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  if (completed.length === 0) {
    return {
      analyses_completed: 0,
      average_cp_loss: 0,
      accuracy_estimate: 0,
      blunder_count: 0,
      mistake_count: 0,
      trend: 'insufficient_data',
    };
  }

  const cpLosses = completed.map((analysis) => analysis.summary.average_cp_loss || 0);
  const first = cpLosses[0];
  const last = cpLosses[cpLosses.length - 1];
  let trend: AnalysisQualitySummary['trend'] = 'insufficient_data';
  if (completed.length > 1) {
    if (last <= first - 5) trend = 'improving';
    else if (last >= first + 5) trend = 'regressing';
    else trend = 'stable';
  }

  return {
    analyses_completed: completed.length,
    average_cp_loss: round(average(cpLosses)),
    accuracy_estimate: round(average(completed.map((analysis) => analysis.summary.accuracy_estimate || 0))),
    blunder_count: completed.reduce((total, analysis) => total + analysis.summary.blunder_count, 0),
    mistake_count: completed.reduce((total, analysis) => total + analysis.summary.mistake_count, 0),
    trend,
  };
}

function buildSpacedRepetitionSummary(reviews: PuzzleReviewRecord[]): SpacedRepetitionSummary {
  const due = reviews.filter((review) => isDue(review.next_due_at, new Date()));
  return {
    total_reviews: reviews.length,
    due_reviews_count: due.length,
    due_motifs: Array.from(new Set(due.map((review) => review.motif))).sort(),
    lapse_count: reviews.reduce((total, review) => total + review.lapses, 0),
  };
}

function buildStoryProgressSummary(
  records: StoryProgressRecord[],
  currentStoryChapter?: string
): StoryProgressSummary {
  const completed = records.filter((record) => record.status === 'complete').length;
  const available = currentStoryChapter || records.find((record) => record.status === 'available')?.chapter_id;
  return {
    completed_chapters: completed,
    total_chapters: mahabharataStorySeed.length,
    current_story_chapter: available,
    recommendation: available
      ? `Continue Story Mode at ${available}.`
      : 'Complete the next available story encounter when it unlocks.',
  };
}

function buildRecommendedActions(
  puzzleWeakness: PuzzleWeaknessSummary,
  analysisQuality: AnalysisQualitySummary,
  spacedRepetition: SpacedRepetitionSummary,
  storySummary: StoryProgressSummary,
  fallbackNextAction: string
): string[] {
  const actions: string[] = [];
  if (spacedRepetition.due_reviews_count > 0) {
    actions.push(
      `Review ${spacedRepetition.due_reviews_count} due puzzle${spacedRepetition.due_reviews_count === 1 ? '' : 's'} before adding new material.`
    );
  }
  if (puzzleWeakness.weakest_motif) {
    actions.push(`Practice ${formatMotif(puzzleWeakness.weakest_motif)} motifs in Clue Chess.`);
  }
  if (analysisQuality.analyses_completed === 0) {
    actions.push('Analyze one completed local game to seed post-game coaching.');
  }
  if (storySummary.current_story_chapter) {
    actions.push(storySummary.recommendation);
  }
  if (actions.length === 0 && fallbackNextAction) actions.push(fallbackNextAction);
  return actions;
}

function emptyCoachContext(playerId: string): MirrorCoachContext {
  return {
    player_profile_summary: {
      player_id: playerId,
      display_name: 'Unknown local player',
      player_found: false,
      calibration_status: 'missing',
      total_games: 0,
      mirror_matches: 0,
      analyses_completed: 0,
      achievements_count: 0,
      level: 1,
    },
    style_vector_summary: emptyStyleVectorSummary(),
    recent_performance_summary: {
      total_games: 0,
      mirror_matches: 0,
      analyses_completed: 0,
      clue_attempts: 0,
      clue_solve_rate: 0,
      multi_move_solve_rate: 0,
      current_streak_days: 0,
      best_streak_days: 0,
    },
    puzzle_weakness_summary: {
      has_history: false,
      motif_stats: [],
      insufficient_data_reason: 'Insufficient data: local player profile was not found.',
    },
    analysis_quality_summary: {
      analyses_completed: 0,
      average_cp_loss: 0,
      accuracy_estimate: 0,
      blunder_count: 0,
      mistake_count: 0,
      trend: 'insufficient_data',
    },
    spaced_repetition_summary: {
      total_reviews: 0,
      due_reviews_count: 0,
      due_motifs: [],
      lapse_count: 0,
    },
    story_progress_summary: {
      completed_chapters: 0,
      total_chapters: mahabharataStorySeed.length,
      recommendation: 'Create or select a local player profile before coaching.',
    },
    recommended_next_actions: ['Create or select a local player profile before coaching.'],
    privacy_flags: {
      local_only: true,
      contains_raw_pgn: false,
      contains_raw_fen: false,
      uploads_private_data: false,
      safe_to_send_to_llm: false,
      local_private_by_default: ['all gameplay stores until a player profile exists'],
    },
    generated_at: new Date().toISOString(),
    source_files: SOURCE_FILES,
  };
}

function formatMotif(motif: string): string {
  return motif.replace(/_/g, ' ');
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
