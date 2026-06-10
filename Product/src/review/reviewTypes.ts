export type ReviewSourceType = 'local_match' | 'mirror_match' | 'imported_game';
export type ReviewedSide = 'white' | 'black' | 'both' | 'unknown';
export type GamePhase = 'opening' | 'middlegame' | 'endgame';

export type MoveClassification =
  | 'brilliant'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'missed_win'
  | 'forced'
  | 'book'
  | 'unknown';

export interface MoveReview {
  ply: number;
  move_number: number;
  san: string;
  uci?: string;
  fen_before: string;
  fen_after?: string;
  side: 'white' | 'black';
  eval_before?: number;
  eval_after?: number;
  best_move?: string;
  best_line?: string[];
  cp_loss?: number;
  classification: MoveClassification;
  phase: GamePhase;
  motif_tags: string[];
  is_turning_point: boolean;
  retry_available: boolean;
  stylevector_note?: string;
  explanation: string;
  evidence: string[];
}

export interface PhaseQuality {
  phase: GamePhase;
  moves: number;
  average_cp_loss: number;
  blunder_count: number;
  mistake_count: number;
  inaccuracy_count: number;
  summary: string;
}

export interface PhaseSummary {
  opening: PhaseQuality;
  middlegame: PhaseQuality;
  endgame: PhaseQuality;
  weakest_phase: GamePhase | 'insufficient_data';
  summary: string;
}

export interface KeyMoment {
  id: string;
  type:
    | 'largest_cp_loss'
    | 'first_major_blunder'
    | 'missed_win'
    | 'swing_move'
    | 'repeated_pattern'
    | 'critical_endgame';
  ply: number;
  move_number: number;
  san: string;
  classification: MoveClassification;
  phase: GamePhase;
  reason: string;
  evidence: string[];
  suggested_retry: string;
  cp_loss?: number;
  best_move?: string;
}

export interface PersonalizedReviewSummary {
  headline: string;
  notes: string[];
  evidence: string[];
  insufficient_data: string[];
}

export interface RecommendedAction {
  id: string;
  type: 'retry' | 'clue' | 'mirror' | 'review' | 'import' | 'analysis';
  title: string;
  description: string;
  route?: string;
  evidence: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface GameReviewRecord {
  id: string;
  player_id: string;
  source_type: ReviewSourceType;
  source_id: string;
  created_at: string;
  analysis_depth?: number;
  engine_name: string;
  engine_version?: string;
  total_moves: number;
  reviewed_side?: ReviewedSide;
  accuracy_white?: number;
  accuracy_black?: number;
  average_cp_loss_white?: number;
  average_cp_loss_black?: number;
  result?: string;
  opening_name?: string;
  phase_summary: PhaseSummary;
  key_moments: KeyMoment[];
  move_reviews: MoveReview[];
  personalized_summary: PersonalizedReviewSummary;
  recommended_actions: RecommendedAction[];
  metadata?: Record<string, unknown>;
}

export interface ReviewSourceGame {
  source_type: ReviewSourceType;
  source_id: string;
  player_id: string;
  pgn: string;
  result?: string;
  reviewed_side: ReviewedSide;
  source_label: string;
}

export interface RetryAttemptResult {
  status: 'correct' | 'close' | 'still_risky' | 'invalid' | 'unavailable';
  attempted_move?: string;
  expected_move?: string;
  message: string;
  evidence: string[];
}
