import type {
  ImportedGameRecord,
  ImportedGameSource,
  StyleVectorRecord,
} from '../data/db';

export type PgnImportSource = ImportedGameSource;

export interface ParsedPgnGame {
  headers: Record<string, string>;
  moves: string[];
  result?: string;
  raw_pgn: string;
  normalized_pgn: string;
  final_fen: string;
  move_count: number;
  legal_status: ImportedGameRecord['legal_status'];
  validation_errors: string[];
}

export interface PgnImportPreview {
  games: ParsedPgnGame[];
  detected_count: number;
  valid_count: number;
  invalid_count: number;
  partial_count: number;
}

export interface SavePgnImportOptions {
  playerId: string;
  source: PgnImportSource;
  games: ParsedPgnGame[];
  originalFilename?: string;
  playerNameHint?: string;
}

export interface PgnImportSummary {
  imported_game_ids: string[];
  games_detected: number;
  games_saved: number;
  valid_games: number;
  invalid_games: number;
  partial_games: number;
  source_breakdown: Record<PgnImportSource, number>;
  result_summary: Record<string, number>;
  openings_detected: string[];
  stylevector_fields_updated: string[];
  insufficient_data: string[];
  recommended_next_action: string;
}

export interface PgnImportSaveResult {
  records: ImportedGameRecord[];
  summary: PgnImportSummary;
  stylevector_update?: ImportedStyleVectorUpdateResult;
}

export interface ImportedStyleFeatures {
  valid_game_count: number;
  average_move_count: number;
  capture_tendency: number | null;
  queen_move_tendency: number | null;
  castling_tendency: number | null;
  preferred_minor: 'knight' | 'bishop' | 'neutral';
  opening_white_top3: string[];
  opening_black_top3: string[];
  result_summary: Record<string, number>;
  has_clock_data: boolean;
  time_pressure_supported: boolean;
  insufficient_data: string[];
  evidence: string[];
}

export interface ImportedStyleVectorUpdateResult {
  updated: boolean;
  style_vector?: StyleVectorRecord;
  fields_updated: string[];
  insufficient_data: string[];
  evidence: string[];
}

