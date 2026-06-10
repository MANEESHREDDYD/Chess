import type { PlayerRecord, LocalMatchRecord, MirrorMatchRecord, ImportedGameRecord, CalibrationRunRecord, StyleVectorRecord, AnalysisRecord, ClueAttemptRecord, PuzzleReviewRecord, StoryProgressRecord, AchievementRecord, AccountLinkRecord } from '../data/db';
import type { GameReviewRecord } from '../review/reviewTypes';

export interface MirrorBackupData {
  players: PlayerRecord[];
  local_matches: LocalMatchRecord[];
  mirror_matches: MirrorMatchRecord[];
  imported_games: ImportedGameRecord[];
  calibration_runs: CalibrationRunRecord[];
  style_vectors: StyleVectorRecord[];
  saved_analyses: AnalysisRecord[];
  game_reviews: GameReviewRecord[];
  clue_attempts: ClueAttemptRecord[];
  puzzle_reviews: PuzzleReviewRecord[];
  story_progress: StoryProgressRecord[];
  achievements: AchievementRecord[];
  account_links?: AccountLinkRecord[];
  settings: Record<string, unknown>;
}

export interface MirrorBackupFile {
  schema_version: number;
  app_name: "MIRROR";
  created_at: string;
  exported_by?: string;
  latest_known_tag?: string;
  data: MirrorBackupData;
}
