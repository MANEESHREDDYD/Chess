import { getBestMove, getCandidateMoves, setOption, waitForEngine, type EngineCandidate } from './stockfishBridge';
import type { StyleVector } from '../ml/styleVector';
import type { OpponentMoveOptions, OpponentProvider } from '../types/opponent';
import {
  rerankMirrorMoves,
  type MirrorReason,
  type RankedMirrorCandidate,
  type StyleDimension,
} from '../mirror/mirrorReranker';
import {
  formatMirrorMoveExplanation,
  type MirrorMoveExplanation,
} from '../mirror/mirrorExplanation';
import {
  normalizePersonalityMode,
  type MirrorConfidence,
  type MirrorPersonalityMode,
  type RecentPlayerWeaknessSummary,
} from '../mirror/mirrorPersonality';

const DEFAULT_MULTIPV = 5;
const DEFAULT_DEPTH = 8;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_STOCKFISH_SKILL_LEVEL = 20;

// Two-regime base-strength selection (see docs/m3-report.md).
//
// Stockfish's UCI_LimitStrength can only set UCI_Elo within [1320, 3190].
// For detected_elo below 1320 we fall back to Skill Level plus a depth cap.
// Mirror 2.0 still uses this stable engine base; personality only reranks
// legal Stockfish candidates after the engine search returns.
const STOCKFISH_UCI_MIN_ELO = 1320;
const STOCKFISH_UCI_MAX_ELO = 3190;
const DETECTED_ELO_FLOOR = 800;
const SKILL_REGIME_MIN_DEPTH = 2;
const SKILL_REGIME_MAX_DEPTH = 6;
const SKILL_REGIME_MAX_LEVEL = 10;

export type { MirrorReason, RankedMirrorCandidate, StyleDimension };
export type { MirrorMoveExplanation, MirrorPersonalityMode, MirrorConfidence };

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
  personalityMode?: MirrorPersonalityMode;
  cpLossFromBest?: number;
  confidence?: MirrorConfidence;
  evidence?: string[];
  explanation?: MirrorMoveExplanation | null;
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
  personalityMode?: MirrorPersonalityMode;
}

export type MirrorMoveOptions = OpponentMoveOptions & {
  personalityMode?: MirrorPersonalityMode | string;
  styleVectorOverride?: StyleVector | null;
  recentWeaknessSummary?: RecentPlayerWeaknessSummary;
  seed?: string;
};

export interface MirrorOpponentProvider extends OpponentProvider {
  getMoveWithTrace(fen: string, options?: MirrorMoveOptions): Promise<MirrorMoveResult>;
}

export type MirrorEngineRegime =
  | { regime: 'uci-limit'; uciElo: number }
  | { regime: 'skill'; skillLevel: number; depthCap: number };

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
      await setOption('UCI_LimitStrength', false);
      await setOption('Skill Level', regime.skillLevel);
    }
    activeRegime = regime;
    configured = true;
  }

  return {
    id: 'mirror-stockfish-personality-rerank',

    async getMove(fen, options) {
      const result = await this.getMoveWithTrace(fen, options);
      return result.move;
    },

    async getMoveWithTrace(fen, options = {}) {
      await configureEngine();
      const multipv = defaults.multipv ?? DEFAULT_MULTIPV;
      const requestedDepth = searchDepth(options.depth ?? defaults.depth, DEFAULT_DEPTH);
      const depth =
        activeRegime?.regime === 'skill'
          ? Math.min(requestedDepth, activeRegime.depthCap)
          : requestedDepth;
      const timeoutMs = options.timeoutMs ?? defaults.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const personalityMode = normalizePersonalityMode(options.personalityMode ?? defaults.personalityMode);
      const rerankStyleVector =
        options.styleVectorOverride === undefined ? styleVector : options.styleVectorOverride;
      const candidates = await getCandidateMoves(fen, multipv, depth, timeoutMs);
      const reranked = rerankMirrorMoves({
        fen,
        candidates,
        styleVector: rerankStyleVector,
        personalityMode,
        recentWeaknessSummary: options.recentWeaknessSummary,
        seed: options.seed,
      });

      if (reranked.selectedMove) {
        const trace = buildMirrorDecisionTrace(reranked.rankedCandidates, reranked.explanation);
        return {
          move: reranked.selectedMove.move,
          trace,
          candidates: reranked.rankedCandidates,
        };
      }

      const fallback = await getBestMove(fen, depth, timeoutMs);
      return { move: fallback, trace: null, candidates: [] };
    },

    dispose() {
      void setOption('UCI_LimitStrength', false);
      void setOption('Skill Level', DEFAULT_STOCKFISH_SKILL_LEVEL);
      configured = false;
      activeRegime = null;
    },
  };
}

export function rankMirrorCandidates(
  fen: string,
  candidates: EngineCandidate[],
  vector: StyleVector,
  personalityMode: MirrorPersonalityMode | string = 'current_self',
  recentWeaknessSummary?: RecentPlayerWeaknessSummary,
  seed?: string
): RankedMirrorCandidate[] {
  return rerankMirrorMoves({
    fen,
    candidates,
    styleVector: vector,
    personalityMode,
    recentWeaknessSummary,
    seed,
  }).rankedCandidates;
}

export function buildMirrorDecisionTrace(
  rankedCandidates: RankedMirrorCandidate[],
  explanation?: MirrorMoveExplanation | null
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
    personalityMode: chosen.personalityMode,
    cpLossFromBest: chosen.cpLossFromBest,
    confidence: chosen.confidence,
    evidence: explanation?.evidence ?? [],
    explanation: explanation ?? null,
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

  if (trace.explanation) {
    return formatMirrorMoveExplanation(trace.explanation, moveNumber);
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

  if (trace.styleDimension === 'king_safety') {
    return 'the personality mode prioritized king safety';
  }

  if (trace.styleDimension === 'analysis_quality') {
    return 'the personality mode reduced avoidable CP loss';
  }

  if (trace.styleDimension === 'personality_mode') {
    return `${trace.personalityMode ?? 'current_self'} mode matched the local style profile`;
  }

  return 'no stronger style signal beat the engine choice';
}

function searchDepth(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(Number(value)));
}
