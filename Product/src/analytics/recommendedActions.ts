import type { AnalyticsDashboardSnapshot, AnalyticsRecommendedAction } from './dashboardTypes';

export function generateAnalyticsRecommendedActions(
  snapshot: Omit<AnalyticsDashboardSnapshot, 'recommended_actions'>
): AnalyticsRecommendedAction[] {
  const actions: AnalyticsRecommendedAction[] = [];

  if (!snapshot.player_summary.player_found) {
    actions.push(action(
      'create-player-profile',
      'calibrate',
      'Create a local player profile',
      'Analytics cannot personalize without an active local player.',
      ['No active player profile was found in IndexedDB:players.'],
      1,
      'data_quality',
      '/onboarding'
    ));
    return actions;
  }

  if (!snapshot.stylevector_summary.available) {
    actions.push(action(
      'complete-calibration',
      'calibrate',
      'Complete calibration',
      'StyleVector is missing, so MIRROR cannot explain analytics through your playing style yet.',
      ['IndexedDB:style_vectors has no current StyleVector for this player.'],
      2,
      'calibration',
      '/calibration'
    ));
  }

  if (snapshot.review_queue_summary.due_reviews_count > 0) {
    actions.push(action(
      'review-due-puzzles',
      'review_puzzles',
      'Review due puzzles now',
      `${snapshot.review_queue_summary.due_reviews_count} spaced-repetition review item(s) are due.`,
      [`Due motifs: ${formatList(snapshot.review_queue_summary.due_motifs)}.`],
      3,
      'puzzle',
      '/clue-chess'
    ));
  }

  if (snapshot.review_summary.reviewed_games_count === 0) {
    actions.push(action(
      'review-first-game',
      'review_game',
      'Analyze one game',
      'No Game Review Pro records exist yet, so CP-loss and phase trends are unavailable.',
      ['IndexedDB:game_reviews count is 0.'],
      4,
      'review',
      snapshot.imported_game_summary.valid_games_count > 0 ? '/import-pgn' : '/play'
    ));
  } else if (snapshot.review_summary.weakest_phase) {
    actions.push(action(
      'train-weakest-review-phase',
      'open_game_review',
      `Study the ${snapshot.review_summary.weakest_phase}`,
      `Reviewed games show the highest MIRROR internal CP-loss in the ${snapshot.review_summary.weakest_phase}.`,
      [
        `${snapshot.review_summary.weakest_phase} average CP-loss: ${
          snapshot.review_summary.phase_weakness_bars.find((row) => row.phase === snapshot.review_summary.weakest_phase)
            ?.average_cp_loss ?? 0
        }.`,
      ],
      5,
      'review',
      snapshot.review_summary.latest_key_moment?.route
    ));
  }

  if (snapshot.puzzle_summary.weakest_motif) {
    actions.push(action(
      'train-weakest-motif',
      'open_clue_chess',
      `Train ${formatMotif(snapshot.puzzle_summary.weakest_motif)}`,
      `${formatMotif(snapshot.puzzle_summary.weakest_motif)} is currently the weakest motif signal.`,
      [
        snapshot.puzzle_summary.motif_rows.find((row) => row.motif === snapshot.puzzle_summary.weakest_motif)
          ? `Motif row available for ${snapshot.puzzle_summary.weakest_motif}.`
          : 'Weakness came from StyleVector motif blindness only.',
      ],
      6,
      'puzzle',
      '/clue-chess'
    ));
  }

  if (snapshot.imported_game_summary.imported_games_count === 0) {
    actions.push(action(
      'import-games',
      'import_games',
      'Import recent games',
      'Imported PGNs help MIRROR build a stronger chess fingerprint without cloud access.',
      ['Imported game count is 0.'],
      7,
      'import',
      '/import-pgn'
    ));
  } else if (
    snapshot.imported_game_summary.valid_games_count > 0 &&
    snapshot.imported_game_summary.analysis_coverage_percent < 60
  ) {
    actions.push(action(
      'analyze-imported-games',
      'analyze_imported_game',
      'Analyze imported games',
      'Valid imported games exist but local analysis coverage is still thin.',
      [`Analysis coverage: ${snapshot.imported_game_summary.analysis_coverage_percent}%.`],
      8,
      'import',
      '/import-pgn'
    ));
  }

  if (snapshot.mirror_summary.mirror_matches_count === 0) {
    actions.push(action(
      'play-mirror-current-self',
      'play_mirror',
      'Play Mirror current self',
      'No completed Mirror matches exist, so Mirror performance feedback is unavailable.',
      ['Mirror match count is 0.'],
      9,
      'mirror',
      '/mirror'
    ));
  } else if (snapshot.mirror_summary.too_random_count > snapshot.mirror_summary.felt_like_me_count) {
    actions.push(action(
      'play-improved-self',
      'play_mirror',
      'Try Mirror improved self',
      'Mirror feedback contains more too-random tags than felt-like-me confirmations.',
      [
        `too_random=${snapshot.mirror_summary.too_random_count}`,
        `felt_like_me=${snapshot.mirror_summary.felt_like_me_count}`,
      ],
      10,
      'mirror',
      '/mirror'
    ));
  }

  if (snapshot.story_summary.status !== 'complete') {
    actions.push(action(
      'continue-story',
      'play_story',
      snapshot.story_summary.current_chapter_title
        ? `Continue ${snapshot.story_summary.current_chapter_title}`
        : 'Start Story Mode',
      snapshot.story_summary.recommendation,
      [`Story progress: ${snapshot.story_summary.completed_chapters}/${snapshot.story_summary.total_chapters} chapters complete.`],
      11,
      'story',
      '/story'
    ));
  }

  if (actions.length === 0) {
    actions.push(action(
      'keep-training-loop',
      'review_game',
      'Keep the review loop warm',
      'Local data is healthy. Review one key moment, then play a Mirror rematch.',
      ['No critical data-quality gaps were found.'],
      12,
      'review',
      snapshot.review_summary.latest_key_moment?.route ?? '/mirror'
    ));
  }

  return actions
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .slice(0, 8);
}

function action(
  id: string,
  type: AnalyticsRecommendedAction['type'],
  title: string,
  reason: string,
  evidence: string[],
  priority: number,
  category: AnalyticsRecommendedAction['category'],
  route?: string
): AnalyticsRecommendedAction {
  return {
    id,
    type,
    title,
    reason,
    evidence,
    priority,
    category,
    ...(route ? { route } : {}),
  };
}

function formatList(values: string[]): string {
  if (values.length === 0) return 'none';
  return values.map(formatMotif).join(', ');
}

function formatMotif(value: string): string {
  return value.replace(/_/g, ' ');
}
