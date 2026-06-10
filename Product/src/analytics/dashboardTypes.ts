import type { MoveClassification } from '../review/reviewTypes';

export type AnalyticsActionType =
  | 'review_game'
  | 'import_games'
  | 'analyze_imported_game'
  | 'play_mirror'
  | 'calibrate'
  | 'review_puzzles'
  | 'play_story'
  | 'open_game_review'
  | 'open_clue_chess';

export type AnalyticsActionCategory =
  | 'review'
  | 'import'
  | 'mirror'
  | 'puzzle'
  | 'story'
  | 'calibration'
  | 'data_quality';

export type DataQualitySeverity = 'info' | 'warning' | 'error';

export interface DataQualityFinding {
  id: string;
  severity: DataQualitySeverity;
  area:
    | 'player'
    | 'style_vector'
    | 'imported_games'
    | 'game_reviews'
    | 'puzzles'
    | 'review_queue'
    | 'mirror'
    | 'story';
  message: string;
  recommended_action: string;
  route?: string;
}

export interface DataQualitySummary {
  passed: boolean;
  findings: DataQualityFinding[];
  missing_area_count: number;
  warning_count: number;
  error_count: number;
}

export interface AnalyticsRecommendedAction {
  id: string;
  type: AnalyticsActionType;
  title: string;
  reason: string;
  evidence: string[];
  priority: number;
  route?: string;
  category: AnalyticsActionCategory;
}

export interface PlayerSummaryAnalytics {
  player_found: boolean;
  display_name: string;
  calibration_status: string;
  total_local_games: number;
  total_mirror_matches: number;
  total_imported_games: number;
  total_reviewed_games: number;
  active_days: number;
  latest_activity_at?: string;
  recommendation: string;
}

export interface ReviewTrendPoint {
  label: string;
  average_cp_loss: number;
  accuracy_estimate: number;
  reviewed_at: string;
}

export interface PhaseWeaknessRow {
  phase: 'opening' | 'middlegame' | 'endgame';
  reviewed_moves: number;
  average_cp_loss: number;
  blunders: number;
  mistakes: number;
}

export interface GameReviewAnalyticsSummary {
  reviewed_games_count: number;
  reviewed_imported_games_count: number;
  average_cp_loss: number;
  accuracy_estimate: number;
  blunder_count: number;
  mistake_count: number;
  inaccuracy_count: number;
  best_or_excellent_count: number;
  most_common_move_label?: MoveClassification;
  weakest_phase?: 'opening' | 'middlegame' | 'endgame';
  latest_key_moment?: {
    move_number: number;
    san: string;
    reason: string;
    source_id: string;
    route?: string;
  };
  cp_loss_trend: ReviewTrendPoint[];
  classification_distribution: Array<{ label: MoveClassification; count: number }>;
  phase_weakness_bars: PhaseWeaknessRow[];
  interpretation: string;
  recommended_action: string;
}

export interface ImportedGameAnalyticsSummary {
  imported_games_count: number;
  valid_games_count: number;
  invalid_or_partial_count: number;
  source_breakdown: Record<string, number>;
  reviewed_imported_games_count: number;
  analyzed_imported_games_count: number;
  analysis_coverage_percent: number;
  last_import_at?: string;
  recommendation: string;
}

export interface StyleVectorMetric {
  id: string;
  label: string;
  value: number;
  interpretation: string;
}

export interface StyleVectorAnalyticsSummary {
  available: boolean;
  source: string;
  confidence: 'low' | 'medium' | 'high';
  evidence_source: 'calibration' | 'imported_games' | 'mirror_feedback' | 'mixed' | 'insufficient_data';
  aggression_risk_proxy: number;
  exchange_willingness: number;
  time_pressure_risk: number;
  motif_blindness_average: number;
  endgame_strength: number;
  swindle_preference: string;
  detected_elo_band: string;
  opening_white_top3: string[];
  opening_black_top3: string[];
  preferred_minor: string;
  metrics: StyleVectorMetric[];
  recommendation: string;
}

export interface MotifAnalyticsRow {
  motif: string;
  attempts: number;
  solved: number;
  failed: number;
  solved_rate: number;
  review_lapses: number;
  due_reviews: number;
  review_mistakes: number;
  stylevector_blindness?: number;
}

export interface PuzzleAnalyticsSummary {
  clue_attempts: number;
  solved_rate: number;
  weakest_motif?: string;
  strongest_motif?: string;
  motif_rows: MotifAnalyticsRow[];
  repeated_review_failure_count: number;
  interpretation: string;
  recommended_action: string;
}

export interface ReviewQueueAnalyticsSummary {
  total_reviews: number;
  due_reviews_count: number;
  overdue_reviews_count: number;
  upcoming_reviews_count: number;
  average_interval_days: number;
  due_motifs: string[];
  queue_preview: Array<{
    puzzle_id: string;
    motif: string;
    next_due_at: string;
    lapses: number;
  }>;
  recommendation: string;
}

export interface MirrorAnalyticsSummary {
  mirror_matches_count: number;
  personality_modes_played: string[];
  feedback_tags: Record<string, number>;
  felt_like_me_count: number;
  too_random_count: number;
  latest_result?: string;
  latest_mode?: string;
  recommendation: string;
}

export interface StoryAnalyticsSummary {
  completed_chapters: number;
  total_chapters: number;
  current_act?: string;
  current_chapter?: string;
  current_chapter_title?: string;
  status: 'not_started' | 'available' | 'in_progress' | 'complete';
  recommendation: string;
}

export interface ProgressionAnalyticsSummary {
  xp: number;
  level: number;
  achievements_count: number;
  current_streak_days: number;
  best_streak_days: number;
  story_rank: string;
  recommendation: string;
}

export interface AnalyticsExportSafety {
  local_only: true;
  uploads_private_data: false;
  contains_raw_pgn: false;
  contains_raw_backup_json: false;
  contains_auth_tokens: false;
}

export interface AnalyticsDashboardSnapshot {
  generated_at: string;
  player_id: string;
  source_files: string[];
  data_quality: DataQualitySummary;
  player_summary: PlayerSummaryAnalytics;
  review_summary: GameReviewAnalyticsSummary;
  imported_game_summary: ImportedGameAnalyticsSummary;
  stylevector_summary: StyleVectorAnalyticsSummary;
  puzzle_summary: PuzzleAnalyticsSummary;
  review_queue_summary: ReviewQueueAnalyticsSummary;
  mirror_summary: MirrorAnalyticsSummary;
  story_summary: StoryAnalyticsSummary;
  progression_summary: ProgressionAnalyticsSummary;
  recommended_actions: AnalyticsRecommendedAction[];
  export_safety: AnalyticsExportSafety;
}
