import { Chess } from 'chess.js';
import type { ParsedPgnGame, PgnImportPreview } from './pgnTypes';

const DEFAULT_FINAL_FEN = new Chess().fen();
const RESULT_MARKERS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

export function parsePgnText(pgnText: string): PgnImportPreview {
  const chunks = splitPgnGames(pgnText);
  const games = chunks.map(parsePgnGame);

  return {
    games,
    detected_count: games.length,
    valid_count: games.filter((game) => game.legal_status === 'valid').length,
    invalid_count: games.filter((game) => game.legal_status === 'invalid').length,
    partial_count: games.filter((game) => game.legal_status === 'partial').length,
  };
}

export function splitPgnGames(pgnText: string): string[] {
  const normalized = pgnText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  const eventStarts = [...normalized.matchAll(/^\s*\[Event\s+"/gm)].map((match) => match.index ?? 0);
  if (eventStarts.length <= 1) {
    return [normalized];
  }

  return eventStarts
    .map((start, index) => normalized.slice(start, eventStarts[index + 1] ?? normalized.length).trim())
    .filter(Boolean);
}

export function parsePgnGame(rawPgn: string): ParsedPgnGame {
  const raw_pgn = rawPgn.trim();
  const headers = parseHeaders(raw_pgn);

  if (!raw_pgn) {
    return invalidGame(raw_pgn, headers, ['PGN block is empty.']);
  }

  const chess = new Chess();

  try {
    chess.loadPgn(raw_pgn, { strict: false });
  } catch (error) {
    return invalidGame(raw_pgn, headers, [messageFromError(error)]);
  }

  const history = chess.history({ verbose: true });
  const moves = history.map((move) => move.san);
  const result = headers.Result ?? findResultMarker(raw_pgn);
  const validation_errors: string[] = [];

  if (moves.length === 0) {
    validation_errors.push('No legal moves were found in this PGN block.');
  }

  if (result && !RESULT_MARKERS.has(result)) {
    validation_errors.push(`Unsupported result marker: ${result}.`);
  }

  const legal_status: ParsedPgnGame['legal_status'] =
    validation_errors.length === 0 ? 'valid' : moves.length > 0 ? 'partial' : 'invalid';

  return {
    headers,
    moves,
    result,
    raw_pgn,
    normalized_pgn: chess.pgn(),
    final_fen: chess.fen(),
    move_count: moves.length,
    legal_status,
    validation_errors,
  };
}

export function parseHeaders(rawPgn: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const headerRegex = /^\s*\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"])*)"\]\s*$/gm;

  for (const match of rawPgn.matchAll(headerRegex)) {
    headers[match[1]] = match[2].replace(/\\"/g, '"');
  }

  return headers;
}

function invalidGame(
  raw_pgn: string,
  headers: Record<string, string>,
  validation_errors: string[]
): ParsedPgnGame {
  return {
    headers,
    moves: [],
    result: headers.Result ?? findResultMarker(raw_pgn),
    raw_pgn,
    normalized_pgn: '',
    final_fen: DEFAULT_FINAL_FEN,
    move_count: 0,
    legal_status: 'invalid',
    validation_errors,
  };
}

function findResultMarker(rawPgn: string): string | undefined {
  const body = rawPgn.replace(/^\s*\[[^\]]+\]\s*$/gm, ' ').trim();
  const match = body.match(/(?:^|\s)(1-0|0-1|1\/2-1\/2|\*)\s*$/);
  return match?.[1];
}

function messageFromError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'PGN could not be parsed as a legal chess game.';
}

