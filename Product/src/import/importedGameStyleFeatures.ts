import { Chess, type Move } from 'chess.js';
import {
  getCurrentStyleVectorRecord,
  getImportedGamesForPlayer,
  putStyleVectorRecord,
  updateImportedGameRecord,
  updateLocalPlayer,
  type ImportedGameRecord,
  type StyleVector,
  type StyleVectorRecord,
} from '../data/db';
import {
  STYLE_VECTOR_SCHEMA_VERSION,
  type PreferredMinor,
  type SwindlePreference,
} from '../ml/styleVector';
import type { ImportedStyleFeatures, ImportedStyleVectorUpdateResult } from './pgnTypes';

const IMPORT_CONFIDENCE_GAME_TARGET = 5;

export function extractImportedGameStyleFeatures(records: ImportedGameRecord[]): ImportedStyleFeatures {
  const validRecords = records.filter((record) => record.legal_status === 'valid');
  const userAttributedRecords = validRecords.filter(
    (record) => record.user_color === 'white' || record.user_color === 'black'
  );
  const userMoves: Move[] = [];
  const whiteOpenings: string[] = [];
  const blackOpenings: string[] = [];
  const resultSummary: Record<string, number> = {};
  const evidence: string[] = [];
  const insufficientData: string[] = [];
  let hasClockData = false;

  for (const record of validRecords) {
    const result = record.result ?? 'unknown';
    resultSummary[result] = (resultSummary[result] ?? 0) + 1;
    hasClockData = hasClockData || containsClockData(record.pgn_text);

    if (record.user_color !== 'white' && record.user_color !== 'black') {
      continue;
    }

    const moves = getVerboseMoves(record.normalized_pgn || record.pgn_text);
    const movesForColor = moves.filter((move) => move.color === (record.user_color === 'white' ? 'w' : 'b'));
    userMoves.push(...movesForColor);

    if (record.user_color === 'white' && moves[0]?.san) {
      whiteOpenings.push(normalizeOpeningMove(moves[0].san));
    }
    if (record.user_color === 'black' && moves[1]?.san) {
      blackOpenings.push(normalizeOpeningMove(moves[1].san));
    }
  }

  if (validRecords.length === 0) {
    insufficientData.push('no_valid_imported_games');
  }
  if (userAttributedRecords.length === 0) {
    insufficientData.push('user_color_not_detected');
  }
  if (userAttributedRecords.length < IMPORT_CONFIDENCE_GAME_TARGET) {
    insufficientData.push('more_games_needed_for_high_confidence');
  }
  if (!hasClockData) {
    insufficientData.push('no_clock_data_time_pressure_not_updated');
  }

  const captureTendency =
    userMoves.length > 0 ? userMoves.filter((move) => move.captured).length / userMoves.length : null;
  const queenMoveTendency =
    userMoves.length > 0 ? userMoves.filter((move) => move.piece === 'q').length / userMoves.length : null;
  const castlingTendency =
    userAttributedRecords.length > 0
      ? userAttributedRecords.filter((record) => didUserCastle(record)).length / userAttributedRecords.length
      : null;
  const preferredMinor = preferredMinorFromMoves(userMoves);
  const averageMoveCount =
    validRecords.length > 0
      ? validRecords.reduce((total, record) => total + record.move_count, 0) / validRecords.length
      : 0;

  if (userMoves.length > 0) {
    evidence.push(`${userMoves.length} user-attributed moves from ${userAttributedRecords.length} valid imported game(s).`);
  }
  if (captureTendency !== null) {
    evidence.push(`Capture tendency proxy: ${Math.round(captureTendency * 100)} percent of user moves captured material.`);
  }
  if (castlingTendency !== null) {
    evidence.push(`Castling tendency proxy: ${Math.round(castlingTendency * 100)} percent of user-attributed games included castling.`);
  }

  return {
    valid_game_count: validRecords.length,
    average_move_count: Math.round(averageMoveCount * 10) / 10,
    capture_tendency: captureTendency,
    queen_move_tendency: queenMoveTendency,
    castling_tendency: castlingTendency,
    preferred_minor: preferredMinor,
    opening_white_top3: topValues(whiteOpenings, 3),
    opening_black_top3: topValues(blackOpenings, 3),
    result_summary: resultSummary,
    has_clock_data: hasClockData,
    time_pressure_supported: hasClockData,
    insufficient_data: insufficientData,
    evidence,
  };
}

export async function updateStyleVectorFromImportedGames(
  playerId: string,
  importedGameIds?: string[],
  dbName?: string
): Promise<ImportedStyleVectorUpdateResult> {
  const allRecords = await getImportedGamesForPlayer(playerId, undefined, dbName);
  const records = importedGameIds
    ? allRecords.filter((record) => importedGameIds.includes(record.id))
    : allRecords;
  const validRecords = records.filter((record) => record.legal_status === 'valid');
  const features = extractImportedGameStyleFeatures(records);

  if (validRecords.length === 0 || features.insufficient_data.includes('user_color_not_detected')) {
    return {
      updated: false,
      fields_updated: [],
      insufficient_data: features.insufficient_data,
      evidence: features.evidence,
    };
  }

  const current = await getCurrentStyleVectorRecord(playerId, dbName);
  const baseVector = current?.vector ?? defaultImportStyleVector();
  const { vector, fieldsUpdated } = mergeImportedFeaturesIntoStyleVector(baseVector, features);

  if (fieldsUpdated.length === 0) {
    return {
      updated: false,
      fields_updated: [],
      insufficient_data: features.insufficient_data,
      evidence: features.evidence,
    };
  }

  const now = new Date().toISOString();
  const styleVector: StyleVectorRecord = {
    id: `style-import-${Date.now()}`,
    player_id: playerId,
    source: current ? 'tuned' : 'imported',
    previous_vector_id: current?.id,
    vector,
    computed_at: now,
  };

  await putStyleVectorRecord(styleVector, dbName);
  await updateLocalPlayer(
    playerId,
    {
      current_style_vector_id: styleVector.id,
      detected_elo: styleVector.vector.detected_elo,
      elo_band: styleVector.vector.elo_band,
    },
    dbName
  );

  const appliedRecords = validRecords.filter(
    (record) => record.user_color === 'white' || record.user_color === 'black'
  );

  await Promise.all(
    appliedRecords.map((record) =>
      updateImportedGameRecord(record.id, { stylevector_applied: true }, dbName)
    )
  );

  return {
    updated: true,
    style_vector: styleVector,
    fields_updated: fieldsUpdated,
    insufficient_data: features.insufficient_data,
    evidence: features.evidence,
  };
}

export function mergeImportedFeaturesIntoStyleVector(
  baseVector: StyleVector,
  features: ImportedStyleFeatures
): { vector: StyleVector; fieldsUpdated: string[] } {
  const fieldsUpdated: string[] = [];
  const vector: StyleVector = {
    ...defaultImportStyleVector(),
    ...baseVector,
    motif_blindness: {
      ...defaultImportStyleVector().motif_blindness,
      ...(baseVector.motif_blindness ?? {}),
    },
    schema_version: STYLE_VECTOR_SCHEMA_VERSION,
  };

  if (features.opening_white_top3.length > 0) {
    vector.opening_white_top3 = mergeTopMoves(vector.opening_white_top3, features.opening_white_top3);
    fieldsUpdated.push('opening_white_top3');
  }
  if (features.opening_black_top3.length > 0) {
    vector.opening_black_top3 = mergeTopMoves(vector.opening_black_top3, features.opening_black_top3);
    fieldsUpdated.push('opening_black_top3');
  }
  if (features.capture_tendency !== null) {
    vector.exchange_willingness = blend01(vector.exchange_willingness, features.capture_tendency, importBlendWeight(features.valid_game_count));
    fieldsUpdated.push('exchange_willingness');
  }
  if (features.preferred_minor !== 'neutral') {
    vector.preferred_minor = features.preferred_minor;
    fieldsUpdated.push('preferred_minor');
  }

  return { vector, fieldsUpdated: [...new Set(fieldsUpdated)] };
}

function getVerboseMoves(pgn: string): Move[] {
  if (!pgn.trim()) return [];
  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch {
    return [];
  }
  return chess.history({ verbose: true });
}

function didUserCastle(record: ImportedGameRecord): boolean {
  const moves = getVerboseMoves(record.normalized_pgn || record.pgn_text);
  const userColor = record.user_color === 'white' ? 'w' : record.user_color === 'black' ? 'b' : null;
  if (!userColor) return false;
  return moves.some((move) => move.color === userColor && (move.san === 'O-O' || move.san === 'O-O-O'));
}

function preferredMinorFromMoves(moves: Move[]): PreferredMinor {
  const knightMoves = moves.filter((move) => move.piece === 'n').length;
  const bishopMoves = moves.filter((move) => move.piece === 'b').length;
  if (knightMoves > bishopMoves) return 'knight';
  if (bishopMoves > knightMoves) return 'bishop';
  return 'neutral';
}

function containsClockData(pgn: string): boolean {
  return /%\s*clk\b/i.test(pgn);
}

function normalizeOpeningMove(san: string): string {
  return san.replace(/[+#?!]+/g, '');
}

function topValues(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function mergeTopMoves(existing: string[] | undefined, imported: string[]): string[] {
  return [...imported, ...(existing ?? [])]
    .filter((move, index, all) => move && all.indexOf(move) === index)
    .slice(0, 3);
}

function blend01(current: number | undefined, incoming: number, weight: number): number {
  const safeCurrent = Number.isFinite(current) ? Number(current) : 0.5;
  return Math.round((safeCurrent * (1 - weight) + incoming * weight) * 100) / 100;
}

function importBlendWeight(gameCount: number): number {
  return Math.min(0.35, Math.max(0.12, gameCount / 20));
}

function defaultImportStyleVector(): StyleVector {
  return {
    opening_white_top3: [],
    opening_black_top3: [],
    avg_move_time_ms: 0,
    time_pressure_blunder_rate: 1,
    exchange_willingness: 0.5,
    preferred_minor: 'neutral',
    motif_blindness: {
      fork: 1,
      pin: 1,
      skewer: 1,
      removing_the_defender: 1,
    },
    endgame_strength: 0,
    swindle_preference: null as SwindlePreference,
    detected_elo: 1200,
    elo_band: 'initiate',
    schema_version: STYLE_VECTOR_SCHEMA_VERSION,
  };
}
