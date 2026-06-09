import type { Motif, StyleVector } from '../ml/styleVector';

export type CoachConfidence = 'low' | 'medium' | 'high';
export type CoachCardType =
  | 'weakness'
  | 'review'
  | 'analysis'
  | 'story'
  | 'progression'
  | 'mirror'
  | 'data_quality';

export interface PlayerProfileSummary {
  player_id: string;
  display_name: string;
  player_found: boolean;
  calibration_status: string;
  detected_elo?: number;
  elo_band?: string;
  total_games: number;
  mirror_matches: number;
  analyses_completed: number;
  achievements_count: number;
  level: number;
}

export interface PlayerProgressCoachSummary {
  total_xp: number;
  level: number;
  current_streak_days: number;
  best_streak_days: number;
  total_games: number;
  mirror_matches: number;
  clue_attempts: number;
  clue_solved: number;
  story_chapters_complete: number;
  story_total_chapters: number;
  due_reviews_count: number;
  next_action: string;
}

export interface StyleVectorSummary {
  available: boolean;
  style_vector_id?: string;
  source?: string;
  computed_at?: string;
  behavioral_field_count: number;
  dimensionality_note: string;
  opening_white_top3: string[];
  opening_black_top3: string[];
  avg_move_time_ms: number;
  time_pressure_blunder_rate: number;
  exchange_willingness: number;
  preferred_minor: StyleVector['preferred_minor'] | 'unknown';
  motif_blindness: Partial<Record<Motif, number>>;
  endgame_strength: number;
  swindle_preference: StyleVector['swindle_preference'];
  detected_elo?: number;
  elo_band?: string;
}

export interface RecentPerformanceSummary {
  total_games: number;
  mirror_matches: number;
  analyses_completed: number;
  clue_attempts: number;
  clue_solve_rate: number;
  multi_move_solve_rate: number;
  current_streak_days: number;
  best_streak_days: number;
}

export interface MotifWeaknessRow {
  motif: string;
  attempts: number;
  solved: number;
  failed: number;
  solved_rate: number;
  review_lapses: number;
  due_reviews: number;
}

export interface PuzzleWeaknessSummary {
  has_history: boolean;
  weakest_motif?: string;
  strongest_motif?: string;
  motif_stats: MotifWeaknessRow[];
  insufficient_data_reason?: string;
}

export interface AnalysisQualitySummary {
  analyses_completed: number;
  average_cp_loss: number;
  accuracy_estimate: number;
  blunder_count: number;
  mistake_count: number;
  latest_average_cp_loss?: number;
  latest_accuracy_estimate?: number;
  latest_blunder_count?: number;
  latest_mistake_count?: number;
  latest_completed_at?: string;
  trend: 'improving' | 'stable' | 'regressing' | 'insufficient_data';
}

export interface SpacedRepetitionSummary {
  total_reviews: number;
  due_reviews_count: number;
  due_motifs: string[];
  lapse_count: number;
}

export interface StoryProgressSummary {
  has_progress: boolean;
  completed_chapters: number;
  total_chapters: number;
  current_story_chapter?: string;
  current_story_title?: string;
  current_story_act?: string;
  status: 'not_started' | 'available' | 'in_progress' | 'complete';
  recommendation: string;
}

export interface CoachSummary {
  recommended_focus_area: string;
  confidence_level: CoachConfidence;
  insufficient_data_flags: string[];
  weakest_motif?: string;
  strongest_motif?: string;
  review_due_count: number;
  recent_analysis_quality: AnalysisQualitySummary;
  story_progress_status: StoryProgressSummary['status'];
  achievement_count: number;
  style_vector_available: boolean;
}

export interface CoachCard {
  id: string;
  type: CoachCardType;
  title: string;
  summary: string;
  evidence: string[];
  recommendation: string;
  priority: number;
  confidence: CoachConfidence;
  source: string;
}

export interface CoachPrivacyFlags {
  local_only: true;
  contains_raw_pgn: false;
  contains_raw_fen: false;
  uploads_private_data: false;
  safe_to_send_to_llm: boolean;
  local_private_by_default: string[];
}

export interface MirrorCoachContext {
  player_profile_summary: PlayerProfileSummary;
  player_progress_summary: PlayerProgressCoachSummary;
  style_vector_summary: StyleVectorSummary;
  recent_performance_summary: RecentPerformanceSummary;
  puzzle_weakness_summary: PuzzleWeaknessSummary;
  analysis_quality_summary: AnalysisQualitySummary;
  spaced_repetition_summary: SpacedRepetitionSummary;
  story_progress_summary: StoryProgressSummary;
  coach_summary: CoachSummary;
  coach_cards: CoachCard[];
  recommended_next_actions: string[];
  privacy_flags: CoachPrivacyFlags;
  generated_at: string;
  source_files: string[];
}

export interface LocalTrainingPlan {
  title: string;
  current_focus: string;
  steps: string[];
  rationale: string;
}
