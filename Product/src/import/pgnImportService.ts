import { analyzeGame } from '../analysis/analyzeGame';
import {
  getCurrentStyleVectorRecord,
  getImportedGameRecord,
  putAnalysisRecord,
  putImportedGameRecords,
  updateImportedGameRecord,
  type ImportedGameRecord,
  type ImportedGameSource,
} from '../data/db';
import { extractImportedGameStyleFeatures, updateStyleVectorFromImportedGames } from './importedGameStyleFeatures';
import { parsePgnText } from './pgnParser';
import type {
  ParsedPgnGame,
  PgnImportPreview,
  PgnImportSaveResult,
  PgnImportSummary,
  SavePgnImportOptions,
} from './pgnTypes';

export interface AnalyzeImportedGamesOptions {
  limit?: number;
  depth?: number;
  maxMoves?: number;
  signal?: AbortSignal;
  onProgress?: (state: {
    analyzed_games: number;
    total_games: number;
    current_game_id?: string;
    current_move?: number;
    total_moves?: number;
  }) => void;
}

let importIdCounter = 0;

export function previewPgnImport(pgnText: string): PgnImportPreview {
  return parsePgnText(pgnText);
}

export async function savePgnImport(
  options: SavePgnImportOptions,
  dbName?: string
): Promise<PgnImportSaveResult> {
  const now = new Date().toISOString();
  const records = options.games.map((game, index) =>
    parsedGameToRecord({
      game,
      index,
      now,
      playerId: options.playerId,
      source: options.source,
      originalFilename: options.originalFilename,
      playerNameHint: options.playerNameHint,
    })
  );

  await putImportedGameRecords(records, dbName);

  const stylevector_update = await updateStyleVectorFromImportedGames(
    options.playerId,
    records.map((record) => record.id),
    dbName
  );

  const summary = buildImportSummary(records, stylevector_update.fields_updated, stylevector_update.insufficient_data);

  return {
    records,
    summary,
    stylevector_update,
  };
}

export async function analyzeImportedGames(
  playerId: string,
  importedGameIds: string[],
  options: AnalyzeImportedGamesOptions = {},
  dbName?: string
): Promise<{ analyzed: number; failed: number; skipped: number; analysis_ids: string[] }> {
  const limit = options.limit ?? 5;
  const depth = options.depth ?? 8;
  const maxMoves = options.maxMoves ?? 60;
  const styleVector = (await getCurrentStyleVectorRecord(playerId, dbName))?.vector;
  const analysisIds: string[] = [];
  let analyzed = 0;
  let failed = 0;
  let skipped = 0;

  const records: ImportedGameRecord[] = [];
  for (const id of importedGameIds) {
    const record = await getImportedGameRecord(id, dbName);
    if (record) records.push(record);
  }

  const validRecords = records.filter((record) => record.player_id === playerId && record.legal_status === 'valid');
  const eligible = validRecords.slice(0, limit);

  skipped = Math.max(0, records.length - eligible.length);

  for (const record of eligible) {
    if (options.signal?.aborted) break;
    await updateImportedGameRecord(record.id, { analysis_status: 'queued' }, dbName);
    try {
      const analysis = await analyzeGame(
        record.normalized_pgn || record.pgn_text,
        playerId,
        record.id,
        'imported',
        styleVector,
        {
          depth,
          maxMoves,
          onProgress: (current_move, total_moves) => {
            options.onProgress?.({
              analyzed_games: analyzed,
              total_games: eligible.length,
              current_game_id: record.id,
              current_move,
              total_moves,
            });
          },
        }
      );
      await putAnalysisRecord(analysis, dbName);
      await updateImportedGameRecord(record.id, { analysis_status: 'analyzed' }, dbName);
      analysisIds.push(analysis.id);
      analyzed += 1;
      options.onProgress?.({ analyzed_games: analyzed, total_games: eligible.length, current_game_id: record.id });
    } catch {
      failed += 1;
      await updateImportedGameRecord(record.id, { analysis_status: 'failed' }, dbName);
    }
  }

  return { analyzed, failed, skipped, analysis_ids: analysisIds };
}

export function buildImportReportMarkdown(summary: PgnImportSummary): string {
  const sourceRows = Object.entries(summary.source_breakdown)
    .map(([source, count]) => `- ${source}: ${count}`)
    .join('\n');
  const resultRows = Object.entries(summary.result_summary)
    .map(([result, count]) => `- ${result}: ${count}`)
    .join('\n');
  const fields = summary.stylevector_fields_updated.length > 0
    ? summary.stylevector_fields_updated.map((field) => `- ${field}`).join('\n')
    : '- No StyleVector fields updated yet';
  const insufficient = summary.insufficient_data.length > 0
    ? summary.insufficient_data.map((flag) => `- ${flag}`).join('\n')
    : '- None';

  return [
    '# MIRROR PGN Import Report',
    '',
    `Games detected: ${summary.games_detected}`,
    `Games saved: ${summary.games_saved}`,
    `Valid games: ${summary.valid_games}`,
    `Invalid games: ${summary.invalid_games}`,
    `Partial games: ${summary.partial_games}`,
    '',
    '## Sources',
    sourceRows || '- None',
    '',
    '## Results',
    resultRows || '- None',
    '',
    '## Openings Detected',
    summary.openings_detected.length > 0 ? summary.openings_detected.map((opening) => `- ${opening}`).join('\n') : '- Not enough user-attributed games',
    '',
    '## StyleVector Updates',
    fields,
    '',
    '## Insufficient Data',
    insufficient,
    '',
    '## Recommended Next Action',
    summary.recommended_next_action,
  ].join('\n');
}

export function buildImportSummary(
  records: ImportedGameRecord[],
  stylevectorFieldsUpdated: string[] = [],
  insufficientData: string[] = []
): PgnImportSummary {
  const sourceBreakdown = records.reduce((acc, record) => {
    acc[record.source] = (acc[record.source] ?? 0) + 1;
    return acc;
  }, {} as Record<ImportedGameSource, number>);
  const resultSummary = records.reduce((acc, record) => {
    const result = record.result ?? 'unknown';
    acc[result] = (acc[result] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const styleFeatures = extractImportedGameStyleFeatures(records);
  const openingsDetected = [
    ...styleFeatures.opening_white_top3.map((move) => `White: ${move}`),
    ...styleFeatures.opening_black_top3.map((move) => `Black: ${move}`),
  ];

  return {
    imported_game_ids: records.map((record) => record.id),
    games_detected: records.length,
    games_saved: records.length,
    valid_games: records.filter((record) => record.legal_status === 'valid').length,
    invalid_games: records.filter((record) => record.legal_status === 'invalid').length,
    partial_games: records.filter((record) => record.legal_status === 'partial').length,
    source_breakdown: sourceBreakdown,
    result_summary: resultSummary,
    openings_detected: openingsDetected,
    stylevector_fields_updated: stylevectorFieldsUpdated,
    insufficient_data: [...new Set([...insufficientData, ...styleFeatures.insufficient_data])],
    recommended_next_action: recommendNextAction(records, stylevectorFieldsUpdated),
  };
}

function parsedGameToRecord(args: {
  game: ParsedPgnGame;
  index: number;
  now: string;
  playerId: string;
  source: ImportedGameSource;
  originalFilename?: string;
  playerNameHint?: string;
}): ImportedGameRecord {
  const { game, index, now, playerId, source, originalFilename, playerNameHint } = args;
  const id = makeImportId(index);
  const userColor = detectUserColor(game.headers, playerNameHint);

  return {
    id,
    player_id: playerId,
    source,
    original_filename: originalFilename,
    imported_at: now,
    headers: game.headers,
    pgn_text: game.raw_pgn,
    normalized_pgn: game.normalized_pgn,
    result: game.result,
    white: game.headers.White,
    black: game.headers.Black,
    user_color: userColor,
    move_count: game.move_count,
    final_fen: game.final_fen,
    legal_status: game.legal_status,
    validation_errors: game.validation_errors,
    analysis_status: 'not_analyzed',
    stylevector_applied: false,
    created_at: now,
    updated_at: now,
    metadata: {
      parser: 'chess.js strict:false',
      game_index: index,
      source_local_only: true,
    },
  };
}

export function detectUserColor(
  headers: Record<string, string>,
  playerNameHint?: string
): ImportedGameRecord['user_color'] {
  const hint = normalizeName(playerNameHint);
  if (!hint || hint.length < 3) return 'unknown';
  const white = normalizeName(headers.White);
  const black = normalizeName(headers.Black);

  if (white === hint || (white.length > 0 && white.includes(hint))) return 'white';
  if (black === hint || (black.length > 0 && black.includes(hint))) return 'black';
  return 'unknown';
}

function normalizeName(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, '')
    .replace(/\s+/g, ' ');
}

function recommendNextAction(records: ImportedGameRecord[], fieldsUpdated: string[]): string {
  const validCount = records.filter((record) => record.legal_status === 'valid').length;
  const invalidCount = records.filter((record) => record.legal_status === 'invalid').length;

  if (validCount === 0) return 'Fix the PGN text and preview again before importing more games.';
  if (fieldsUpdated.length === 0) return 'Add your player name as it appears in the PGN, then import more games for StyleVector evidence.';
  if (invalidCount > 0) return 'Analyze the valid imported games, then review invalid rows separately.';
  return 'Analyze the imported games with Stockfish, then play Mirror current self to test the updated fingerprint.';
}

function makeImportId(index: number): string {
  importIdCounter += 1;
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${importIdCounter}`;
  return `imported-game-${index + 1}-${randomId}`;
}
