import { Chess, type Move } from 'chess.js';
import {
  getClueStatsForPlayer,
  getCurrentStyleVectorRecord,
  getImportedGameRecord,
  getLocalMatchRecord,
  getMirrorMatchRecord,
  putGameReviewRecord,
  updateImportedGameRecord,
  type ImportedGameRecord,
} from '../data/db';
import { getCandidateMoves, type EngineCandidate } from '../engine/stockfishBridge';
import type { StyleVector } from '../ml/styleVector';
import { detectKeyMoments, markTurningPoints } from './keyMomentDetector';
import {
  calculateCpLoss,
  classifyMove,
  classificationLabel,
  engineScoreToCentipawns,
  normalizePlayedEvalForMover,
} from './moveClassifier';
import {
  buildPersonalizedSummary,
  buildRecommendedActions,
  buildStyleVectorNote,
} from './personalizedReview';
import { computeReviewMetrics } from './reviewMetrics';
import type {
  GamePhase,
  GameReviewRecord,
  MoveReview,
  RetryAttemptResult,
  ReviewSourceGame,
  ReviewSourceType,
} from './reviewTypes';

export interface CreateGameReviewOptions {
  playerId: string;
  sourceType: ReviewSourceType;
  sourceId: string;
  depth?: number;
  maxMoves?: number;
  reviewedSide?: 'white' | 'black' | 'both' | 'unknown';
  signal?: AbortSignal;
  dbName?: string;
  candidateProvider?: CandidateProvider;
  onProgress?: (state: { reviewed_moves: number; total_moves: number }) => void;
}

export type CandidateProvider = (
  fen: string,
  multipv: number,
  depth: number,
  timeoutMs?: number
) => Promise<EngineCandidate[]>;

const DEFAULT_DEPTH = 8;
const DEFAULT_MAX_MOVES = 80;
const REVIEW_TIMEOUT_MS = 15000;
const SOURCE_LABELS: Record<ReviewSourceType, string> = {
  local_match: 'Local match',
  mirror_match: 'Mirror match',
  imported_game: 'Imported game',
};

let reviewIdCounter = 0;

export async function createGameReview(options: CreateGameReviewOptions): Promise<GameReviewRecord> {
  const depth = options.depth ?? DEFAULT_DEPTH;
  const maxMoves = options.maxMoves ?? DEFAULT_MAX_MOVES;
  const candidateProvider = options.candidateProvider ?? getCandidateMoves;
  const source = await loadReviewSource(options.sourceType, options.sourceId, options.playerId, options.dbName);
  const styleRecord = await getCurrentStyleVectorRecord(options.playerId, options.dbName);
  const clueStats = await getClueStatsForPlayer(options.playerId, options.dbName).catch(() => null);

  const review = await buildGameReviewFromSource(source, {
    depth,
    maxMoves,
    reviewedSide: options.reviewedSide ?? source.reviewed_side,
    styleVector: styleRecord?.vector ?? null,
    clueWeakMotif: clueStats?.weakest_motif ?? null,
    candidateProvider,
    signal: options.signal,
    onProgress: options.onProgress,
  });

  await putGameReviewRecord(review, options.dbName);
  if (source.source_type === 'imported_game') {
    await updateImportedGameRecord(source.source_id, { analysis_status: 'analyzed' }, options.dbName).catch(() => undefined);
  }
  return review;
}

export async function loadReviewSource(
  sourceType: ReviewSourceType,
  sourceId: string,
  playerId: string,
  dbName?: string
): Promise<ReviewSourceGame> {
  if (sourceType === 'local_match') {
    const record = await getLocalMatchRecord(sourceId, dbName);
    if (!record || record.player_id !== playerId) {
      throw new Error('Local match not found for this player.');
    }
    return {
      source_type: sourceType,
      source_id: sourceId,
      player_id: playerId,
      pgn: record.pgn,
      result: record.result_label || record.result,
      reviewed_side: record.actual_side,
      source_label: `${SOURCE_LABELS[sourceType]} (${record.difficulty})`,
    };
  }

  if (sourceType === 'mirror_match') {
    const record = await getMirrorMatchRecord(sourceId, dbName);
    if (!record || record.player_id !== playerId) {
      throw new Error('Mirror match not found for this player.');
    }
    return {
      source_type: sourceType,
      source_id: sourceId,
      player_id: playerId,
      pgn: record.pgn ?? '',
      result: record.result,
      reviewed_side: 'both',
      source_label: SOURCE_LABELS[sourceType],
    };
  }

  const record = await getImportedGameRecord(sourceId, dbName);
  if (!record || record.player_id !== playerId) {
    throw new Error('Imported game not found for this player.');
  }
  assertImportedGameReviewable(record);
  return {
    source_type: sourceType,
    source_id: sourceId,
    player_id: playerId,
    pgn: record.normalized_pgn || record.pgn_text,
    result: record.result,
    reviewed_side: record.user_color ?? 'unknown',
    source_label: `${SOURCE_LABELS[sourceType]} (${record.source})`,
  };
}

export function assertImportedGameReviewable(record: ImportedGameRecord): void {
  if (record.legal_status !== 'valid') {
    throw new Error('Invalid imported games cannot be reviewed. Re-import a valid PGN first.');
  }
  if (!record.normalized_pgn && !record.pgn_text) {
    throw new Error('Imported game has no PGN text to review.');
  }
}

export async function buildGameReviewFromSource(
  source: ReviewSourceGame,
  options: {
    depth: number;
    maxMoves: number;
    reviewedSide: 'white' | 'black' | 'both' | 'unknown';
    styleVector?: StyleVector | null;
    clueWeakMotif?: string | null;
    candidateProvider: CandidateProvider;
    signal?: AbortSignal;
    onProgress?: (state: { reviewed_moves: number; total_moves: number }) => void;
  }
): Promise<GameReviewRecord> {
  const parsed = parsePgnForReview(source.pgn);
  const movesToReview = parsed.history.slice(0, Math.min(parsed.history.length, options.maxMoves));
  const replay = new Chess();
  const moveReviews: MoveReview[] = [];

  for (let index = 0; index < movesToReview.length; index += 1) {
    if (options.signal?.aborted) {
      throw new Error('Game review was cancelled.');
    }

    const move = movesToReview[index];
    const fenBefore = replay.fen();
    const legalCandidateCount = replay.moves().length;
    const candidatesBefore = await options.candidateProvider(fenBefore, 3, options.depth, REVIEW_TIMEOUT_MS);
    const bestCandidate = candidatesBefore[0];
    replay.move(move);
    const fenAfter = replay.fen();
    const candidatesAfter = await options.candidateProvider(fenAfter, 1, options.depth, REVIEW_TIMEOUT_MS);
    const afterCandidate = candidatesAfter[0];

    const bestEvalForMover = engineScoreToCentipawns(bestCandidate);
    const playedEvalForMover = normalizePlayedEvalForMover(afterCandidate);
    const cpLoss = calculateCpLoss(bestEvalForMover, playedEvalForMover);
    const phase = phaseForPosition(fenBefore, Math.floor(index / 2) + 1);
    const motifTags = extractMotifTags(move, phase, cpLoss, bestCandidate);
    const classification = classifyMove({
      cpLoss,
      bestEvalForMover,
      playedEvalForMover,
      legalCandidateCount,
      isBook: false,
    });
    const side = move.color === 'w' ? 'white' : 'black';
    const baseReview: MoveReview = {
      ply: index + 1,
      move_number: Math.floor(index / 2) + 1,
      san: move.san,
      uci: moveToUci(move),
      fen_before: fenBefore,
      fen_after: fenAfter,
      side,
      eval_before: bestEvalForMover ?? undefined,
      eval_after: playedEvalForMover ?? undefined,
      best_move: bestCandidate?.move,
      best_line: bestCandidate?.pv,
      cp_loss: cpLoss ?? undefined,
      classification,
      phase,
      motif_tags: motifTags,
      is_turning_point: false,
      retry_available: Boolean(bestCandidate?.move),
      explanation: buildMoveExplanation(classification, cpLoss, bestCandidate, move),
      evidence: buildMoveEvidence(bestCandidate, cpLoss, bestEvalForMover, playedEvalForMover),
    };
    const note = buildStyleVectorNote(baseReview, {
      styleVector: options.styleVector,
      clueWeakMotif: options.clueWeakMotif,
    });
    moveReviews.push({
      ...baseReview,
      stylevector_note: note.note,
      evidence: [...baseReview.evidence, ...note.evidence],
    });

    options.onProgress?.({ reviewed_moves: index + 1, total_moves: movesToReview.length });
  }

  const keyMoments = detectKeyMoments(moveReviews);
  const markedMoves = markTurningPoints(moveReviews, keyMoments);
  const finalKeyMoments = detectKeyMoments(markedMoves);
  const metrics = computeReviewMetrics(markedMoves);
  const personalizedSummary = buildPersonalizedSummary(markedMoves, finalKeyMoments, {
    styleVector: options.styleVector,
    clueWeakMotif: options.clueWeakMotif,
  });

  const now = new Date().toISOString();
  return {
    id: makeReviewId(),
    player_id: source.player_id,
    source_type: source.source_type,
    source_id: source.source_id,
    created_at: now,
    analysis_depth: options.depth,
    engine_name: 'Stockfish',
    engine_version: 'local',
    total_moves: parsed.history.length,
    reviewed_side: options.reviewedSide,
    accuracy_white: metrics.white.accuracy_estimate,
    accuracy_black: metrics.black.accuracy_estimate,
    average_cp_loss_white: metrics.white.average_cp_loss,
    average_cp_loss_black: metrics.black.average_cp_loss,
    result: source.result ?? parsed.headers.Result,
    opening_name: detectOpeningName(parsed.history),
    phase_summary: metrics.phase_summary,
    key_moments: finalKeyMoments,
    move_reviews: markedMoves,
    personalized_summary: personalizedSummary,
    recommended_actions: buildRecommendedActions(markedMoves, finalKeyMoments, personalizedSummary),
    metadata: {
      source_label: source.source_label,
      local_first: true,
      runtime_genai_used: false,
      accuracy_note: 'MIRROR internal estimate from local deterministic CP-loss thresholds.',
    },
  };
}

export function compareRetryMove(moveReview: MoveReview, attemptedMove: string): RetryAttemptResult {
  if (!moveReview.best_move) {
    return {
      status: 'unavailable',
      message: 'No best move is available for this retry.',
      evidence: ['The original review did not include a best move.'],
    };
  }

  const chess = new Chess(moveReview.fen_before);
  const normalized = normalizeAttemptedMove(chess, attemptedMove);
  if (!normalized) {
    return {
      status: 'invalid',
      attempted_move: attemptedMove,
      expected_move: moveReview.best_move,
      message: 'That move is not legal from the reviewed position.',
      evidence: [`Position: ${moveReview.fen_before}`],
    };
  }

  if (normalized === moveReview.best_move) {
    return {
      status: 'correct',
      attempted_move: normalized,
      expected_move: moveReview.best_move,
      message: 'Correct. You found the reviewed best move.',
      evidence: [`Best move: ${moveReview.best_move}`],
    };
  }

  const samePieceOrTarget = normalized.slice(0, 2) === moveReview.best_move.slice(0, 2)
    || normalized.slice(2, 4) === moveReview.best_move.slice(2, 4);
  return {
    status: samePieceOrTarget ? 'close' : 'still_risky',
    attempted_move: normalized,
    expected_move: moveReview.best_move,
    message: samePieceOrTarget
      ? 'Close idea, but the reviewed best move is still different.'
      : 'Still risky compared with the reviewed best move.',
    evidence: [`Attempted: ${normalized}`, `Best move: ${moveReview.best_move}`],
  };
}

export function exportGameReviewMarkdown(review: GameReviewRecord): string {
  const secretSafeTitle = sanitizeExportText(`${review.source_type}:${review.source_id}`);
  const keyRows = review.key_moments.length > 0
    ? review.key_moments.map((moment) => `- Move ${moment.move_number} ${moment.san}: ${moment.reason}`).join('\n')
    : '- No key moments detected.';
  const actionRows = review.recommended_actions
    .map((action) => `- ${action.title}: ${action.description}`)
    .join('\n');
  const topMoves = review.move_reviews
    .filter((move) => ['inaccuracy', 'mistake', 'blunder', 'missed_win'].includes(move.classification))
    .slice(0, 8)
    .map((move) => `- ${move.move_number}${move.side === 'black' ? '...' : '.'} ${move.san}: ${classificationLabel(move.classification)} (${move.cp_loss ?? 'n/a'} cp loss). ${move.explanation}`)
    .join('\n') || '- No major reviewed issues.';

  return [
    '# MIRROR Game Review Pro',
    '',
    `Source: ${secretSafeTitle}`,
    `Engine: ${sanitizeExportText(review.engine_name)} (${review.engine_version ?? 'local'})`,
    `Created: ${review.created_at}`,
    '',
    '## Accuracy',
    '',
    `- White: ${review.accuracy_white ?? 0}% internal estimate, ${review.average_cp_loss_white ?? 0} avg CP loss`,
    `- Black: ${review.accuracy_black ?? 0}% internal estimate, ${review.average_cp_loss_black ?? 0} avg CP loss`,
    '',
    '## Key Moments',
    '',
    keyRows,
    '',
    '## Move Issues',
    '',
    topMoves,
    '',
    '## Personalized Summary',
    '',
    `- ${sanitizeExportText(review.personalized_summary.headline)}`,
    ...review.personalized_summary.notes.map((note) => `- ${sanitizeExportText(note)}`),
    '',
    '## Recommended Actions',
    '',
    actionRows || '- Review one key moment, then play a Mirror rematch.',
    '',
    'Local-first note: this report uses deterministic Stockfish-backed review and StyleVector evidence. Runtime GenAI is not used.',
  ].join('\n');
}

export function parsePgnForReview(pgn: string): { headers: Record<string, string>; history: Move[] } {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch {
    throw new Error('PGN could not be loaded for review.');
  }
  return {
    headers: Object.fromEntries(
      Object.entries(chess.header()).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    ),
    history: chess.history({ verbose: true }),
  };
}

function phaseForPosition(fen: string, moveNumber: number): GamePhase {
  if (moveNumber <= 10) return 'opening';
  if (moveNumber >= 35 || nonKingMaterialCount(fen) <= 10) return 'endgame';
  return 'middlegame';
}

function extractMotifTags(move: Move, phase: GamePhase, cpLoss: number | null, bestCandidate?: EngineCandidate): string[] {
  const tags = new Set<string>();
  if (move.captured) tags.add('capture');
  if (move.san.includes('+') || move.san.includes('#')) tags.add('check');
  if (move.san === 'O-O' || move.san === 'O-O-O') tags.add('castling');
  if (move.piece === 'q' && phase === 'opening') tags.add('queen_move_early');
  if (phase === 'endgame') tags.add('endgame');
  if ((cpLoss ?? 0) >= 120) tags.add('tactical');
  if (bestCandidate?.pv?.[0] && bestCandidate.pv[0] !== moveToUci(move) && (cpLoss ?? 0) >= 120) {
    tags.add('missed_engine_line');
  }
  if ((cpLoss ?? 0) >= 250) tags.add('hanging_piece');
  return tags.size > 0 ? [...tags] : ['unknown'];
}

function buildMoveExplanation(
  classification: MoveReview['classification'],
  cpLoss: number | null,
  bestCandidate: EngineCandidate | undefined,
  move: Move
): string {
  if (!bestCandidate || cpLoss === null) {
    return 'Engine evidence was insufficient, so MIRROR marks this move as unknown.';
  }
  if (classification === 'best' || classification === 'excellent') {
    return 'The played move stayed very close to the local Stockfish candidate.';
  }
  if (classification === 'missed_win') {
    return `The engine showed a major opportunity before ${move.san}; ${bestCandidate.move} was the reviewed best move.`;
  }
  return `The move lost ${cpLoss} centipawns against the reviewed best move ${bestCandidate.move}.`;
}

function buildMoveEvidence(
  bestCandidate: EngineCandidate | undefined,
  cpLoss: number | null,
  bestEvalForMover: number | null,
  playedEvalForMover: number | null
): string[] {
  const evidence: string[] = [];
  if (bestCandidate?.move) evidence.push(`Best move candidate: ${bestCandidate.move}.`);
  if (bestCandidate?.pv?.length) evidence.push(`Principal variation: ${bestCandidate.pv.slice(0, 4).join(' ')}.`);
  if (cpLoss !== null) evidence.push(`Normalized CP loss: ${cpLoss}.`);
  if (bestEvalForMover !== null) evidence.push(`Eval before from mover perspective: ${bestEvalForMover}.`);
  if (playedEvalForMover !== null) evidence.push(`Eval after from mover perspective: ${playedEvalForMover}.`);
  return evidence.length > 0 ? evidence : ['No engine evidence was available.'];
}

function detectOpeningName(history: Move[]): string | undefined {
  const first = history[0]?.san?.replace(/[+#?!]+/g, '');
  const second = history[1]?.san?.replace(/[+#?!]+/g, '');
  if (!first) return undefined;
  if (first === 'e4' && second === 'c5') return 'Sicilian Defense family';
  if (first === 'e4' && second === 'e5') return 'Open Game family';
  if (first === 'd4' && second === 'd5') return 'Queen Pawn Game family';
  if (first === 'd4' && second === 'Nf6') return 'Indian Defense family';
  if (first === 'Nf3') return 'Reti Opening family';
  if (first === 'c4') return 'English Opening family';
  return `${first} opening family`;
}

function normalizeAttemptedMove(chess: Chess, attemptedMove: string): string | null {
  const trimmed = attemptedMove.trim();
  try {
    const move = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(trimmed)
      ? chess.move({
          from: trimmed.slice(0, 2),
          to: trimmed.slice(2, 4),
          promotion: trimmed.length === 5 ? trimmed[4] : undefined,
        })
      : chess.move(trimmed);
    return move ? moveToUci(move) : null;
  } catch {
    return null;
  }
}

function moveToUci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function nonKingMaterialCount(fen: string): number {
  return fen
    .split(' ')[0]
    .replace(/[0-9/]/g, '')
    .replace(/[kK]/g, '').length;
}

function sanitizeExportText(value: string): string {
  return value.replace(/(access_token|refresh_token|supabase|service_role|jwt|secret|api[_-]?key)/gi, '[redacted]');
}

function makeReviewId(): string {
  reviewIdCounter += 1;
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${reviewIdCounter}`;
  return `game-review-${randomId}`;
}
