import { Chess, type Move, type Square } from 'chess.js';
import { getBestMove, getCandidateMoves, setOption, waitForEngine, type EngineCandidate } from './stockfishBridge';
import type { StyleVector } from '../ml/styleVector';
import type { OpponentMoveOptions, OpponentProvider } from '../types/opponent';

const DEFAULT_MULTIPV = 5;
const DEFAULT_DEPTH = 8;
const DEFAULT_TIMEOUT_MS = 15_000;
const STOCKFISH_MIN_ELO = 1320;
const STOCKFISH_MAX_ELO = 3190;

type MirrorReason = 'engine' | 'exchange' | 'forcing' | 'time_pressure_probe' | 'motif_probe' | 'swindle';

export interface MirrorDecisionTrace {
  move: string;
  san: string;
  reason: MirrorReason;
  tendency: number;
  detail: string;
}

export interface RankedMirrorCandidate {
  move: string;
  san: string;
  engineScore: number;
  styleBias: number;
  totalScore: number;
  reason: MirrorReason;
  tendency: number;
  detail: string;
}

export interface MirrorMoveResult {
  move: string | null;
  trace: MirrorDecisionTrace | null;
  candidates: RankedMirrorCandidate[];
}

export interface MirrorOpponentOptions {
  multipv?: number;
  depth?: number;
  timeoutMs?: number;
}

export interface MirrorOpponentProvider extends OpponentProvider {
  getMoveWithTrace(fen: string, options?: OpponentMoveOptions): Promise<MirrorMoveResult>;
}

export function createMirrorOpponent(
  styleVector: StyleVector,
  defaults: MirrorOpponentOptions = {}
): MirrorOpponentProvider {
  let configured = false;

  async function configureEngine(): Promise<void> {
    if (configured) return;
    await waitForEngine();
    await setOption('UCI_LimitStrength', true);
    await setOption('UCI_Elo', clampElo(styleVector.detected_elo));
    configured = true;
  }

  return {
    id: 'mirror-stockfish-rerank',

    async getMove(fen, options) {
      const result = await this.getMoveWithTrace(fen, options);
      return result.move;
    },

    async getMoveWithTrace(fen, options = {}) {
      await configureEngine();
      const multipv = defaults.multipv ?? DEFAULT_MULTIPV;
      const depth = options.depth ?? defaults.depth ?? DEFAULT_DEPTH;
      const timeoutMs = options.timeoutMs ?? defaults.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const candidates = await getCandidateMoves(fen, multipv, depth, timeoutMs);
      const ranked = rankMirrorCandidates(fen, candidates, styleVector);

      if (ranked[0]) {
        return {
          move: ranked[0].move,
          trace: {
            move: ranked[0].move,
            san: ranked[0].san,
            reason: ranked[0].reason,
            tendency: ranked[0].tendency,
            detail: ranked[0].detail,
          },
          candidates: ranked,
        };
      }

      const fallback = await getBestMove(fen, depth, timeoutMs);
      return { move: fallback, trace: null, candidates: [] };
    },

    dispose() {
      configured = false;
    },
  };
}

export function rankMirrorCandidates(
  fen: string,
  candidates: EngineCandidate[],
  vector: StyleVector
): RankedMirrorCandidate[] {
  const game = new Chess(fen);
  const legalMoves = game.moves({ verbose: true });
  const legalByUci = new Map(legalMoves.map((move) => [moveToUci(move), move]));

  return candidates
    .map((candidate) => {
      const move = legalByUci.get(candidate.move);
      if (!move) return null;

      const style = styleBiasForMove(fen, move, vector);
      const engineScore = scoreCandidate(candidate);
      const totalScore = engineScore + style.bias;

      return {
        move: candidate.move,
        san: move.san,
        engineScore,
        styleBias: style.bias,
        totalScore,
        reason: style.reason,
        tendency: style.tendency,
        detail: style.detail,
      };
    })
    .filter((candidate): candidate is RankedMirrorCandidate => candidate !== null)
    .sort((a, b) => b.totalScore - a.totalScore || a.move.localeCompare(b.move));
}

export function describeMirrorDecision(
  trace: MirrorDecisionTrace | null | undefined,
  moveNumber: number
): string {
  if (!trace) {
    return 'It followed the engine line because no stronger style signal appeared in the final position.';
  }

  const percent = Math.round(trace.tendency * 100);

  if (trace.reason === 'exchange') {
    return `It took the trade on move ${moveNumber} because you accept that exchange about ${percent}% of the time.`;
  }

  if (trace.reason === 'time_pressure_probe') {
    return `It chose ${trace.san} on move ${moveNumber} because your time-pressure profile misses forcing moves about ${percent}% of the time.`;
  }

  if (trace.reason === 'motif_probe') {
    return `It chose ${trace.san} on move ${moveNumber} because your tactical calibration showed a ${percent}% blind-spot signal for motifs like this.`;
  }

  if (trace.reason === 'swindle') {
    return `It kept ${trace.san} on move ${moveNumber} because your style allows messy swindles when the board offers them.`;
  }

  if (trace.reason === 'forcing') {
    return `It chose the forcing move ${trace.san} on move ${moveNumber} because your profile rewards direct pressure.`;
  }

  return `It played ${trace.san} on move ${moveNumber} because Stockfish still ranked it highest after your style vector was applied.`;
}

function styleBiasForMove(
  fen: string,
  move: Move,
  vector: StyleVector
): Pick<RankedMirrorCandidate, 'styleBias' | 'reason' | 'tendency' | 'detail'> & {
  bias: number;
} {
  const exchangeTendency = clamp01(vector.exchange_willingness);
  const timePressureTendency = clamp01(vector.time_pressure_blunder_rate);
  const motifTendency = average(Object.values(vector.motif_blindness));
  const isExchange = move.isCapture();
  const isForcing = move.san.includes('+') || move.san.includes('#') || move.isPromotion();
  const probeWindow = shouldProbeWeakness(fen, vector);

  let bias = 0;
  let reason: MirrorReason = 'engine';
  let tendency = 0.5;
  let detail = 'engine preference';

  if (isExchange) {
    const exchangeBias = (exchangeTendency - 0.5) * 90;
    bias += exchangeBias;
    reason = 'exchange';
    tendency = exchangeTendency;
    detail = 'capture or trade candidate';
  }

  if (isForcing) {
    const forceBias = 18 + timePressureTendency * 24;
    bias += forceBias;
    reason = 'forcing';
    tendency = timePressureTendency;
    detail = 'check, mate threat, or promotion candidate';
  }

  if (probeWindow && isForcing && timePressureTendency >= 0.45) {
    bias += 28;
    reason = 'time_pressure_probe';
    tendency = timePressureTendency;
    detail = 'opportunistic time-pressure probe';
  } else if (probeWindow && move.isCapture() && motifTendency >= 0.45) {
    bias += 24;
    reason = 'motif_probe';
    tendency = motifTendency;
    detail = 'opportunistic motif-blindness probe';
  }

  if (vector.swindle_preference === 'swindle' && isMessyMove(fen, move)) {
    bias += 18;
    reason = 'swindle';
    tendency = 1;
    detail = 'messy forcing or material-imbalancing candidate';
  }

  return {
    bias,
    styleBias: bias,
    reason,
    tendency,
    detail,
  };
}

function shouldProbeWeakness(fen: string, vector: StyleVector): boolean {
  const weaknessSignal =
    average(Object.values(vector.motif_blindness)) * 0.6 +
    clamp01(vector.time_pressure_blunder_rate) * 0.4;
  if (weaknessSignal < 0.45) return false;
  return deterministicBucket(`${fen}|${vector.detected_elo}|${vector.elo_band}`) < 20;
}

function isMessyMove(fen: string, move: Move): boolean {
  if (move.san.includes('+') || move.san.includes('#')) return true;
  if (!move.isCapture()) return false;

  const captured = move.captured ? pieceValue(move.captured) : 0;
  const mover = pieceValue(move.piece);
  if (mover > captured) return true;

  const after = new Chess(fen);
  after.move({ from: move.from, to: move.to, promotion: move.promotion });
  const opponent = after.turn();
  return after.isAttacked(move.to as Square, opponent);
}

function scoreCandidate(candidate: EngineCandidate): number {
  if (candidate.mate !== null) {
    return candidate.mate > 0 ? 10_000 - candidate.mate : -10_000 - candidate.mate;
  }

  return candidate.cp ?? 0;
}

function moveToUci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function pieceValue(piece: string): number {
  switch (piece) {
    case 'p':
      return 100;
    case 'n':
    case 'b':
      return 300;
    case 'r':
      return 500;
    case 'q':
      return 900;
    default:
      return 0;
  }
}

function deterministicBucket(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}

function clampElo(value: number): number {
  return Math.max(STOCKFISH_MIN_ELO, Math.min(STOCKFISH_MAX_ELO, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + clamp01(value), 0) / values.length;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
