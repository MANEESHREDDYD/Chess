import { Chess, type Move, type Square } from 'chess.js';
import type { EngineCandidate } from '../engine/stockfishBridge';
import type { StyleVector } from '../ml/styleVector';

export type GamePhase = 'opening' | 'middlegame' | 'endgame';
export type CandidatePiece = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface CandidateMoveFeatures {
  move: string;
  san: string;
  engineRank: number;
  engineScore: number;
  cp_score: number;
  cp_loss_from_best: number;
  is_capture: boolean;
  is_check: boolean;
  gives_check: boolean;
  is_castle: boolean;
  queen_move_early: boolean;
  piece_moved: CandidatePiece;
  tactical_flag: boolean;
  king_safety_proxy: number;
  material_change_proxy: number;
  repetition_drawish_proxy: number;
  opening_preference_proxy: number;
  risk_proxy: number;
  uci: string;
  candidate: EngineCandidate;
}

export interface ExtractCandidateMoveFeatureInput {
  fen: string;
  candidates: EngineCandidate[];
  styleVector?: StyleVector | null;
}

export function extractCandidateMoveFeatures({
  fen,
  candidates,
  styleVector,
}: ExtractCandidateMoveFeatureInput): CandidateMoveFeatures[] {
  const game = new Chess(fen);
  const legalByUci = legalMovesByUci(fen);
  const scored = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      move: legalByUci.get(candidate.move),
      score: scoreEngineCandidate(candidate),
    }))
    .filter((entry): entry is {
      candidate: EngineCandidate;
      index: number;
      move: Move;
      score: number;
    } => Boolean(entry.move));

  const bestScore = scored.reduce(
    (best, entry) => Math.max(best, entry.score),
    scored.length > 0 ? scored[0].score : 0
  );

  return scored.map(({ candidate, index, move, score }) => {
    const after = new Chess(fen);
    after.move({ from: move.from, to: move.to, promotion: move.promotion });

    const isCapture = isCaptureMove(move);
    const givesCheck = move.san.includes('+') || move.san.includes('#') || after.inCheck();
    const isCastle = isCastleMove(move);
    const queenMoveEarly = move.piece === 'q' && fullMoveNumberFromFen(fen) <= 8;
    const materialChange = materialChangeProxy(move, after);
    const drawish = drawishProxy(after);
    const kingSafety = kingSafetyProxy(game, move, givesCheck, isCastle, queenMoveEarly);
    const risk = riskProxy(move, after, queenMoveEarly, materialChange, drawish);
    const openingPreference = openingPreferenceProxy(fen, move, styleVector);

    return {
      move: candidate.move,
      san: move.san,
      engineRank: candidate.multipv || index + 1,
      engineScore: score,
      cp_score: score,
      cp_loss_from_best: Math.max(0, bestScore - score),
      is_capture: isCapture,
      is_check: game.inCheck(),
      gives_check: givesCheck,
      is_castle: isCastle,
      queen_move_early: queenMoveEarly,
      piece_moved: move.piece as CandidatePiece,
      tactical_flag: givesCheck || isCapture || Boolean(move.promotion) || materialChange > 0,
      king_safety_proxy: kingSafety,
      material_change_proxy: materialChange,
      repetition_drawish_proxy: drawish,
      opening_preference_proxy: openingPreference,
      risk_proxy: risk,
      uci: candidate.move,
      candidate,
    };
  });
}

export function legalMovesByUci(fen: string): Map<string, Move> {
  const game = new Chess(fen);
  return new Map(game.moves({ verbose: true }).map((move) => [moveToUci(move), move]));
}

export function detectGamePhase(fen: string): GamePhase {
  const game = new Chess(fen);
  const fullMove = fullMoveNumberFromFen(fen);
  const board = game.board();
  let material = 0;
  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      material += pieceValue(piece.type);
    }
  }

  if (fullMove <= 10) return 'opening';
  if (material <= 2600 || fullMove >= 40) return 'endgame';
  return 'middlegame';
}

export function scoreEngineCandidate(candidate: EngineCandidate): number {
  if (candidate.mate !== null && candidate.mate !== undefined) {
    return candidate.mate > 0 ? 10_000 - Math.abs(candidate.mate) : -10_000 + Math.abs(candidate.mate);
  }

  return Number.isFinite(candidate.cp) ? Number(candidate.cp) : 0;
}

export function moveToUci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

export function fullMoveNumberFromFen(fen: string): number {
  const fullMove = Number(fen.split(/\s+/)[5]);
  return Number.isFinite(fullMove) ? fullMove : 1;
}

export function pieceValue(piece: string | undefined): number {
  switch (piece) {
    case 'p':
      return 100;
    case 'n':
    case 'b':
      return 320;
    case 'r':
      return 500;
    case 'q':
      return 900;
    default:
      return 0;
  }
}

function isCaptureMove(move: Move): boolean {
  return Boolean(move.captured) || move.san.includes('x');
}

function isCastleMove(move: Move): boolean {
  return move.san === 'O-O' || move.san === 'O-O-O';
}

function materialChangeProxy(move: Move, after: Chess): number {
  const captured = pieceValue(move.captured);
  const promotionGain = move.promotion ? pieceValue(move.promotion) - pieceValue('p') : 0;
  const mover = pieceValue(move.piece);
  const opponent = after.turn();
  const destinationCanBeTaken = move.piece !== 'k' && after.isAttacked(move.to as Square, opponent);
  const loosePieceRisk = destinationCanBeTaken ? Math.min(mover, 500) * 0.45 : 0;
  return captured + promotionGain - loosePieceRisk;
}

function drawishProxy(after: Chess): number {
  if (after.isStalemate() || after.isThreefoldRepetition() || after.isInsufficientMaterial()) return 1;
  if (after.isDraw()) return 0.8;
  return 0;
}

function kingSafetyProxy(
  before: Chess,
  move: Move,
  givesCheck: boolean,
  isCastle: boolean,
  queenMoveEarly: boolean
): number {
  let score = 0;
  if (isCastle) score += 1;
  if (before.inCheck()) score += 0.35;
  if (move.piece === 'k' && !isCastle) score -= 0.45;
  if (queenMoveEarly) score -= 0.22;
  if (givesCheck) score += 0.08;
  return clamp(score, -1, 1);
}

function riskProxy(
  move: Move,
  after: Chess,
  queenMoveEarly: boolean,
  materialChange: number,
  drawish: number
): number {
  const moverValue = pieceValue(move.piece);
  const opponent = after.turn();
  const canBeTaken = move.piece !== 'k' && after.isAttacked(move.to as Square, opponent);
  let risk = 0;

  if (canBeTaken) risk += Math.min(0.6, moverValue / 1500);
  if (queenMoveEarly) risk += 0.26;
  if (move.piece === 'k' && !isCastleMove(move)) risk += 0.32;
  if (materialChange < 0) risk += Math.min(0.45, Math.abs(materialChange) / 600);
  if (drawish > 0) risk += 0.16;

  return clamp(risk, 0, 1);
}

function openingPreferenceProxy(fen: string, move: Move, vector: StyleVector | null | undefined): number {
  if (!vector || fullMoveNumberFromFen(fen) > 4) return 0;

  const repertoire = move.color === 'w' ? vector.opening_white_top3 : vector.opening_black_top3;
  const keys = new Set([normalizeMoveKey(move.san), normalizeMoveKey(moveToUci(move))]);
  return repertoire.some((storedMove) => keys.has(normalizeMoveKey(storedMove))) ? 1 : 0;
}

function normalizeMoveKey(move: string): string {
  return move
    .toLowerCase()
    .replace(/\.+/g, '')
    .replace(/[+#?!]/g, '')
    .trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}
