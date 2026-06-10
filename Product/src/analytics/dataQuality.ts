import type { AnalyticsDashboardSnapshot, DataQualityFinding, DataQualitySummary } from './dashboardTypes';

export interface DashboardDataQualityInput {
  hasActivePlayer: boolean;
  hasStyleVector: boolean;
  importedGamesCount: number;
  reviewedGamesCount: number;
  puzzleAttemptsCount: number;
  puzzleReviewsCount: number;
  mirrorMatchesCount: number;
  storyProgressCount: number;
}

export function evaluateDashboardDataQuality(input: DashboardDataQualityInput): DataQualitySummary {
  const findings: DataQualityFinding[] = [];

  if (!input.hasActivePlayer) {
    findings.push(finding(
      'no-active-player',
      'error',
      'player',
      'No active local player profile was found.',
      'Create or select a local player profile before using analytics.',
      '/onboarding'
    ));
  }

  if (!input.hasStyleVector) {
    findings.push(finding(
      'no-style-vector',
      'warning',
      'style_vector',
      'No StyleVector is available yet.',
      'Complete calibration or import user-attributed games to unlock personalized analytics.',
      '/calibration'
    ));
  }

  if (input.importedGamesCount === 0) {
    findings.push(finding(
      'no-imported-games',
      'info',
      'imported_games',
      'No imported games are available.',
      'Import user-provided PGN files to build a faster chess fingerprint.',
      '/import-pgn'
    ));
  }

  if (input.reviewedGamesCount === 0) {
    findings.push(finding(
      'no-reviewed-games',
      'warning',
      'game_reviews',
      'No reviewed games yet.',
      'Analyze an imported or completed game to unlock CP-loss trends.',
      '/import-pgn'
    ));
  }

  if (input.puzzleAttemptsCount === 0) {
    findings.push(finding(
      'no-puzzle-attempts',
      'info',
      'puzzles',
      'No Clue Chess attempts are available.',
      'Solve clue puzzles so MIRROR can measure motif strengths and weaknesses.',
      '/clue-chess'
    ));
  }

  if (input.puzzleReviewsCount === 0) {
    findings.push(finding(
      'no-review-queue',
      'info',
      'review_queue',
      'No spaced-repetition puzzle review data exists.',
      'Solve or retry Clue Chess puzzles to seed review scheduling.',
      '/clue-chess'
    ));
  }

  if (input.mirrorMatchesCount === 0) {
    findings.push(finding(
      'no-mirror-matches',
      'info',
      'mirror',
      'No completed Mirror matches are available.',
      'Play Mirror current self after calibration or PGN import.',
      '/mirror'
    ));
  }

  if (input.storyProgressCount === 0) {
    findings.push(finding(
      'no-story-progress',
      'info',
      'story',
      'No Story Mode progress is available.',
      'Start the Kurukshetra story path when you want themed progression.',
      '/story'
    ));
  }

  return summarizeDataQuality(findings);
}

export function summarizeDataQuality(findings: DataQualityFinding[]): DataQualitySummary {
  const warningCount = findings.filter((item) => item.severity === 'warning').length;
  const errorCount = findings.filter((item) => item.severity === 'error').length;
  return {
    passed: errorCount === 0,
    findings,
    missing_area_count: findings.length,
    warning_count: warningCount,
    error_count: errorCount,
  };
}

export function dashboardHasNoCloudDependency(snapshot: AnalyticsDashboardSnapshot): boolean {
  const serialized = JSON.stringify(snapshot).toLowerCase();
  return !/(openai|anthropic|gemini|langchain|llamaindex|oauth|access_token|refresh_token|service_role)/i.test(serialized);
}

function finding(
  id: DataQualityFinding['id'],
  severity: DataQualityFinding['severity'],
  area: DataQualityFinding['area'],
  message: string,
  recommendedAction: string,
  route?: string
): DataQualityFinding {
  return {
    id,
    severity,
    area,
    message,
    recommended_action: recommendedAction,
    ...(route ? { route } : {}),
  };
}
