import {
  getCurrentStyleVectorRecord,
  openMirrorDb,
  type AnalysisRecord,
  type ClueAttemptRecord,
  type PuzzleReviewRecord,
  type StoryProgressRecord,
  type StyleVector,
} from '../data/db';
import { mahabharataStorySeed } from '../story/mahabharataStorySeed';
import { getPlayerProgressSummary } from '../progression/progression';
import { isDue } from '../training/spacedRepetition';
import type {
  AnalysisQualitySummary,
  CoachCard,
  CoachConfidence,
  CoachSummary,
  LocalTrainingPlan,
  MirrorCoachContext,
  MotifWeaknessRow,
  PlayerProgressCoachSummary,
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
    const context = emptyCoachContext(playerId);
    context.coach_cards = generateCoachCards(context);
    return context;
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
  const playerProgressSummary = buildPlayerProgressCoachSummary(progress);

  const context: MirrorCoachContext = {
    player_profile_summary: {
      player_id: player.id,
      display_name: player.display_name || 'Local player',
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
    player_progress_summary: playerProgressSummary,
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
    coach_summary: emptyCoachSummary(),
    coach_cards: [],
    recommended_next_actions: buildRecommendedActions(
      puzzleWeakness,
      analysisQuality,
      spacedRepetition,
      storySummary,
      progress.next_action,
      player.calibration_status,
      styleVectorSummary
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

  context.coach_summary = buildCoachSummary(context);
  context.coach_cards = generateCoachCards(context);
  return context;
}

export function generateLocalTrainingPlan(context: MirrorCoachContext): LocalTrainingPlan {
  const dueCount = context.spaced_repetition_summary.due_reviews_count;
  const focus = context.coach_summary.recommended_focus_area;

  const steps = [
    dueCount > 0
      ? `Clear ${dueCount} due review${dueCount === 1 ? '' : 's'} in Clue Chess.`
      : 'Play or solve one fresh local training item.',
    context.puzzle_weakness_summary.weakest_motif
      ? `Solve a short focused set on ${formatMotif(context.puzzle_weakness_summary.weakest_motif)}.`
      : 'Complete several clue attempts so motif weakness can be measured.',
    context.analysis_quality_summary.analyses_completed > 0
      ? 'Review the latest analysis summary and compare CP-loss against your average.'
      : 'Analyze one completed game to seed CP-loss coaching.',
  ];

  if (context.story_progress_summary.current_story_chapter) {
    steps.push(`Continue Story Mode at ${storyLabel(context.story_progress_summary)}.`);
  }

  return {
    title: 'Local MIRROR Training Plan',
    current_focus: focus,
    steps,
    rationale: context.puzzle_weakness_summary.weakest_motif
      ? `The local data points to ${formatMotif(context.puzzle_weakness_summary.weakest_motif)} as the current weakest motif.`
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
  const topCard = context.coach_cards[0];
  if (topCard) return topCard.recommendation;

  const nextAction = context.recommended_next_actions[0];
  if (nextAction) return nextAction;

  if (!context.player_profile_summary.player_found) {
    return 'Create or select a local player profile before coaching.';
  }

  return 'Play one local game or solve one clue puzzle to create enough coaching data.';
}

export function generateCoachCards(context: MirrorCoachContext): CoachCard[] {
  const cards: CoachCard[] = [];
  const profile = context.player_profile_summary;
  const summary = context.coach_summary.insufficient_data_flags.length
    ? context.coach_summary
    : buildCoachSummary(context);

  if (!profile.player_found) {
    cards.push({
      id: 'data-profile-missing',
      type: 'data_quality',
      title: 'Create a local player profile',
      summary: 'Insufficient data: the coach cannot personalize recommendations without a local profile.',
      evidence: ['No player profile was found for the requested local player id.'],
      recommendation: 'Create or select a local player profile before using the coach.',
      priority: 1,
      confidence: 'low',
      source: 'IndexedDB:players',
    });
    return sortCards(cards);
  }

  if (profile.calibration_status !== 'complete' || !context.style_vector_summary.available) {
    cards.push({
      id: 'data-style-vector',
      type: 'data_quality',
      title: 'Calibration needed for better personalization',
      summary: context.style_vector_summary.available
        ? 'Calibration status is not complete, so personalization confidence is limited.'
        : 'Insufficient data: no StyleVector is available for this local player.',
      evidence: [
        `Calibration status: ${profile.calibration_status || 'not_started'}.`,
        `StyleVector available: ${context.style_vector_summary.available ? 'yes' : 'no'}.`,
      ],
      recommendation: 'Complete calibration to improve local coach personalization.',
      priority: 1,
      confidence: 'low',
      source: 'IndexedDB:players + IndexedDB:style_vectors',
    });
  }

  if (context.spaced_repetition_summary.due_reviews_count > 0) {
    cards.push({
      id: 'review-due',
      type: 'review',
      title: 'Review queue is due',
      summary: `${context.spaced_repetition_summary.due_reviews_count} puzzle review${context.spaced_repetition_summary.due_reviews_count === 1 ? ' is' : 's are'} due.`,
      evidence: [
        `Due review count: ${context.spaced_repetition_summary.due_reviews_count}.`,
        `Due motifs: ${formatList(context.spaced_repetition_summary.due_motifs)}.`,
      ],
      recommendation: `Review ${context.spaced_repetition_summary.due_reviews_count} due puzzle${context.spaced_repetition_summary.due_reviews_count === 1 ? '' : 's'} before adding new material.`,
      priority: 2,
      confidence: context.spaced_repetition_summary.total_reviews >= 3 ? 'high' : 'medium',
      source: 'IndexedDB:puzzle_reviews',
    });
  }

  if (context.puzzle_weakness_summary.has_history && context.puzzle_weakness_summary.weakest_motif) {
    const weakest = context.puzzle_weakness_summary.weakest_motif;
    const weakestRow = context.puzzle_weakness_summary.motif_stats.find((row) => row.motif === weakest);
    const strongest = context.puzzle_weakness_summary.strongest_motif;
    const attempts = weakestRow?.attempts || 0;
    cards.push({
      id: 'weakness-primary',
      type: 'weakness',
      title: `Practice ${formatMotif(weakest)} patterns`,
      summary: strongest
        ? `${formatMotif(weakest)} is the weakest measured motif; ${formatMotif(strongest)} is currently strongest.`
        : `${formatMotif(weakest)} is the weakest measured motif.`,
      evidence: weakestRow
        ? [
            `${formatMotif(weakest)} solved rate: ${weakestRow.solved_rate}%.`,
            `${weakestRow.solved} solved from ${weakestRow.attempts} attempt${weakestRow.attempts === 1 ? '' : 's'}.`,
            `${weakestRow.review_lapses} review lapse${weakestRow.review_lapses === 1 ? '' : 's'}.`,
          ]
        : ['Weakest motif exists in summary, but detailed row data is missing.'],
      recommendation: `Practice ${formatMotif(weakest)} motifs in Clue Chess.`,
      priority: 3,
      confidence: attempts >= 5 ? 'high' : attempts >= 2 ? 'medium' : 'low',
      source: 'IndexedDB:clue_attempts + IndexedDB:puzzle_reviews',
    });
  } else {
    cards.push({
      id: 'weakness-insufficient',
      type: 'weakness',
      title: 'Collect puzzle history',
      summary: context.puzzle_weakness_summary.insufficient_data_reason || 'Insufficient data: no motif history is available.',
      evidence: [
        `Clue attempts: ${context.recent_performance_summary.clue_attempts}.`,
        `Puzzle review records: ${context.spaced_repetition_summary.total_reviews}.`,
      ],
      recommendation: 'Solve several Clue Chess puzzles so the coach can identify weak and strong motifs.',
      priority: 6,
      confidence: 'low',
      source: 'IndexedDB:clue_attempts + IndexedDB:puzzle_reviews',
    });
  }

  if (context.analysis_quality_summary.analyses_completed > 0) {
    cards.push({
      id: 'analysis-quality',
      type: 'analysis',
      title: 'Review recent analysis quality',
      summary: `Average CP loss is ${context.analysis_quality_summary.average_cp_loss}; trend is ${context.analysis_quality_summary.trend}.`,
      evidence: [
        `Analyses completed: ${context.analysis_quality_summary.analyses_completed}.`,
        `Average CP loss: ${context.analysis_quality_summary.average_cp_loss}.`,
        `Mistakes: ${context.analysis_quality_summary.mistake_count}; blunders: ${context.analysis_quality_summary.blunder_count}.`,
      ],
      recommendation: 'Use the latest Stockfish analysis summary to pick one recurring mistake class to review.',
      priority: 4,
      confidence: context.analysis_quality_summary.analyses_completed >= 3 ? 'high' : 'medium',
      source: 'IndexedDB:saved_analyses',
    });
  } else {
    cards.push({
      id: 'analysis-insufficient',
      type: 'analysis',
      title: profile.mirror_matches > 0 ? 'Analyze your last Mirror match' : 'Analyze a completed game',
      summary: 'Insufficient data: no completed local Stockfish analyses are available yet.',
      evidence: [
        `Completed analyses: ${context.analysis_quality_summary.analyses_completed}.`,
        `Completed games: ${profile.total_games}.`,
        `Mirror matches: ${profile.mirror_matches}.`,
      ],
      recommendation: profile.total_games + profile.mirror_matches > 0
        ? 'Analyze your latest completed game to seed CP-loss coaching.'
        : 'Play a local game, then run analysis to seed CP-loss coaching.',
      priority: profile.total_games + profile.mirror_matches > 0 ? 4 : 7,
      confidence: 'low',
      source: 'IndexedDB:saved_analyses',
    });
  }

  if (context.story_progress_summary.status === 'available' || context.story_progress_summary.status === 'in_progress') {
    cards.push({
      id: 'story-current',
      type: 'story',
      title: `Continue Story ${context.story_progress_summary.current_story_act || 'Mode'}`,
      summary: context.story_progress_summary.current_story_title
        ? `Next story focus: ${context.story_progress_summary.current_story_title}.`
        : 'A story chapter is available.',
      evidence: [
        `Completed chapters: ${context.story_progress_summary.completed_chapters} of ${context.story_progress_summary.total_chapters}.`,
        `Story status: ${context.story_progress_summary.status}.`,
      ],
      recommendation: context.story_progress_summary.recommendation,
      priority: 5,
      confidence: context.story_progress_summary.has_progress ? 'medium' : 'low',
      source: 'IndexedDB:story_progress + story seed',
    });
  } else {
    cards.push({
      id: 'story-insufficient',
      type: 'story',
      title: 'Start story progress',
      summary: 'Insufficient data: no story progress records are available yet.',
      evidence: [`Completed chapters: ${context.story_progress_summary.completed_chapters}.`],
      recommendation: 'Start or unlock the next Story Mode encounter when ready.',
      priority: 8,
      confidence: 'low',
      source: 'IndexedDB:story_progress + story seed',
    });
  }

  if (profile.mirror_matches === 0) {
    cards.push({
      id: 'mirror-first-match',
      type: 'mirror',
      title: 'Play your first Mirror match',
      summary: 'Insufficient data: no completed Mirror match has been recorded for this player.',
      evidence: [`Mirror matches: ${profile.mirror_matches}.`],
      recommendation: 'Play a Mirror match to give the coach self-play evidence.',
      priority: 5,
      confidence: 'low',
      source: 'IndexedDB:mirror_matches',
    });
  } else {
    cards.push({
      id: 'mirror-sample',
      type: 'mirror',
      title: 'Use Mirror match evidence',
      summary: `${profile.mirror_matches} Mirror match${profile.mirror_matches === 1 ? '' : 'es'} can inform future self-play coaching.`,
      evidence: [
        `Mirror matches: ${profile.mirror_matches}.`,
        `Analyses completed: ${context.analysis_quality_summary.analyses_completed}.`,
      ],
      recommendation: context.analysis_quality_summary.analyses_completed < profile.mirror_matches
        ? 'Analyze your latest Mirror match for a stronger post-game coaching summary.'
        : 'Compare Mirror match feedback with your current StyleVector tendencies.',
      priority: 5,
      confidence: profile.mirror_matches >= 3 ? 'medium' : 'low',
      source: 'IndexedDB:mirror_matches + IndexedDB:saved_analyses',
    });
  }

  cards.push({
    id: 'progression-status',
    type: 'progression',
    title: 'Progression snapshot',
    summary: `Level ${profile.level}, ${profile.achievements_count} achievement${profile.achievements_count === 1 ? '' : 's'}, ${context.recent_performance_summary.current_streak_days} current streak day${context.recent_performance_summary.current_streak_days === 1 ? '' : 's'}.`,
    evidence: [
      `Total XP: ${context.player_progress_summary.total_xp}.`,
      `Best streak: ${context.player_progress_summary.best_streak_days} day${context.player_progress_summary.best_streak_days === 1 ? '' : 's'}.`,
      `Next action from progress engine: ${context.player_progress_summary.next_action || 'none'}.`,
    ],
    recommendation: context.player_progress_summary.next_action || 'Keep one small local training action queued.',
    priority: 9,
    confidence: profile.total_games + context.recent_performance_summary.clue_attempts > 0 ? 'medium' : 'low',
    source: 'progression summary',
  });

  if (summary.insufficient_data_flags.length > 0) {
    cards.push({
      id: 'data-coverage',
      type: 'data_quality',
      title: 'Improve coach data coverage',
      summary: `Insufficient data flags: ${summary.insufficient_data_flags.join(', ')}.`,
      evidence: summary.insufficient_data_flags.map((flag) => `Flag: ${flag}.`),
      recommendation: 'Add local gameplay, analysis, puzzle, story, and calibration data to raise coach confidence.',
      priority: 10,
      confidence: 'low',
      source: 'coach_summary.insufficient_data_flags',
    });
  }

  return sortCards(cards);
}

export function buildCoachReportMarkdown(context: MirrorCoachContext): string {
  const lines = [
    '# MIRROR Local Coach Report',
    '',
    `Generated: ${context.generated_at}`,
    '',
    'This report is deterministic and local-only. GenAI coaching is a future optional feature.',
    '',
    '## Summary',
    '',
    `- Player: ${context.player_profile_summary.display_name}`,
    `- Recommended focus: ${context.coach_summary.recommended_focus_area}`,
    `- Confidence: ${context.coach_summary.confidence_level}`,
    `- Weakest motif: ${formatOptional(context.coach_summary.weakest_motif)}`,
    `- Strongest motif: ${formatOptional(context.coach_summary.strongest_motif)}`,
    `- Due reviews: ${context.coach_summary.review_due_count}`,
    `- Achievements: ${context.coach_summary.achievement_count}`,
    '',
    '## Coach Cards',
    '',
  ];

  for (const card of context.coach_cards) {
    lines.push(
      `### ${card.priority}. ${card.title}`,
      '',
      `- Type: ${card.type}`,
      `- Confidence: ${card.confidence}`,
      `- Source: ${card.source}`,
      `- Summary: ${card.summary}`,
      `- Recommendation: ${card.recommendation}`,
      '- Evidence:',
      ...card.evidence.map((item) => `  - ${item}`),
      ''
    );
  }

  lines.push(
    '## Insufficient Data Flags',
    '',
    ...(context.coach_summary.insufficient_data_flags.length
      ? context.coach_summary.insufficient_data_flags.map((flag) => `- ${flag}`)
      : ['- none']),
    '',
    '## Privacy Boundary',
    '',
    '- No raw PGN or FEN is included in this report.',
    '- No auth tokens, account links, API keys, or backup files are included.',
    '- The report is generated from local summaries and is not uploaded by MIRROR.',
    ''
  );

  return `${lines.join('\n')}\n`;
}

export function buildCoachContextJson(context: MirrorCoachContext): string {
  return `${JSON.stringify(
    {
      schema: 'mirror_local_coach_context_v2',
      privacy_note:
        'Deterministic local-only summary. No raw PGN, FEN, auth tokens, API keys, or backup files are included.',
      context,
    },
    null,
    2
  )}\n`;
}

export function getCoachExportDate(generatedAt: string = new Date().toISOString()): string {
  const parsed = new Date(generatedAt);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function buildPlayerProgressCoachSummary(
  progress: Awaited<ReturnType<typeof getPlayerProgressSummary>>
): PlayerProgressCoachSummary {
  return {
    total_xp: asNumber(progress.total_xp),
    level: asNumber(progress.level, 1),
    current_streak_days: asNumber(progress.current_streak_days),
    best_streak_days: asNumber(progress.best_streak_days),
    total_games: asNumber(progress.total_games),
    mirror_matches: asNumber(progress.total_mirror_matches),
    clue_attempts: asNumber(progress.clue_attempts),
    clue_solved: asNumber(progress.clue_solved),
    story_chapters_complete: asNumber(progress.story_chapters_complete),
    story_total_chapters: asNumber(progress.story_total_chapters, mahabharataStorySeed.length),
    due_reviews_count: asNumber(progress.due_reviews_count),
    next_action: progress.next_action || '',
  };
}

function buildStyleVectorSummary(
  record: NonNullable<Awaited<ReturnType<typeof getCurrentStyleVectorRecord>>>
): StyleVectorSummary {
  const vector = (record.vector || {}) as Partial<StyleVector>;
  return {
    available: true,
    style_vector_id: record.id,
    source: record.source,
    computed_at: record.computed_at,
    behavioral_field_count: 11,
    dimensionality_note:
      'StyleVector has 11 behavioral/profile fields plus schema_version metadata in the current code.',
    opening_white_top3: Array.isArray(vector.opening_white_top3) ? vector.opening_white_top3 : [],
    opening_black_top3: Array.isArray(vector.opening_black_top3) ? vector.opening_black_top3 : [],
    avg_move_time_ms: asNumber(vector.avg_move_time_ms),
    time_pressure_blunder_rate: asNumber(vector.time_pressure_blunder_rate),
    exchange_willingness: asNumber(vector.exchange_willingness),
    preferred_minor: vector.preferred_minor || 'unknown',
    motif_blindness: vector.motif_blindness || {},
    endgame_strength: asNumber(vector.endgame_strength),
    swindle_preference: vector.swindle_preference || null,
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
    if (attempt.solved === true) {
      row.solved += 1;
    } else {
      row.failed += 1;
    }
  }

  for (const review of puzzleReviews) {
    const motif = review.motif || 'unknown';
    const row = getMotifRow(byMotif, motif);
    row.review_lapses += asNumber(review.lapses);
    if (review.next_due_at && isDue(review.next_due_at, new Date())) {
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
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

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

  const summaries = completed.map((analysis) => analysis.summary || {});
  const cpLosses = summaries.map((summary) => asNumber(summary.average_cp_loss));
  const first = cpLosses[0];
  const last = cpLosses[cpLosses.length - 1];
  const latest = completed[completed.length - 1];
  const latestSummary = latest.summary || {};
  let trend: AnalysisQualitySummary['trend'] = 'insufficient_data';
  if (completed.length > 1) {
    if (last <= first - 5) trend = 'improving';
    else if (last >= first + 5) trend = 'regressing';
    else trend = 'stable';
  }

  return {
    analyses_completed: completed.length,
    average_cp_loss: round(average(cpLosses)),
    accuracy_estimate: round(average(summaries.map((summary) => asNumber(summary.accuracy_estimate)))),
    blunder_count: summaries.reduce((total, summary) => total + asNumber(summary.blunder_count), 0),
    mistake_count: summaries.reduce((total, summary) => total + asNumber(summary.mistake_count), 0),
    latest_average_cp_loss: asNumber(latestSummary.average_cp_loss),
    latest_accuracy_estimate: asNumber(latestSummary.accuracy_estimate),
    latest_blunder_count: asNumber(latestSummary.blunder_count),
    latest_mistake_count: asNumber(latestSummary.mistake_count),
    latest_completed_at: latest.completed_at || latest.created_at,
    trend,
  };
}

function buildSpacedRepetitionSummary(reviews: PuzzleReviewRecord[]): SpacedRepetitionSummary {
  const due = reviews.filter((review) => review.next_due_at && isDue(review.next_due_at, new Date()));
  return {
    total_reviews: reviews.length,
    due_reviews_count: due.length,
    due_motifs: Array.from(new Set(due.map((review) => review.motif || 'unknown'))).sort(),
    lapse_count: reviews.reduce((total, review) => total + asNumber(review.lapses), 0),
  };
}

function buildStoryProgressSummary(
  records: StoryProgressRecord[],
  currentStoryChapter?: string
): StoryProgressSummary {
  const completed = records.filter((record) => record.status === 'complete').length;
  const available = currentStoryChapter || records.find((record) => record.status === 'available')?.chapter_id;
  const attempted = records.some((record) => asNumber(record.attempts) > 0);
  const currentChapter = mahabharataStorySeed.find((chapter) => chapter.id === available);
  const hasProgress = records.length > 0;
  const allComplete = completed >= mahabharataStorySeed.length && mahabharataStorySeed.length > 0;
  const status: StoryProgressSummary['status'] = allComplete
    ? 'complete'
    : attempted
      ? 'in_progress'
      : available
        ? 'available'
        : 'not_started';

  return {
    has_progress: hasProgress,
    completed_chapters: completed,
    total_chapters: mahabharataStorySeed.length,
    current_story_chapter: available,
    current_story_title: currentChapter?.title,
    current_story_act: currentChapter?.act_title,
    status,
    recommendation: available
      ? `Continue Story Mode: ${currentChapter?.act_title ? `${currentChapter.act_title} - ` : ''}${currentChapter?.title || available}.`
      : allComplete
        ? 'Story Mode is complete; review earlier encounters for practice.'
        : 'Start or unlock the next Story Mode encounter when ready.',
  };
}

function buildRecommendedActions(
  puzzleWeakness: PuzzleWeaknessSummary,
  analysisQuality: AnalysisQualitySummary,
  spacedRepetition: SpacedRepetitionSummary,
  storySummary: StoryProgressSummary,
  fallbackNextAction: string,
  calibrationStatus: string | undefined,
  styleVectorSummary: StyleVectorSummary
): string[] {
  const actions: string[] = [];
  if (calibrationStatus !== 'complete' || !styleVectorSummary.available) {
    actions.push('Complete calibration to improve local coach personalization.');
  }
  if (spacedRepetition.due_reviews_count > 0) {
    actions.push(
      `Review ${spacedRepetition.due_reviews_count} due puzzle${spacedRepetition.due_reviews_count === 1 ? '' : 's'} before adding new material.`
    );
  }
  if (puzzleWeakness.weakest_motif) {
    actions.push(`Practice ${formatMotif(puzzleWeakness.weakest_motif)} motifs in Clue Chess.`);
  }
  if (analysisQuality.analyses_completed === 0) {
    actions.push('Analyze one completed local game to seed CP-loss coaching.');
  }
  if (storySummary.current_story_chapter) {
    actions.push(storySummary.recommendation);
  }
  if (actions.length === 0 && fallbackNextAction) actions.push(fallbackNextAction);
  return actions;
}

function buildCoachSummary(context: MirrorCoachContext): CoachSummary {
  const flags = buildInsufficientDataFlags(context);
  return {
    recommended_focus_area: chooseRecommendedFocus(context, flags),
    confidence_level: estimateCoachConfidence(context, flags),
    insufficient_data_flags: flags,
    weakest_motif: context.puzzle_weakness_summary.weakest_motif,
    strongest_motif: context.puzzle_weakness_summary.strongest_motif,
    review_due_count: context.spaced_repetition_summary.due_reviews_count,
    recent_analysis_quality: context.analysis_quality_summary,
    story_progress_status: context.story_progress_summary.status,
    achievement_count: context.player_profile_summary.achievements_count,
    style_vector_available: context.style_vector_summary.available,
  };
}

function buildInsufficientDataFlags(context: MirrorCoachContext): string[] {
  const flags: string[] = [];
  if (!context.player_profile_summary.player_found) flags.push('missing_player_profile');
  if (context.player_profile_summary.calibration_status !== 'complete') flags.push('calibration_incomplete');
  if (!context.style_vector_summary.available) flags.push('missing_style_vector');
  if (!context.puzzle_weakness_summary.has_history) flags.push('no_puzzle_history');
  if (context.analysis_quality_summary.analyses_completed === 0) flags.push('no_analysis_history');
  if (!context.story_progress_summary.has_progress) flags.push('no_story_progress');
  if (context.player_profile_summary.total_games === 0) flags.push('no_local_game_history');
  if (context.player_profile_summary.mirror_matches === 0) flags.push('no_mirror_match_history');
  return flags;
}

function chooseRecommendedFocus(context: MirrorCoachContext, flags: string[]): string {
  if (!context.player_profile_summary.player_found) return 'Create a local player profile';
  if (flags.includes('calibration_incomplete') || flags.includes('missing_style_vector')) {
    return 'Complete calibration for personalization';
  }
  if (context.spaced_repetition_summary.due_reviews_count > 0) return 'Clear due puzzle reviews';
  if (context.puzzle_weakness_summary.weakest_motif) {
    return `Practice ${formatMotif(context.puzzle_weakness_summary.weakest_motif)} motifs`;
  }
  if (context.analysis_quality_summary.analyses_completed === 0) return 'Analyze a completed game';
  if (context.player_profile_summary.mirror_matches === 0) return 'Play a Mirror match';
  if (context.story_progress_summary.current_story_chapter) return 'Continue Story Mode';
  return context.player_progress_summary.next_action || 'Keep one local training action queued';
}

function estimateCoachConfidence(context: MirrorCoachContext, flags: string[]): CoachConfidence {
  if (!context.player_profile_summary.player_found) return 'low';
  const evidenceSignals = [
    context.style_vector_summary.available,
    context.puzzle_weakness_summary.has_history,
    context.analysis_quality_summary.analyses_completed > 0,
    context.story_progress_summary.has_progress,
    context.player_profile_summary.total_games > 0 || context.player_profile_summary.mirror_matches > 0,
  ].filter(Boolean).length;

  if (evidenceSignals >= 4 && flags.length <= 2) return 'high';
  if (evidenceSignals >= 2) return 'medium';
  return 'low';
}

function emptyCoachContext(playerId: string): MirrorCoachContext {
  const context: MirrorCoachContext = {
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
    player_progress_summary: {
      total_xp: 0,
      level: 1,
      current_streak_days: 0,
      best_streak_days: 0,
      total_games: 0,
      mirror_matches: 0,
      clue_attempts: 0,
      clue_solved: 0,
      story_chapters_complete: 0,
      story_total_chapters: mahabharataStorySeed.length,
      due_reviews_count: 0,
      next_action: 'Create or select a local player profile before coaching.',
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
      has_progress: false,
      completed_chapters: 0,
      total_chapters: mahabharataStorySeed.length,
      status: 'not_started',
      recommendation: 'Create or select a local player profile before coaching.',
    },
    coach_summary: emptyCoachSummary(),
    coach_cards: [],
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
  context.coach_summary = buildCoachSummary(context);
  return context;
}

function emptyCoachSummary(): CoachSummary {
  return {
    recommended_focus_area: 'Collect enough local data for personalized coaching',
    confidence_level: 'low',
    insufficient_data_flags: [],
    review_due_count: 0,
    recent_analysis_quality: {
      analyses_completed: 0,
      average_cp_loss: 0,
      accuracy_estimate: 0,
      blunder_count: 0,
      mistake_count: 0,
      trend: 'insufficient_data',
    },
    story_progress_status: 'not_started',
    achievement_count: 0,
    style_vector_available: false,
  };
}

function sortCards(cards: CoachCard[]): CoachCard[] {
  return [...cards].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.id.localeCompare(b.id);
  });
}

function storyLabel(summary: StoryProgressSummary): string {
  return summary.current_story_title || summary.current_story_chapter || 'the next chapter';
}

function formatList(values: string[]): string {
  if (values.length === 0) return 'none';
  return values.map(formatMotif).join(', ');
}

function formatMotif(motif: string): string {
  return motif.replace(/_/g, ' ');
}

function formatOptional(value?: string): string {
  return value ? formatMotif(value) : 'insufficient data';
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
