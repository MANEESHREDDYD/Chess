import type { CluePuzzle } from '../data/cluePuzzles';
import type { ClueAttemptRecord, PuzzleReviewRecord, StyleVectorRecord } from '../data/db';
import type { GameReviewRecord } from '../review/reviewTypes';

export type ClueLevel = 1 | 2 | 3 | 4 | 5;

export type ClueMode = 'adaptive' | 'review' | 'streak' | 'boss' | 'kids';

export type ClueEvidenceSource =
  | 'Analytics'
  | 'StyleVector'
  | 'Game Review'
  | 'Review Queue'
  | 'Puzzle History'
  | 'Insufficient Data';

export interface AdaptiveClueContext {
  player_id: string;
  style_vector?: StyleVectorRecord | null;
  clue_attempts: ClueAttemptRecord[];
  puzzle_reviews: PuzzleReviewRecord[];
  game_reviews: GameReviewRecord[];
  analytics_weak_motif?: string | null;
  requested_motif?: string | null;
  due_review_motifs: string[];
  generated_at: string;
}

export interface ClueVariant {
  id: string;
  level: ClueLevel;
  text: string;
  source: ClueEvidenceSource;
  kid_friendly: boolean;
}

export interface AdaptiveClue {
  puzzle_id: string;
  level: ClueLevel;
  variant_id: string;
  text: string;
  source: ClueEvidenceSource;
  why: string;
  evidence: string[];
  insufficient_data: boolean;
}

export interface AdaptiveClueSelection {
  puzzle: CluePuzzle;
  mode: ClueMode;
  start_level: ClueLevel;
  recommended_motif?: string;
  source_badges: ClueEvidenceSource[];
  evidence: string[];
  insufficient_data: boolean;
  due_review: boolean;
  reason: string;
}

export interface ClueScoreInput {
  solved: boolean;
  clue_level_used?: number;
  attempts_used: number;
  time_spent_ms?: number;
  due_review: boolean;
  streak_count: number;
  boss_completed: boolean;
  used_final_reveal: boolean;
}

export interface ClueScoreResult {
  training_score: number;
  score_delta: number;
  streak_count: number;
  boss_clear: boolean;
  review_success: boolean;
  evidence: string[];
}

export interface StreakState {
  count: number;
  best: number;
  lives: number;
}

export interface BossPuzzleSequence {
  id: string;
  motif: string;
  puzzle_ids: string[];
  current_index: number;
  completed: boolean;
}

export interface SolutionExplanation {
  correct_move: string;
  why_it_works: string;
  motif: string;
  clue_goal: string;
  stylevector_connection: string;
  next_recommendation: string;
  evidence: string[];
}
