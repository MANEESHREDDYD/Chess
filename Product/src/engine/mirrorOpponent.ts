import { Chess, type Move, type Square } from 'chess.js';
import { getBestMove, getCandidateMoves, setOption, waitForEngine, type EngineCandidate } from './stockfishBridge';
import type { StyleVector } from '../ml/styleVector';
import type { OpponentMoveOptions, OpponentProvider } from '../types/opponent';

const DEFAULT_MULTIPV = 5;
const DEFAULT_DEPTH = 8;
const DEFAULT_TIMEOUT_MS = 15_000;

// Two-regime base-strength selection (see docs/m3-report.md).
//
// Stockfish's UCI_LimitStrength can only set UCI_Elo within [1320, 3190].
// For detected_elo below 1320 (the apprentice band and the low end of
// initiate) we fall back to the same mechanism calibrationOpponent.ts uses
// successfully: Skill Level (0-20) plus a depth cap, both mapped from the
// player's detected_elo. The style reranker (rankMirrorCandidates) runs on
// top of whichever base the engine is configured into.
const STOCKFISH_UCI_MIN_ELO = 1320;
const STOCKFISH_UCI_MAX_ELO = 3190;
const DETECTED_ELO_FLOOR = 800;
const SKILL_REGIME_MIN_DEPTH = 2;
const SKILL_REGIME_MAX_DEPTH = 6;
const SKILL_REGIME_MAX_LEVEL = 10;

type MirrorReason = 'engine' | 'exchange' | 'forcing' | 'time_pressure_probe' | 'motif_probe' | 'swindle';
export type StyleDimension =
  | 'engine'
  | 'exchange_willingness'
  | 'preferred_minor'
  | 'opening_repertoire'
  | 'aggression'
  | 'time_pressure'
  | 'motif_blindness'
  | 'swindle_preference';

export interface MirrorDecisionTrace {
  move: string;
  san: string;
  stockfishTopMove: string | null;
  stockfishTopSan: string | null;
  overrodeStockfish: boolean;
  styleDimension: StyleDimension;
  styleBias: number;
  stockfishTopEngineScore: number | null;
  rerankedEngineScore: number;
  rerankedTotalScore: number;
  reason: MirrorReason;
  tendency: number;
  detail: string;
}

export interface RankedMirrorCandidate {
  move: string;
  san: string;
  engineRank: number;
  engineScore: number;
  styleBias: number;
  totalScore: number;
  reason: MirrorReason;
  styleDimension: StyleDimension;
  tendency: number;
  detail: string;
}

export interface MirrorMoveResult {
  move: string | null;
  trace: MirrorDecisionTrace | null;
  candidates: RankedMirrorCandidate[];
}

export interface MirrorRerankSummary {
  totalMirrorMoves: number;
  overrideCount: number;
  overrideRate: number;
  overridesByDimension: Partial<Record<StyleDimension, number>>;
}

export interface MirrorOpponentOptions {
  multipv?: number;
  depth?: number;
  timeoutMs?: number;
}

export interface MirrorOpponentProvider extends OpponentProvider {
  getMoveWithTrace(fen: string, options?: OpponentMoveOptions): Promise<MirrorMoveResult>;
}

export type MirrorEngineRegime =
  | { regime: 'uci-limit'; uciElo: number }
  | { regime: 'skill'; skillLevel: number; depthCap: number };

// Pick the base-strength regime for a detected_elo. Above the Stockfish
// UCI_LimitStrength floor (1320) we use UCI_Elo. Below it we cannot — the
// option won't accept anything lower — so we fall back to Skill Level + a
// depth cap, the same mechanism calibrationOpponent uses. The reranker
// runs identically on top of either regime.
export function mirrorEngineRegimeFor(detectedElo: number): MirrorEngineRegime {
  const safeElo = Number.isFinite(detectedElo)
    ? Math.round(detectedElo)
    : DETECTED_ELO_FLOOR;

  if (safeElo >= STOCKFISH_UCI_MIN_ELO) {
    return {
      regime: 'uci-limit',
      uciElo: Math.min(STOCKFISH_UCI_MAX_ELO, safeElo),
    };
  }

  // Linear ramp from detected_elo 800 -> 1319 across:
  //   skillLevel 0  ->  SKILL_REGIME_MAX_LEVEL (10, well below mid-default 20)
  //   depthCap   2  ->  SKILL_REGIME_MAX_DEPTH (6)
  const clampedElo = Math.max(DETECTED_ELO_FLOOR, safeElo);
  const span = STOCKFISH_UCI_MIN_ELO - DETECTED_ELO_FLOOR;
  const t = span > 0 ? (clampedElo - DETECTED_ELO_FLOOR) / span : 0;
  const skillLevel = Math.max(0, Math.min(20, Math.round(t * SKILL_REGIME_MAX_LEVEL)));
  const depthSpan = SKILL_REGIME_MAX_DEPTH - SKILL_REGIME_MIN_DEPTH;
  const depthCap = Math.max(
    SKILL_REGIME_MIN_DEPTH,
    Math.min(SKILL_REGIME_MAX_DEPTH, SKILL_REGIME_MIN_DEPTH + Math.round(t * depthSpan))
  );
  return { regime: 'skill', skillLevel, depthCap };
}

export function createMirrorOpponent(
  styleVector: StyleVector,
  defaults: MirrorOpponentOptions = {}
): MirrorOpponentProvider {
  let configured = false;
  let activeRegime: MirrorEngineRegime | null = null;

  async function configureEngine(): Promise<void> {
    if (configured) return;
    await waitForEngine();
    const regime = mirrorEngineRegimeFor(styleVector.detected_elo);
    if (regime.regime === 'uci-limit') {
      await setOption('UCI_LimitStrength', true);
      await setOption('UCI_Elo', regime.uciElo);
    } else {
      // Sub-1320: turn UCI_LimitStrength off so Skill Level governs play.
      await setOption('UCI_LimitStrength', false);
      await setOption('Skill Level', regime.skillLevel);
    }
    activeRegime = regime;
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
      const requestedDepth = options.depth ?? defaults.depth ?? DEFAULT_DEPTH;
      const depth =
        activeRegime?.regime === 'skill'
          ? Math.min(requestedDepth, activeRegime.depthCap)
          : requestedDepth;
      const timeoutMs = options.timeoutMs ?? defaults.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const candidates = await getCandidateMoves(fen, multipv, depth, timeoutMs);
      const ranked = rankMirrorCandidates(fen, candidates, styleVector);

      if (ranked[0]) {
        const trace = buildMirrorDecisionTrace(ranked);
        return {
          move: ranked[0].move,
          trace,
          candidates: ranked,
        };
      }

      const fallback = await getBestMove(fen, depth, timeoutMs);
      return { move: fallback, trace: null, candidates: [] };
    },

    dispose() {
      configured = false;
      activeRegime = null;
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
    .map((candidate, index) => {
      const move = legalByUci.get(candidate.move);
      if (!move) return null;

      const style = styleBiasForMove(fen, move, vector);
      const engineScore = scoreCandidate(candidate);
      const totalScore = engineScore + style.bias;

      return {
        move: candidate.move,
        san: move.san,
        engineRank: candidate.multipv || index + 1,
        engineScore,
        styleBias: style.bias,
        totalScore,
        reason: style.reason,
        styleDimension: style.dimension,
        tendency: style.tendency,
        detail: style.detail,
      };
    })
    .filter((candidate): candidate is RankedMirrorCandidate => candidate !== null)
    .sort((a, b) => b.totalScore - a.totalScore || a.move.localeCompare(b.move));
}

export function buildMirrorDecisionTrace(
  rankedCandidates: RankedMirrorCandidate[]
): MirrorDecisionTrace | null {
  const chosen = rankedCandidates[0];
  if (!chosen) return null;

  const stockfishTop =
    [...rankedCandidates].sort((a, b) => a.engineRank - b.engineRank || b.engineScore - a.engineScore)[0] ??
    null;

  return {
    move: chosen.move,
    san: chosen.san,
    stockfishTopMove: stockfishTop?.move ?? null,
    stockfishTopSan: stockfishTop?.san ?? null,
    overrodeStockfish: Boolean(stockfishTop && stockfishTop.move !== chosen.move),
    styleDimension: chosen.styleDimension,
    styleBias: chosen.styleBias,
    stockfishTopEngineScore: stockfishTop?.engineScore ?? null,
    rerankedEngineScore: chosen.engineScore,
    rerankedTotalScore: chosen.totalScore,
    reason: chosen.reason,
    tendency: chosen.tendency,
    detail: chosen.detail,
  };
}

export function summarizeMirrorReranks(traces: MirrorDecisionTrace[]): MirrorRerankSummary {
  const overrides = traces.filter((trace) => trace.overrodeStockfish);
  const overridesByDimension = overrides.reduce<Partial<Record<StyleDimension, number>>>(
    (counts, trace) => ({
      ...counts,
      [trace.styleDimension]: (counts[trace.styleDimension] ?? 0) + 1,
    }),
    {}
  );

  return {
    totalMirrorMoves: traces.length,
    overrideCount: overrides.length,
    overrideRate: traces.length > 0 ? overrides.length / traces.length : 0,
    overridesByDimension,
  };
}

export function describeMirrorDecision(
  trace: MirrorDecisionTrace | null | undefined,
  moveNumber: number
): string {
  if (!trace) {
    return 'It followed the engine line because no stronger style signal appeared in the final position.';
  }

  const percent = Math.round(trace.tendency * 100);
  const topMove = trace.stockfishTopSan ?? trace.stockfishTopMove ?? 'the top engine move';
  const hasPositiveStyleDriver = trace.styleDimension !== 'engine' && trace.styleBias > 0;

  if (trace.overrodeStockfish && hasPositiveStyleDriver) {
    return `It overrode Stockfish's ${topMove} with ${trace.san} on move ${moveNumber} because ${dimensionPhrase(trace, percent)}.`;
  }

  if (trace.overrodeStockfish) {
    return `It overrode Stockfish's ${topMove} with ${trace.san} on move ${moveNumber} after reranking, but no single positive style dimension dominated that choice.`;
  }

  if (hasPositiveStyleDriver) {
    return `It kept Stockfish's ${trace.san} on move ${moveNumber}; ${dimensionPhrase(trace, percent)} confirmed the choice.`;
  }

  return `It played ${trace.san}; the engine still ranked it highest after your style was applied.`;
}

interface StyleContribution {
  dimension: StyleDimension;
  bias: number;
  reason: MirrorReason;
  tendency: number;
  detail: string;
}

function styleBiasForMove(fen: string, move: Move, vector: StyleVector): {
  bias: number;
  reason: MirrorReason;
  dimension: StyleDimension;
  tendency: number;
  detail: string;
} {
  const exchangeTendency = clamp01(vector.exchange_willingness);
  const timePressureTendency = clamp01(vector.time_pressure_blunder_rate);
  const motifTendency = average(Object.values(vector.motif_blindness));
  const aggressionTendency = derivedAggression(vector);
  const isExchange = move.isCapture();
  const isForcing = move.san.includes('+') || move.san.includes('#') || move.isPromotion();
  const probeWindow = shouldProbeWeakness(fen, vector);
  const contributions: StyleContribution[] = [];

  if (isExchange) {
    contributions.push({
      dimension: 'exchange_willingness',
      bias: (exchangeTendency - 0.5) * 90,
      reason: 'exchange',
      tendency: exchangeTendency,
      detail: 'capture or trade candidate',
    });
  }

  if (matchesOpeningRepertoire(fen, move, vector)) {
    contributions.push({
      dimension: 'opening_repertoire',
      bias: 24,
      reason: 'engine',
      tendency: 1,
      detail: 'stored opening repertoire',
    });
  }

  if (matchesPreferredMinor(move, vector)) {
    contributions.push({
      dimension: 'preferred_minor',
      bias: 10,
      reason: 'engine',
      tendency: 1,
      detail: `preferred ${vector.preferred_minor}`,
    });
  }

  if (isForcing) {
    contributions.push({
      dimension: 'aggression',
      bias: 14 + aggressionTendency * 30,
      reason: 'forcing',
      tendency: aggressionTendency,
      detail: 'forcing check, mate threat, or promotion candidate',
    });
  }

  if (probeWindow && isForcing && timePressureTendency >= 0.45) {
    contributions.push({
      dimension: 'time_pressure',
      bias: 28,
      reason: 'time_pressure_probe',
      tendency: timePressureTendency,
      detail: 'opportunistic time-pressure probe',
    });
  } else if (probeWindow && move.isCapture() && motifTendency >= 0.45) {
    contributions.push({
      dimension: 'motif_blindness',
      bias: 24,
      reason: 'motif_probe',
      tendency: motifTendency,
      detail: 'opportunistic motif-blindness probe',
    });
  }

  if (vector.swindle_preference === 'swindle' && isMessyMove(fen, move)) {
    contributions.push({
      dimension: 'swindle_preference',
      bias: 18,
      reason: 'swindle',
      tendency: 1,
      detail: 'messy forcing or material-imbalancing candidate',
    });
  }

  const bias = contributions.reduce((total, contribution) => total + contribution.bias, 0);
  const driver =
    contributions
      .filter((contribution) => contribution.bias > 0)
      .sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias))[0] ?? null;

  return {
    bias,
    reason: driver?.reason ?? 'engine',
    dimension: driver?.dimension ?? 'engine',
    tendency: driver?.tendency ?? 0.5,
    detail: driver?.detail ?? 'engine preference',
  };
}

function dimensionPhrase(trace: MirrorDecisionTrace, percent: number): string {
  if (trace.styleDimension === 'exchange_willingness') {
    return `your exchange_willingness is ${percent}%`;
  }

  if (trace.styleDimension === 'time_pressure') {
    return `your time-pressure miss rate is ${percent}%`;
  }

  if (trace.styleDimension === 'motif_blindness') {
    return `your motif_blindness signal is ${percent}%`;
  }

  if (trace.styleDimension === 'swindle_preference') {
    return 'your swindle_preference allows messy forcing lines';
  }

  if (trace.styleDimension === 'preferred_minor') {
    return `your preferred_minor signal favored ${trace.detail.replace('preferred ', '')}`;
  }

  if (trace.styleDimension === 'opening_repertoire') {
    return 'your stored opening repertoire matched that move';
  }

  if (trace.styleDimension === 'aggression') {
    return `your derived aggression signal is ${percent}%`;
  }

  return 'no stronger style signal beat the engine choice';
}

function shouldProbeWeakness(fen: string, vector: StyleVector): boolean {
  const weaknessSignal =
    average(Object.values(vector.motif_blindness)) * 0.6 +
    clamp01(vector.time_pressure_blunder_rate) * 0.4;
  if (weaknessSignal < 0.45) return false;
  return deterministicBucket(`${fen}|${vector.detected_elo}|${vector.elo_band}`) < 20;
}

function matchesOpeningRepertoire(fen: string, move: Move, vector: StyleVector): boolean {
  if (fullMoveNumberFromFen(fen) > 4) return false;

  const repertoire = move.color === 'w' ? vector.opening_white_top3 : vector.opening_black_top3;
  const moveKeys = new Set([normalizeMoveKey(move.san), normalizeMoveKey(moveToUci(move))]);
  return repertoire.some((storedMove) => moveKeys.has(normalizeMoveKey(storedMove)));
}

function matchesPreferredMinor(move: Move, vector: StyleVector): boolean {
  if (vector.preferred_minor === 'neutral') return false;
  if (vector.preferred_minor === 'knight') return move.piece === 'n';
  return move.piece === 'b';
}

function derivedAggression(vector: StyleVector): number {
  const swindle = vector.swindle_preference === 'swindle' ? 0.75 : 0.35;
  return clamp01(swindle * 0.45 + vector.exchange_willingness * 0.25 + vector.time_pressure_blunder_rate * 0.3);
}

function fullMoveNumberFromFen(fen: string): number {
  const fullMove = Number(fen.split(/\s+/)[5]);
  return Number.isFinite(fullMove) ? fullMove : 1;
}

function normalizeMoveKey(move: string): string {
  return move
    .toLowerCase()
    .replace(/\.+/g, '')
    .replace(/[+#?!]/g, '')
    .trim();
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

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + clamp01(value), 0) / values.length;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
