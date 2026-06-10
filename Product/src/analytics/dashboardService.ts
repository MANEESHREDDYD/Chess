import {
  getCurrentStyleVectorRecord,
  openMirrorDb,
  type AchievementRecord,
  type ClueAttemptRecord,
  type FeedbackRecord,
  type ImportedGameRecord,
  type LocalMatchRecord,
  type MirrorMatchRecord,
  type PlayerRecord,
  type PuzzleReviewRecord,
  type StoryProgressRecord,
  type StyleVector,
  type StyleVectorRecord,
} from '../data/db';
import { mahabharataStorySeed } from '../story/mahabharataStorySeed';
import type { GamePhase, GameReviewRecord, MoveClassification, MoveReview } from '../review/reviewTypes';
import { evaluateDashboardDataQuality } from './dataQuality';
import { generateAnalyticsRecommendedActions } from './recommendedActions';
import type {
  AnalyticsDashboardSnapshot,
  AnalyticsExportSafety,
  GameReviewAnalyticsSummary,
  ImportedGameAnalyticsSummary,
  MirrorAnalyticsSummary,
  MotifAnalyticsRow,
  PlayerSummaryAnalytics,
  ProgressionAnalyticsSummary,
  PuzzleAnalyticsSummary,
  ReviewQueueAnalyticsSummary,
  ReviewTrendPoint,
  StoryAnalyticsSummary,
  StyleVectorAnalyticsSummary,
  StyleVectorMetric,
} from './dashboardTypes';

const SOURCE_FILES = [
  'IndexedDB:players',
  'IndexedDB:local_matches',
  'IndexedDB:mirror_matches',
  'IndexedDB:imported_games',
  'IndexedDB:game_reviews',
  'IndexedDB:saved_analyses',
  'IndexedDB:clue_attempts',
  'IndexedDB:puzzle_reviews',
  'IndexedDB:story_progress',
  'IndexedDB:achievements',
  'IndexedDB:style_vectors',
];

const CLASSIFICATIONS: MoveClassification[] = [
  'brilliant',
  'best',
  'excellent',
  'good',
  'inaccuracy',
  'mistake',
  'blunder',
  'missed_win',
  'forced',
  'book',
  'unknown',
];

const PHASES: GamePhase[] = ['opening', 'middlegame', 'endgame'];
const SECRET_PATTERN = /(access_token|refresh_token|service_role|supabase|jwt|api[_-]?key|secret[_-]?key|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/i;
const RAW_GAME_PATTERN = /\b(?:\[Event\s+"|1\.\s*(?:\.\.\.\s*)?[KQRNB]?[a-h][1-8]?|(?:[prnbqkPRNBQK1-8]+\/){7}[prnbqkPRNBQK1-8]+\s+[wb]\s)/;

export async function buildAnalyticsDashboardSnapshot(
  requestedPlayerId?: string | null,
  dbName?: string
): Promise<AnalyticsDashboardSnapshot> {
  const db = await openMirrorDb(dbName);
  const players = await db.getAll('players');
  const player = requestedPlayerId
    ? await db.get('players', requestedPlayerId)
    : players[0];
  const playerId = player?.id ?? requestedPlayerId ?? 'no-active-player';

  if (!player) {
    const snapshot = buildEmptySnapshot(playerId, 'Create or select a local player profile.');
    snapshot.data_quality = evaluateDashboardDataQuality({
      hasActivePlayer: false,
      hasStyleVector: false,
      importedGamesCount: 0,
      reviewedGamesCount: 0,
      puzzleAttemptsCount: 0,
      puzzleReviewsCount: 0,
      mirrorMatchesCount: 0,
      storyProgressCount: 0,
    });
    snapshot.recommended_actions = generateAnalyticsRecommendedActions(snapshot);
    return snapshot;
  }

  const [
    localMatches,
    mirrorMatches,
    importedGames,
    gameReviews,
    clueAttempts,
    puzzleReviews,
    storyProgress,
    achievements,
    feedback,
    styleVectorRecord,
  ] = await Promise.all([
    db.getAllFromIndex('local_matches', 'created_at').then((rows) => rows.filter((row) => row.player_id === player.id)),
    db.getAll('mirror_matches').then((rows) => rows.filter((row) => row.player_id === player.id)),
    db.getAllFromIndex('imported_games', 'player_id', player.id),
    db.getAllFromIndex('game_reviews', 'player_id', player.id),
    db.getAllFromIndex('clue_attempts', 'player_id', player.id),
    db.getAllFromIndex('puzzle_reviews', 'player_id', player.id),
    db.getAllFromIndex('story_progress', 'player_id', player.id),
    db.getAllFromIndex('achievements', 'player_id', player.id),
    db.getAll('feedback').then((rows) => rows.filter((row) => row.player_id === player.id)),
    getCurrentStyleVectorRecord(player.id, dbName),
  ]);

  const sortedReviews = sortByDateDesc(gameReviews, (review) => review.created_at);
  const completedMirrorMatches = mirrorMatches.filter((match) => Boolean(match.completed_at));
  const dataQuality = evaluateDashboardDataQuality({
    hasActivePlayer: true,
    hasStyleVector: Boolean(styleVectorRecord),
    importedGamesCount: importedGames.length,
    reviewedGamesCount: gameReviews.length,
    puzzleAttemptsCount: clueAttempts.length,
    puzzleReviewsCount: puzzleReviews.length,
    mirrorMatchesCount: completedMirrorMatches.length,
    storyProgressCount: storyProgress.length,
  });

  const baseSnapshot: Omit<AnalyticsDashboardSnapshot, 'recommended_actions'> = {
    generated_at: new Date().toISOString(),
    player_id: player.id,
    source_files: SOURCE_FILES,
    data_quality: dataQuality,
    player_summary: buildPlayerSummary(player, {
      localMatches,
      mirrorMatches: completedMirrorMatches,
      importedGames,
      gameReviews,
      clueAttempts,
      storyProgress,
      achievements,
    }),
    review_summary: buildGameReviewSummary(sortedReviews),
    imported_game_summary: buildImportedGameSummary(importedGames, sortedReviews),
    stylevector_summary: buildStyleVectorSummary(styleVectorRecord, {
      importedGames,
      feedback,
      calibrationStatus: player.calibration_status,
      reviewedGamesCount: gameReviews.length,
    }),
    puzzle_summary: buildPuzzleSummary(clueAttempts, puzzleReviews, sortedReviews, styleVectorRecord?.vector ?? null),
    review_queue_summary: buildReviewQueueSummary(puzzleReviews),
    mirror_summary: buildMirrorSummary(completedMirrorMatches, feedback),
    story_summary: buildStorySummary(storyProgress),
    progression_summary: buildProgressionSummary({
      localMatches,
      mirrorMatches: completedMirrorMatches,
      gameReviews,
      clueAttempts,
      storyProgress,
      achievements,
    }),
    export_safety: exportSafety(),
  };

  return {
    ...baseSnapshot,
    recommended_actions: generateAnalyticsRecommendedActions(baseSnapshot),
  };
}

export function buildAnalyticsDashboardMarkdown(snapshot: AnalyticsDashboardSnapshot): string {
  const actions = snapshot.recommended_actions
    .map((item) => `- ${sanitizeExportText(item.title)}: ${sanitizeExportText(item.reason)}`)
    .join('\n');
  const motifs = snapshot.puzzle_summary.motif_rows.slice(0, 6)
    .map((row) => `- ${formatMotif(row.motif)}: ${row.solved_rate}% solved, ${row.due_reviews} due review(s).`)
    .join('\n');

  return [
    '# MIRROR Advanced Analytics Dashboard',
    '',
    `Generated: ${snapshot.generated_at}`,
    'Local-first note: this dashboard is generated from local IndexedDB summaries. Runtime GenAI, cloud upload, OAuth, and raw PGN export are not used.',
    '',
    '## Player Intelligence',
    '',
    `- Player: ${sanitizeExportText(snapshot.player_summary.display_name)}`,
    `- Local games: ${snapshot.player_summary.total_local_games}`,
    `- Mirror matches: ${snapshot.player_summary.total_mirror_matches}`,
    `- Imported games: ${snapshot.player_summary.total_imported_games}`,
    `- Reviewed games: ${snapshot.player_summary.total_reviewed_games}`,
    `- Recommendation: ${sanitizeExportText(snapshot.player_summary.recommendation)}`,
    '',
    '## Game Review Pro',
    '',
    `- Reviewed games: ${snapshot.review_summary.reviewed_games_count}`,
    `- Average CP loss: ${snapshot.review_summary.average_cp_loss}`,
    `- MIRROR internal accuracy estimate: ${snapshot.review_summary.accuracy_estimate}%`,
    `- Weakest phase: ${snapshot.review_summary.weakest_phase ?? 'insufficient data'}`,
    `- Recommendation: ${snapshot.review_summary.recommended_action}`,
    '',
    '## StyleVector',
    '',
    `- Available: ${snapshot.stylevector_summary.available ? 'yes' : 'no'}`,
    `- Evidence source: ${snapshot.stylevector_summary.evidence_source}`,
    `- Confidence: ${snapshot.stylevector_summary.confidence}`,
    `- Recommendation: ${snapshot.stylevector_summary.recommendation}`,
    '',
    '## Weak Motifs and Puzzle Queue',
    '',
    motifs || '- Insufficient motif data.',
    `- Review queue: ${snapshot.review_queue_summary.due_reviews_count} due, ${snapshot.review_queue_summary.overdue_reviews_count} overdue.`,
    `- Recommendation: ${snapshot.puzzle_summary.recommended_action}`,
    '',
    '## Imported Game Coverage',
    '',
    `- Valid imported games: ${snapshot.imported_game_summary.valid_games_count}`,
    `- Analysis coverage: ${snapshot.imported_game_summary.analysis_coverage_percent}%`,
    `- Recommendation: ${snapshot.imported_game_summary.recommendation}`,
    '',
    '## Mirror and Story',
    '',
    `- Mirror matches: ${snapshot.mirror_summary.mirror_matches_count}`,
    `- Mirror recommendation: ${snapshot.mirror_summary.recommendation}`,
    `- Story: ${snapshot.story_summary.completed_chapters}/${snapshot.story_summary.total_chapters} chapters complete.`,
    `- Story recommendation: ${snapshot.story_summary.recommendation}`,
    '',
    '## Recommended Next Actions',
    '',
    actions || '- Insufficient data: create local activity first.',
    '',
    '## Data Quality',
    '',
    ...snapshot.data_quality.findings.map((finding) => `- ${finding.severity}: ${sanitizeExportText(finding.message)} ${sanitizeExportText(finding.recommended_action)}`),
    '',
    'Export safety: summaries only; raw PGN, raw backup JSON, auth tokens, and service keys are excluded.',
  ].join('\n');
}

export function buildAnalyticsDashboardJson(snapshot: AnalyticsDashboardSnapshot): string {
  return `${JSON.stringify(
    {
      schema: 'mirror_analytics_dashboard_snapshot_v1',
      privacy_note: 'Summary-first local export. No raw PGN, raw backup JSON, auth tokens, or service-role keys are included.',
      snapshot,
    },
    null,
    2
  )}\n`;
}

export function getAnalyticsExportDate(generatedAt: string = new Date().toISOString()): string {
  const parsed = new Date(generatedAt);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

export function analyticsExportContainsUnsafeText(text: string): boolean {
  return SECRET_PATTERN.test(text) || RAW_GAME_PATTERN.test(text);
}

function buildEmptySnapshot(playerId: string, recommendation: string): AnalyticsDashboardSnapshot {
  const now = new Date().toISOString();
  const snapshot: AnalyticsDashboardSnapshot = {
    generated_at: now,
    player_id: playerId,
    source_files: SOURCE_FILES,
    data_quality: {
      passed: false,
      findings: [],
      missing_area_count: 0,
      warning_count: 0,
      error_count: 0,
    },
    player_summary: {
      player_found: false,
      display_name: 'No active player',
      calibration_status: 'not_started',
      total_local_games: 0,
      total_mirror_matches: 0,
      total_imported_games: 0,
      total_reviewed_games: 0,
      active_days: 0,
      recommendation,
    },
    review_summary: emptyReviewSummary(),
    imported_game_summary: emptyImportedSummary(),
    stylevector_summary: emptyStyleVectorSummary(),
    puzzle_summary: emptyPuzzleSummary(),
    review_queue_summary: emptyReviewQueueSummary(),
    mirror_summary: emptyMirrorSummary(),
    story_summary: emptyStorySummary(),
    progression_summary: {
      xp: 0,
      level: 1,
      achievements_count: 0,
      current_streak_days: 0,
      best_streak_days: 0,
      story_rank: 'Unstarted',
      recommendation: 'Create a local player profile to start progression.',
    },
    recommended_actions: [],
    export_safety: exportSafety(),
  };
  return snapshot;
}

function buildPlayerSummary(
  player: PlayerRecord,
  records: {
    localMatches: LocalMatchRecord[];
    mirrorMatches: MirrorMatchRecord[];
    importedGames: ImportedGameRecord[];
    gameReviews: GameReviewRecord[];
    clueAttempts: ClueAttemptRecord[];
    storyProgress: StoryProgressRecord[];
    achievements: AchievementRecord[];
  }
): PlayerSummaryAnalytics {
  const activityDates = new Set<string>();
  const activityTimes: string[] = [];
  collectDates(activityDates, activityTimes, records.localMatches, (row) => row.completed_at || row.created_at);
  collectDates(activityDates, activityTimes, records.mirrorMatches, (row) => row.completed_at || row.started_at);
  collectDates(activityDates, activityTimes, records.importedGames, (row) => row.imported_at);
  collectDates(activityDates, activityTimes, records.gameReviews, (row) => row.created_at);
  collectDates(activityDates, activityTimes, records.clueAttempts, (row) => row.completed_at || row.started_at || row.created_at);
  collectDates(activityDates, activityTimes, records.storyProgress, (row) => row.updated_at);
  collectDates(activityDates, activityTimes, records.achievements, (row) => row.earned_at);

  const recommendation = player.calibration_status !== 'complete'
    ? 'Complete calibration so dashboard actions can use StyleVector personalization.'
    : records.gameReviews.length === 0
      ? 'Analyze one completed or imported game to unlock Game Review Pro trends.'
      : 'Use the top recommended action to keep the local improvement loop moving.';

  return {
    player_found: true,
    display_name: player.display_name || 'Local player',
    calibration_status: player.calibration_status || 'not_started',
    total_local_games: records.localMatches.length,
    total_mirror_matches: records.mirrorMatches.length,
    total_imported_games: records.importedGames.length,
    total_reviewed_games: records.gameReviews.length,
    active_days: activityDates.size,
    latest_activity_at: lastSortedValue(activityTimes),
    recommendation,
  };
}

function buildGameReviewSummary(reviews: GameReviewRecord[]): GameReviewAnalyticsSummary {
  if (reviews.length === 0) return emptyReviewSummary();

  const moves = reviews.flatMap((review) => review.move_reviews);
  const losses = moves.map((move) => move.cp_loss).filter(isFiniteNumber);
  const averageCpLoss = losses.length > 0 ? round(average(losses)) : 0;
  const accuracies = reviews.flatMap((review) => [review.accuracy_white, review.accuracy_black]).filter(isFiniteNumber);
  const classificationDistribution = CLASSIFICATIONS
    .map((label) => ({ label, count: moves.filter((move) => move.classification === label).length }))
    .filter((row) => row.count > 0);
  const phaseRows = buildPhaseRows(moves);
  const weakestPhase = phaseRows
    .filter((row) => row.reviewed_moves > 0)
    .sort((a, b) => b.average_cp_loss - a.average_cp_loss || b.blunders - a.blunders)[0]?.phase;
  const latestKeyMoment = reviews.find((review) => review.key_moments.length > 0)?.key_moments[0];
  const latestReviewWithKey = latestKeyMoment
    ? reviews.find((review) => review.key_moments.some((moment) => moment.id === latestKeyMoment.id))
    : undefined;

  return {
    reviewed_games_count: reviews.length,
    reviewed_imported_games_count: reviews.filter((review) => review.source_type === 'imported_game').length,
    average_cp_loss: averageCpLoss,
    accuracy_estimate: accuracies.length > 0 ? round(average(accuracies)) : 0,
    blunder_count: countClassification(moves, 'blunder'),
    mistake_count: countClassification(moves, 'mistake'),
    inaccuracy_count: countClassification(moves, 'inaccuracy'),
    best_or_excellent_count: countClassification(moves, 'best') + countClassification(moves, 'excellent'),
    most_common_move_label: classificationDistribution.sort((a, b) => b.count - a.count)[0]?.label,
    weakest_phase: weakestPhase,
    latest_key_moment: latestKeyMoment && latestReviewWithKey
      ? {
          move_number: latestKeyMoment.move_number,
          san: latestKeyMoment.san,
          reason: latestKeyMoment.reason,
          source_id: latestReviewWithKey.source_id,
          route: `/review/${latestReviewWithKey.source_type}/${latestReviewWithKey.source_id}`,
        }
      : undefined,
    cp_loss_trend: buildReviewTrend(reviews),
    classification_distribution: classificationDistribution,
    phase_weakness_bars: phaseRows,
    interpretation: weakestPhase
      ? `Highest MIRROR internal CP-loss appears in the ${weakestPhase}.`
      : 'Reviewed games exist, but phase evidence is still thin.',
    recommended_action: weakestPhase
      ? `Replay one ${weakestPhase} key moment and compare it to the local best move.`
      : 'Review more games to identify phase weaknesses confidently.',
  };
}

function buildImportedGameSummary(
  importedGames: ImportedGameRecord[],
  reviews: GameReviewRecord[]
): ImportedGameAnalyticsSummary {
  if (importedGames.length === 0) return emptyImportedSummary();

  const validGames = importedGames.filter((game) => game.legal_status === 'valid');
  const analyzedGames = importedGames.filter((game) => game.analysis_status === 'analyzed');
  const sourceBreakdown = importedGames.reduce<Record<string, number>>((acc, game) => {
    acc[game.source] = (acc[game.source] ?? 0) + 1;
    return acc;
  }, {});
  const reviewedSourceIds = new Set(reviews.filter((review) => review.source_type === 'imported_game').map((review) => review.source_id));
  const coverage = validGames.length > 0 ? round((analyzedGames.length / validGames.length) * 100) : 0;

  return {
    imported_games_count: importedGames.length,
    valid_games_count: validGames.length,
    invalid_or_partial_count: importedGames.length - validGames.length,
    source_breakdown: sourceBreakdown,
    reviewed_imported_games_count: validGames.filter((game) => reviewedSourceIds.has(game.id)).length,
    analyzed_imported_games_count: analyzedGames.length,
    analysis_coverage_percent: coverage,
    last_import_at: sortByDateDesc(importedGames, (game) => game.imported_at)[0]?.imported_at,
    recommendation: validGames.length === 0
      ? 'Import at least one valid PGN before using imported-game review analytics.'
      : coverage < 60
        ? 'Analyze a small batch of valid imported games to improve StyleVector and review coverage.'
        : 'Review the most recent valid imported game and feed the key moment into training.',
  };
}

function buildStyleVectorSummary(
  record: StyleVectorRecord | null,
  context: {
    importedGames: ImportedGameRecord[];
    feedback: FeedbackRecord[];
    calibrationStatus?: PlayerRecord['calibration_status'];
    reviewedGamesCount: number;
  }
): StyleVectorAnalyticsSummary {
  if (!record) return emptyStyleVectorSummary();

  const vector = record.vector;
  const motifValues = Object.values(vector.motif_blindness ?? {}).filter(isFiniteNumber);
  const motifAverage = motifValues.length > 0 ? round(average(motifValues) * 100) : 0;
  const swindleSignal = vector.swindle_preference === 'swindle' ? 70 : 35;
  const riskProxy = round(average([
    clamp01(vector.exchange_willingness) * 100,
    clamp01(vector.time_pressure_blunder_rate) * 100,
    motifAverage,
    swindleSignal,
  ]));
  const evidenceSource = styleEvidenceSource(record, context);
  const confidence = styleConfidence(record, context);
  const metrics: StyleVectorMetric[] = [
    metric('aggression-risk', 'Aggression/risk proxy', riskProxy, 'Composite proxy from exchange willingness, time pressure risk, motif blindness, and swindle preference.'),
    metric('exchange', 'Exchange willingness', round(clamp01(vector.exchange_willingness) * 100), 'How often calibration/import evidence points toward accepting exchanges.'),
    metric('time-pressure', 'Time-pressure risk', round(clamp01(vector.time_pressure_blunder_rate) * 100), 'Only meaningful when clock or calibration evidence exists.'),
    metric('motif-blindness', 'Motif blindness average', motifAverage, 'Average blindness across StyleVector motif fields. Lower is stronger.'),
    metric('endgame', 'Endgame strength', round(clamp01(vector.endgame_strength) * 100), 'Calibration-derived endgame strength proxy.'),
  ];

  return {
    available: true,
    source: record.source,
    confidence,
    evidence_source: evidenceSource,
    aggression_risk_proxy: riskProxy,
    exchange_willingness: round(clamp01(vector.exchange_willingness) * 100),
    time_pressure_risk: round(clamp01(vector.time_pressure_blunder_rate) * 100),
    motif_blindness_average: motifAverage,
    endgame_strength: round(clamp01(vector.endgame_strength) * 100),
    swindle_preference: vector.swindle_preference ?? 'none',
    detected_elo_band: vector.elo_band || 'unknown',
    opening_white_top3: vector.opening_white_top3 ?? [],
    opening_black_top3: vector.opening_black_top3 ?? [],
    preferred_minor: vector.preferred_minor || 'neutral',
    metrics,
    recommendation: confidence === 'low'
      ? 'Calibrate or import more user-attributed games before trusting style-heavy recommendations.'
      : context.reviewedGamesCount === 0
        ? 'Analyze one game so StyleVector can be connected to concrete move mistakes.'
        : 'Play Mirror improved self to test whether the StyleVector-backed guidance transfers into play.',
  };
}

function buildPuzzleSummary(
  clueAttempts: ClueAttemptRecord[],
  puzzleReviews: PuzzleReviewRecord[],
  gameReviews: GameReviewRecord[],
  styleVector: StyleVector | null
): PuzzleAnalyticsSummary {
  const rows = new Map<string, MotifAnalyticsRow>();
  for (const attempt of clueAttempts) {
    const row = motifRow(rows, attempt.motif || 'unknown');
    row.attempts += 1;
    if (attempt.solved) row.solved += 1;
    else row.failed += 1;
  }

  for (const review of puzzleReviews) {
    const row = motifRow(rows, review.motif || 'unknown');
    row.review_lapses += finiteNumber(review.lapses);
    if (isDue(review.next_due_at)) row.due_reviews += 1;
  }

  for (const move of gameReviews.flatMap((review) => review.move_reviews)) {
    if (!['inaccuracy', 'mistake', 'blunder', 'missed_win'].includes(move.classification)) continue;
    for (const motif of move.motif_tags ?? []) {
      const row = motifRow(rows, motif || 'unknown');
      row.review_mistakes += 1;
    }
  }

  for (const [motif, blindness] of Object.entries(styleVector?.motif_blindness ?? {})) {
    motifRow(rows, motif).stylevector_blindness = round(clamp01(blindness) * 100);
  }

  const motifRows = Array.from(rows.values()).map((row) => ({
    ...row,
    solved_rate: row.attempts > 0 ? round((row.solved / row.attempts) * 100) : 0,
  }));
  const solvedRate = clueAttempts.length > 0
    ? round((clueAttempts.filter((attempt) => attempt.solved).length / clueAttempts.length) * 100)
    : 0;
  const weakest = [...motifRows]
    .filter((row) => row.attempts > 0 || row.review_lapses > 0 || row.review_mistakes > 0 || row.stylevector_blindness !== undefined)
    .sort((a, b) => motifWeaknessScore(b) - motifWeaknessScore(a))[0]?.motif;
  const strongest = [...motifRows]
    .filter((row) => row.attempts > 0)
    .sort((a, b) => b.solved_rate - a.solved_rate || b.solved - a.solved)[0]?.motif;

  return {
    clue_attempts: clueAttempts.length,
    solved_rate: solvedRate,
    weakest_motif: weakest,
    strongest_motif: strongest,
    motif_rows: motifRows.sort((a, b) => motifWeaknessScore(b) - motifWeaknessScore(a)),
    repeated_review_failure_count: puzzleReviews.filter((review) => review.lapses >= 2).length,
    interpretation: weakest
      ? `${formatMotif(weakest)} has the strongest current weakness signal.`
      : 'Insufficient motif history: solve Clue Chess puzzles or review more games.',
    recommended_action: weakest
      ? `Start a focused Clue Chess set on ${formatMotif(weakest)}.`
      : 'Solve at least three clue puzzles to seed motif analytics.',
  };
}

function buildReviewQueueSummary(puzzleReviews: PuzzleReviewRecord[]): ReviewQueueAnalyticsSummary {
  const due = puzzleReviews.filter((review) => isDue(review.next_due_at));
  const overdue = puzzleReviews.filter((review) => isOverdue(review.next_due_at));
  const upcoming = puzzleReviews.filter((review) => !isDue(review.next_due_at));
  const intervals = puzzleReviews.map((review) => review.interval_days).filter(isFiniteNumber);
  const queuePreview = [...due]
    .sort((a, b) => b.lapses - a.lapses || a.next_due_at.localeCompare(b.next_due_at))
    .slice(0, 5)
    .map((review) => ({
      puzzle_id: review.puzzle_id,
      motif: review.motif,
      next_due_at: review.next_due_at,
      lapses: review.lapses,
    }));

  return {
    total_reviews: puzzleReviews.length,
    due_reviews_count: due.length,
    overdue_reviews_count: overdue.length,
    upcoming_reviews_count: upcoming.length,
    average_interval_days: intervals.length > 0 ? round(average(intervals)) : 0,
    due_motifs: Array.from(new Set(due.map((review) => review.motif))).sort(),
    queue_preview: queuePreview,
    recommendation: due.length > 0
      ? 'Review due puzzles before adding new themes.'
      : puzzleReviews.length > 0
        ? 'No reviews are due; solve a fresh Clue Chess puzzle to grow the queue.'
        : 'Solve Clue Chess puzzles to create a review queue.',
  };
}

function buildMirrorSummary(matches: MirrorMatchRecord[], feedback: FeedbackRecord[]): MirrorAnalyticsSummary {
  const modes = new Set<string>();
  const feedbackTags: Record<string, number> = {
    felt_like_me: 0,
    too_strong: 0,
    too_random: 0,
    too_aggressive: 0,
    too_passive: 0,
    good_training: 0,
  };

  for (const match of matches) {
    const mode = stringValue(match.metadata?.personality_mode);
    if (mode) modes.add(mode);
  }

  for (const item of feedback) {
    const mode = stringValue(item.metadata?.personality_mode);
    if (mode) modes.add(mode);
    if (item.felt_like_me === 'yes') feedbackTags.felt_like_me += 1;
    if (item.perceived_strength === 'stronger') feedbackTags.too_strong += 1;
    const tags = Array.isArray(item.metadata?.feedback_tags) ? item.metadata.feedback_tags : [];
    for (const tag of tags) {
      if (typeof tag === 'string') feedbackTags[tag] = (feedbackTags[tag] ?? 0) + 1;
    }
  }

  const latest = sortByDateDesc(matches, (match) => match.completed_at || match.started_at)[0];
  return {
    mirror_matches_count: matches.length,
    personality_modes_played: Array.from(modes).sort(),
    feedback_tags: feedbackTags,
    felt_like_me_count: feedbackTags.felt_like_me,
    too_random_count: feedbackTags.too_random,
    latest_result: latest?.result,
    latest_mode: stringValue(latest?.metadata?.personality_mode),
    recommendation: matches.length === 0
      ? 'Play Mirror current self after calibration or PGN import.'
      : feedbackTags.too_random > feedbackTags.felt_like_me
        ? 'Try improved self and submit feedback so Mirror can calibrate away random-feeling choices.'
        : 'Play improved self or blunder-prone self to turn Mirror evidence into training.',
  };
}

function buildStorySummary(records: StoryProgressRecord[]): StoryAnalyticsSummary {
  const completed = records.filter((record) => record.status === 'complete').length;
  const availableId = records.find((record) => record.status === 'available')?.chapter_id
    ?? nextUnlockedChapter(records);
  const current = mahabharataStorySeed.find((chapter) => chapter.id === availableId);
  const attempted = records.some((record) => finiteNumber(record.attempts) > 0);
  const status: StoryAnalyticsSummary['status'] = completed >= mahabharataStorySeed.length
    ? 'complete'
    : attempted
      ? 'in_progress'
      : availableId
        ? 'available'
        : 'not_started';

  return {
    completed_chapters: completed,
    total_chapters: mahabharataStorySeed.length,
    current_act: current?.act_title,
    current_chapter: current?.id,
    current_chapter_title: current?.title,
    status,
    recommendation: status === 'complete'
      ? 'Story Mode is complete; replay chapters as themed calculation practice.'
      : current
        ? `Continue ${current.act_title ?? 'Story Mode'}: ${current.title}.`
        : 'Start Story Mode to connect training with Kurukshetra progression.',
  };
}

function buildProgressionSummary(records: {
  localMatches: LocalMatchRecord[];
  mirrorMatches: MirrorMatchRecord[];
  gameReviews: GameReviewRecord[];
  clueAttempts: ClueAttemptRecord[];
  storyProgress: StoryProgressRecord[];
  achievements: AchievementRecord[];
}): ProgressionAnalyticsSummary {
  const solvedClues = records.clueAttempts.filter((attempt) => attempt.solved);
  const completedStory = records.storyProgress.filter((item) => item.status === 'complete');
  const xp =
    records.localMatches.length * 10 +
    records.mirrorMatches.length * 20 +
    records.gameReviews.length * 10 +
    solvedClues.reduce((total, clue) => total + ((clue.total_steps ?? 0) > 1 ? 30 : 15), 0) +
    completedStory.length * 25;
  const activeDays = new Set<string>();
  const ignoredTimes: string[] = [];
  collectDates(activeDays, ignoredTimes, records.localMatches, (row) => row.created_at);
  collectDates(activeDays, ignoredTimes, records.mirrorMatches, (row) => row.started_at);
  collectDates(activeDays, ignoredTimes, records.clueAttempts, (row) => row.created_at);
  collectDates(activeDays, ignoredTimes, records.storyProgress, (row) => row.updated_at);
  const streaks = estimateStreaks(activeDays);

  return {
    xp,
    level: Math.floor(Math.sqrt(xp / 100)) + 1,
    achievements_count: records.achievements.length,
    current_streak_days: streaks.current,
    best_streak_days: streaks.best,
    story_rank: storyRank(completedStory.length),
    recommendation: records.achievements.length === 0
      ? 'Complete one Mirror, review, clue, or story action to earn the first badge.'
      : 'Keep the battle profile moving with one review action and one practice action.',
  };
}

function buildPhaseRows(moves: MoveReview[]) {
  return PHASES.map((phase) => {
    const phaseMoves = moves.filter((move) => move.phase === phase);
    const losses = phaseMoves.map((move) => move.cp_loss).filter(isFiniteNumber);
    return {
      phase,
      reviewed_moves: phaseMoves.length,
      average_cp_loss: losses.length > 0 ? round(average(losses)) : 0,
      blunders: countClassification(phaseMoves, 'blunder'),
      mistakes: countClassification(phaseMoves, 'mistake'),
    };
  });
}

function buildReviewTrend(reviews: GameReviewRecord[]): ReviewTrendPoint[] {
  return [...reviews]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-8)
    .map((review, index) => {
      const losses = review.move_reviews.map((move) => move.cp_loss).filter(isFiniteNumber);
      const accuracies = [review.accuracy_white, review.accuracy_black].filter(isFiniteNumber);
      return {
        label: `Review ${index + 1}`,
        average_cp_loss: losses.length > 0 ? round(average(losses)) : 0,
        accuracy_estimate: accuracies.length > 0 ? round(average(accuracies)) : 0,
        reviewed_at: review.created_at,
      };
    });
}

function emptyReviewSummary(): GameReviewAnalyticsSummary {
  return {
    reviewed_games_count: 0,
    reviewed_imported_games_count: 0,
    average_cp_loss: 0,
    accuracy_estimate: 0,
    blunder_count: 0,
    mistake_count: 0,
    inaccuracy_count: 0,
    best_or_excellent_count: 0,
    cp_loss_trend: [],
    classification_distribution: [],
    phase_weakness_bars: buildPhaseRows([]),
    interpretation: 'Insufficient data: no Game Review Pro records are available.',
    recommended_action: 'Analyze an imported or completed game to unlock CP-loss trends.',
  };
}

function emptyImportedSummary(): ImportedGameAnalyticsSummary {
  return {
    imported_games_count: 0,
    valid_games_count: 0,
    invalid_or_partial_count: 0,
    source_breakdown: {},
    reviewed_imported_games_count: 0,
    analyzed_imported_games_count: 0,
    analysis_coverage_percent: 0,
    recommendation: 'Import user-provided PGN files to build a faster chess fingerprint.',
  };
}

function emptyStyleVectorSummary(): StyleVectorAnalyticsSummary {
  return {
    available: false,
    source: 'insufficient_data',
    confidence: 'low',
    evidence_source: 'insufficient_data',
    aggression_risk_proxy: 0,
    exchange_willingness: 0,
    time_pressure_risk: 0,
    motif_blindness_average: 0,
    endgame_strength: 0,
    swindle_preference: 'insufficient_data',
    detected_elo_band: 'insufficient_data',
    opening_white_top3: [],
    opening_black_top3: [],
    preferred_minor: 'insufficient_data',
    metrics: [],
    recommendation: 'Complete calibration or import user-attributed PGNs to create a StyleVector.',
  };
}

function emptyPuzzleSummary(): PuzzleAnalyticsSummary {
  return {
    clue_attempts: 0,
    solved_rate: 0,
    motif_rows: [],
    repeated_review_failure_count: 0,
    interpretation: 'Insufficient data: no clue attempts, puzzle reviews, review motifs, or StyleVector motif evidence are available.',
    recommended_action: 'Solve Clue Chess puzzles to seed weak motif analytics.',
  };
}

function emptyReviewQueueSummary(): ReviewQueueAnalyticsSummary {
  return {
    total_reviews: 0,
    due_reviews_count: 0,
    overdue_reviews_count: 0,
    upcoming_reviews_count: 0,
    average_interval_days: 0,
    due_motifs: [],
    queue_preview: [],
    recommendation: 'Solve Clue Chess puzzles to create a review queue.',
  };
}

function emptyMirrorSummary(): MirrorAnalyticsSummary {
  return {
    mirror_matches_count: 0,
    personality_modes_played: [],
    feedback_tags: {},
    felt_like_me_count: 0,
    too_random_count: 0,
    recommendation: 'Play Mirror current self after calibration or PGN import.',
  };
}

function emptyStorySummary(): StoryAnalyticsSummary {
  const first = mahabharataStorySeed[0];
  return {
    completed_chapters: 0,
    total_chapters: mahabharataStorySeed.length,
    current_act: first?.act_title,
    current_chapter: first?.id,
    current_chapter_title: first?.title,
    status: 'not_started',
    recommendation: 'Start Story Mode to connect training with Kurukshetra progression.',
  };
}

function metric(id: string, label: string, value: number, interpretation: string): StyleVectorMetric {
  return { id, label, value, interpretation };
}

function motifRow(rows: Map<string, MotifAnalyticsRow>, motif: string): MotifAnalyticsRow {
  const key = motif || 'unknown';
  const existing = rows.get(key);
  if (existing) return existing;
  const row: MotifAnalyticsRow = {
    motif: key,
    attempts: 0,
    solved: 0,
    failed: 0,
    solved_rate: 0,
    review_lapses: 0,
    due_reviews: 0,
    review_mistakes: 0,
  };
  rows.set(key, row);
  return row;
}

function motifWeaknessScore(row: MotifAnalyticsRow): number {
  const unsolvedSignal = row.attempts > 0 ? (100 - row.solved_rate) / 20 : 0;
  const blindnessSignal = (row.stylevector_blindness ?? 0) / 20;
  return row.failed * 3 + row.review_lapses * 2 + row.review_mistakes * 2 + row.due_reviews + unsolvedSignal + blindnessSignal;
}

function styleEvidenceSource(
  record: StyleVectorRecord,
  context: { importedGames: ImportedGameRecord[]; feedback: FeedbackRecord[] }
): StyleVectorAnalyticsSummary['evidence_source'] {
  if (record.source === 'imported') return 'imported_games';
  if (record.source === 'tuned') return 'mirror_feedback';
  if (context.importedGames.some((game) => game.stylevector_applied) && context.feedback.length > 0) return 'mixed';
  if (record.source === 'calibration') return 'calibration';
  return 'insufficient_data';
}

function styleConfidence(
  record: StyleVectorRecord,
  context: { importedGames: ImportedGameRecord[]; feedback: FeedbackRecord[]; calibrationStatus?: PlayerRecord['calibration_status']; reviewedGamesCount: number }
): StyleVectorAnalyticsSummary['confidence'] {
  const signals = [
    context.calibrationStatus === 'complete',
    record.source === 'imported' || context.importedGames.some((game) => game.stylevector_applied),
    context.feedback.length > 0 || record.source === 'tuned',
    context.reviewedGamesCount > 0,
  ].filter(Boolean).length;
  if (signals >= 3) return 'high';
  if (signals >= 1) return 'medium';
  return 'low';
}

function exportSafety(): AnalyticsExportSafety {
  return {
    local_only: true,
    uploads_private_data: false,
    contains_raw_pgn: false,
    contains_raw_backup_json: false,
    contains_auth_tokens: false,
  };
}

function countClassification(moves: MoveReview[], classification: MoveClassification): number {
  return moves.filter((move) => move.classification === classification).length;
}

function isDue(nextDueAt: string | undefined): boolean {
  if (!nextDueAt) return false;
  return toDateKey(nextDueAt) <= toDateKey(new Date());
}

function isOverdue(nextDueAt: string | undefined): boolean {
  if (!nextDueAt) return false;
  const today = toDateKey(new Date());
  return toDateKey(nextDueAt) < today;
}

function nextUnlockedChapter(records: StoryProgressRecord[]): string | undefined {
  const completed = new Set(records.filter((record) => record.status === 'complete').map((record) => record.chapter_id));
  return mahabharataStorySeed.find((chapter) => !chapter.required_previous_chapter_id || completed.has(chapter.required_previous_chapter_id))?.id;
}

function storyRank(completedChapters: number): string {
  if (completedChapters >= mahabharataStorySeed.length) return 'Campaign complete';
  if (completedChapters >= 12) return 'Act III challenger';
  if (completedChapters >= 7) return 'Act II challenger';
  if (completedChapters > 0) return 'Act I apprentice';
  return 'Unstarted';
}

function estimateStreaks(dates: Set<string>): { current: number; best: number } {
  const sorted = Array.from(dates).sort((a, b) => b.localeCompare(a));
  if (sorted.length === 0) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(`${sorted[index - 1]}T00:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    if (toDateKey(previous) === sorted[index]) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  const today = toDateKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = toDateKey(yesterdayDate);
  let current = 0;
  if (sorted[0] === today || sorted[0] === yesterday) {
    current = 1;
    const check = new Date(`${sorted[0]}T00:00:00.000Z`);
    for (let index = 1; index < sorted.length; index += 1) {
      check.setUTCDate(check.getUTCDate() - 1);
      if (toDateKey(check) === sorted[index]) current += 1;
      else break;
    }
  }

  return { current, best };
}

function collectDates<T>(
  dates: Set<string>,
  times: string[],
  rows: T[],
  selector: (row: T) => string | undefined
): void {
  for (const row of rows) {
    const value = selector(row);
    const key = value ? toDateKey(value) : null;
    if (key) dates.add(key);
    if (value && !Number.isNaN(new Date(value).getTime())) times.push(value);
  }
}

function toDateKey(value: Date | string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function sortByDateDesc<T>(rows: T[], selector: (row: T) => string | undefined): T[] {
  return [...rows].sort((a, b) => (selector(b) || '').localeCompare(selector(a) || ''));
}

function lastSortedValue(values: string[]): string | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort();
  return sorted[sorted.length - 1];
}

function sanitizeExportText(value: string): string {
  return value.replace(SECRET_PATTERN, '[redacted]');
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function formatMotif(value: string): string {
  return value.replace(/_/g, ' ');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function finiteNumber(value: unknown): number {
  return isFiniteNumber(value) ? value : 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
