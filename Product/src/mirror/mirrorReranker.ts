import type { EngineCandidate } from '../engine/stockfishBridge';
import type { StyleVector } from '../ml/styleVector';
import {
  detectGamePhase,
  extractCandidateMoveFeatures,
  type CandidateMoveFeatures,
  type GamePhase,
} from './moveFeatureExtractor';
import {
  deriveStyleVectorSignals,
  normalizePersonalityMode,
  personalityProfileFor,
  type MirrorConfidence,
  type MirrorPersonalityMode,
  type MirrorPersonalityProfile,
  type RecentPlayerWeaknessSummary,
  type StyleVectorSignals,
} from './mirrorPersonality';
import { buildMirrorMoveExplanation, type MirrorMoveExplanation } from './mirrorExplanation';

export type MirrorReason =
  | 'engine'
  | 'exchange'
  | 'forcing'
  | 'time_pressure_probe'
  | 'motif_probe'
  | 'swindle'
  | 'personality'
  | 'safety'
  | 'improvement';

export type StyleDimension =
  | 'engine'
  | 'exchange_willingness'
  | 'preferred_minor'
  | 'opening_repertoire'
  | 'aggression'
  | 'time_pressure'
  | 'motif_blindness'
  | 'swindle_preference'
  | 'personality_mode'
  | 'king_safety'
  | 'analysis_quality';

export interface MirrorExplanationSignal {
  kind: 'style' | 'engine' | 'weakness';
  text: string;
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
  cpLossFromBest: number;
  confidence: MirrorConfidence;
  overrodeStockfish: boolean;
  personalityMode: MirrorPersonalityMode;
  features: CandidateMoveFeatures;
  explanationSignals: MirrorExplanationSignal[];
  sourceWindow: string;
}

export interface MirrorRerankResult {
  selectedMove: RankedMirrorCandidate | null;
  rankedCandidates: RankedMirrorCandidate[];
  stockfishTop: RankedMirrorCandidate | null;
  explanation: MirrorMoveExplanation;
  profile: MirrorPersonalityProfile;
  signals: StyleVectorSignals;
}

export interface MirrorRerankInput {
  fen: string;
  candidates: EngineCandidate[];
  styleVector?: StyleVector | null;
  personalityMode?: MirrorPersonalityMode | string | null;
  gamePhase?: GamePhase;
  recentWeaknessSummary?: RecentPlayerWeaknessSummary;
  seed?: string;
}

interface Contribution {
  score: number;
  reason: MirrorReason;
  dimension: StyleDimension;
  tendency: number;
  detail: string;
  signal: MirrorExplanationSignal;
}

export function rerankMirrorMoves(input: MirrorRerankInput): MirrorRerankResult {
  const mode = normalizePersonalityMode(input.personalityMode);
  const signals = deriveStyleVectorSignals(input.styleVector);
  const profile = personalityProfileFor(mode, input.styleVector, input.recentWeaknessSummary);
  const gamePhase = input.gamePhase ?? detectGamePhase(input.fen);
  const features = extractCandidateMoveFeatures({
    fen: input.fen,
    candidates: input.candidates,
    styleVector: input.styleVector,
  });
  const stockfishTopFeature = [...features].sort(
    (a, b) => a.engineRank - b.engineRank || b.engineScore - a.engineScore || a.move.localeCompare(b.move)
  )[0] ?? null;

  const ranked = features
    .map((candidate) =>
      scoreCandidateForProfile({
        candidate,
        profile,
        signals,
        gamePhase,
        seed: input.seed ?? input.fen,
        stockfishTopMove: stockfishTopFeature?.move ?? null,
      })
    )
    .filter((candidate) => candidate.cpLossFromBest <= profile.maxCpLoss)
    .sort(sortRankedCandidates);

  const fallbackRanked = ranked.length > 0
    ? ranked
    : features
        .map((candidate) =>
          scoreCandidateForProfile({
            candidate,
            profile,
            signals,
            gamePhase,
            seed: input.seed ?? input.fen,
            stockfishTopMove: stockfishTopFeature?.move ?? null,
          })
        )
        .sort((a, b) => a.cpLossFromBest - b.cpLossFromBest || sortRankedCandidates(a, b))
        .slice(0, 1);

  const stockfishTop = stockfishTopFeature
    ? fallbackRanked.find((candidate) => candidate.move === stockfishTopFeature.move) ??
      scoreCandidateForProfile({
        candidate: stockfishTopFeature,
        profile,
        signals,
        gamePhase,
        seed: input.seed ?? input.fen,
        stockfishTopMove: stockfishTopFeature.move,
      })
    : null;
  const selectedMove = fallbackRanked[0] ?? null;
  const explanation = buildMirrorMoveExplanation({
    selected: selectedMove,
    stockfishTop,
    profile,
    signals,
  });

  return {
    selectedMove,
    rankedCandidates: fallbackRanked,
    stockfishTop,
    explanation,
    profile,
    signals,
  };
}

function scoreCandidateForProfile({
  candidate,
  profile,
  signals,
  gamePhase,
  seed,
  stockfishTopMove,
}: {
  candidate: CandidateMoveFeatures;
  profile: MirrorPersonalityProfile;
  signals: StyleVectorSignals;
  gamePhase: GamePhase;
  seed: string;
  stockfishTopMove: string | null;
}): RankedMirrorCandidate {
  const contributions = candidateContributions(candidate, profile, signals, gamePhase);
  const styleBias = contributions.reduce((total, contribution) => total + contribution.score, 0);
  const engineComponent = candidate.engineScore * profile.engineWeight;
  const cpLossPenalty = candidate.cp_loss_from_best * profile.cpLossWeight;
  const jitter = deterministicCenteredJitter(`${seed}|${profile.mode}|${candidate.move}`, profile.variationCp);
  const totalScore = engineComponent - cpLossPenalty + styleBias + jitter;
  const driver = strongestDriver(contributions);
  const confidence = confidenceFor(candidate.cp_loss_from_best, profile, signals);

  return {
    move: candidate.move,
    san: candidate.san,
    engineRank: candidate.engineRank,
    engineScore: candidate.engineScore,
    styleBias,
    totalScore,
    reason: driver?.reason ?? 'engine',
    styleDimension: driver?.dimension ?? 'engine',
    tendency: driver?.tendency ?? 0.5,
    detail: driver?.detail ?? 'engine candidate safety',
    cpLossFromBest: candidate.cp_loss_from_best,
    confidence,
    overrodeStockfish: Boolean(stockfishTopMove && candidate.move !== stockfishTopMove),
    personalityMode: profile.mode,
    features: candidate,
    explanationSignals: [
      {
        kind: 'engine',
        text: `Stockfish supplied ${candidate.san} as candidate rank ${candidate.engineRank}.`,
      },
      ...contributions
        .filter((contribution) => Math.abs(contribution.score) >= 6)
        .map((contribution) => contribution.signal),
    ],
    sourceWindow: `safe_cp_window<=${profile.maxCpLoss}`,
  };
}

function candidateContributions(
  candidate: CandidateMoveFeatures,
  profile: MirrorPersonalityProfile,
  signals: StyleVectorSignals,
  gamePhase: GamePhase
): Contribution[] {
  const contributions: Contribution[] = [];

  if (candidate.is_capture) {
    contributions.push({
      score: profile.captureWeight,
      reason: 'exchange',
      dimension: 'exchange_willingness',
      tendency: signals.exchangePreference,
      detail: 'captures and exchanges',
      signal: {
        kind: 'style',
        text: `${profile.label} weighted captures using exchange_willingness=${roundPercent(signals.exchangePreference)}.`,
      },
    });
  }

  if (candidate.gives_check || candidate.tactical_flag) {
    const score = candidate.gives_check ? profile.checkWeight : profile.checkWeight * 0.38;
    contributions.push({
      score,
      reason: 'forcing',
      dimension: 'aggression',
      tendency: signals.aggressionIndex,
      detail: candidate.gives_check ? 'forcing checks' : 'tactical forcing pressure',
      signal: {
        kind: 'style',
        text: `${profile.label} valued forcing pressure from the candidate move.`,
      },
    });
  }

  if (candidate.is_castle) {
    contributions.push({
      score: profile.castleWeight,
      reason: 'safety',
      dimension: 'king_safety',
      tendency: 1 - signals.riskIndex,
      detail: 'king safety and development',
      signal: {
        kind: 'style',
        text: `${profile.label} applied a king-safety weight to castling.`,
      },
    });
  }

  if (candidate.queen_move_early) {
    contributions.push({
      score: -profile.queenEarlyPenalty,
      reason: profile.mode === 'blunder_prone_self' ? 'motif_probe' : 'safety',
      dimension: profile.mode === 'blunder_prone_self' ? 'motif_blindness' : 'king_safety',
      tendency: signals.riskIndex,
      detail: 'early queen movement',
      signal: {
        kind: profile.mode === 'blunder_prone_self' ? 'weakness' : 'style',
        text:
          profile.mode === 'blunder_prone_self'
            ? 'Blunder-prone mode allowed a controlled early-queen risk inside the CP window.'
            : `${profile.label} penalized early queen movement as a safety proxy.`,
      },
    });
  }

  if (candidate.opening_preference_proxy > 0) {
    contributions.push({
      score: profile.openingWeight,
      reason: 'engine',
      dimension: 'opening_repertoire',
      tendency: signals.openingSignalStrength,
      detail: 'stored opening repertoire',
      signal: {
        kind: 'style',
        text: 'The move matched the local opening repertoire stored in the StyleVector.',
      },
    });
  }

  if (signals.preferredMinor !== 'neutral' && candidate.piece_moved === minorCode(signals.preferredMinor)) {
    contributions.push({
      score: profile.preferredMinorWeight,
      reason: 'personality',
      dimension: 'preferred_minor',
      tendency: 1,
      detail: `preferred ${signals.preferredMinor}`,
      signal: {
        kind: 'style',
        text: `The candidate moved the preferred ${signals.preferredMinor}.`,
      },
    });
  }

  if (candidate.risk_proxy > 0) {
    contributions.push({
      score: profile.riskWeight * candidate.risk_proxy,
      reason: profile.mode === 'blunder_prone_self' ? 'motif_probe' : 'safety',
      dimension: profile.mode === 'improved_self' ? 'analysis_quality' : 'motif_blindness',
      tendency: signals.riskIndex,
      detail: 'risk and loose-piece proxy',
      signal: {
        kind: profile.mode === 'blunder_prone_self' ? 'weakness' : 'style',
        text:
          profile.riskWeight >= 0
            ? `${profile.label} allowed controlled risk based on local style signals.`
            : `${profile.label} reduced risk based on known weakness and safety signals.`,
      },
    });
  }

  if (candidate.king_safety_proxy !== 0) {
    contributions.push({
      score: profile.safetyWeight * candidate.king_safety_proxy,
      reason: 'safety',
      dimension: 'king_safety',
      tendency: 1 - signals.riskIndex,
      detail: 'king safety proxy',
      signal: {
        kind: 'style',
        text: `${profile.label} adjusted the score with a king-safety proxy.`,
      },
    });
  }

  if (profile.weaknessWeight !== 0 && candidate.tactical_flag) {
    const phaseMultiplier = gamePhase === 'middlegame' ? 1 : 0.72;
    contributions.push({
      score: profile.weaknessWeight * signals.motifWeaknessAverage * phaseMultiplier,
      reason: profile.weaknessWeight > 0 ? 'motif_probe' : 'improvement',
      dimension: 'motif_blindness',
      tendency: signals.motifWeaknessAverage,
      detail: signals.weakestMotif ? `${signals.weakestMotif} weakness signal` : 'tactical weakness signal',
      signal: {
        kind: 'weakness',
        text:
          profile.weaknessWeight > 0
            ? `${profile.label} probed tactical weakness inside a bounded CP window.`
            : `${profile.label} reduced known tactical weakness exposure.`,
      },
    });
  }

  if (candidate.repetition_drawish_proxy > 0) {
    contributions.push({
      score: -profile.drawishPenalty * candidate.repetition_drawish_proxy,
      reason: 'engine',
      dimension: 'analysis_quality',
      tendency: candidate.repetition_drawish_proxy,
      detail: 'drawish repetition proxy',
      signal: {
        kind: 'engine',
        text: 'The candidate was penalized for a drawish or repetition-like proxy.',
      },
    });
  }

  const similarityScore = styleSimilarity(candidate, signals, profile);
  if (similarityScore !== 0) {
    contributions.push({
      score: similarityScore,
      reason: 'personality',
      dimension: 'personality_mode',
      tendency: signals.aggressionIndex,
      detail: `${profile.label} style similarity`,
      signal: {
        kind: 'style',
        text: `${profile.label} added a style-similarity adjustment from local StyleVector signals.`,
      },
    });
  }

  return contributions;
}

function styleSimilarity(
  candidate: CandidateMoveFeatures,
  signals: StyleVectorSignals,
  profile: MirrorPersonalityProfile
): number {
  const captureFit = candidate.is_capture ? signals.exchangePreference : 1 - signals.exchangePreference;
  const forcingFit = candidate.tactical_flag ? signals.aggressionIndex : 1 - signals.aggressionIndex * 0.45;
  const safetyFit = candidate.risk_proxy > 0 ? signals.riskIndex : 1 - signals.riskIndex * 0.35;
  const rawFit = captureFit * 0.36 + forcingFit * 0.34 + safetyFit * 0.3;
  return (rawFit - 0.5) * 42 * profile.styleSimilarityWeight;
}

function strongestDriver(contributions: Contribution[]): Contribution | null {
  return (
    contributions
      .filter((contribution) => contribution.score > 10)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0] ?? null
  );
}

function confidenceFor(
  cpLossFromBest: number,
  profile: MirrorPersonalityProfile,
  signals: StyleVectorSignals
): MirrorConfidence {
  if (signals.insufficientData) return 'low';
  if (cpLossFromBest <= Math.min(45, profile.maxCpLoss * 0.45)) return 'high';
  if (cpLossFromBest <= profile.maxCpLoss) return 'medium';
  return 'low';
}

function sortRankedCandidates(a: RankedMirrorCandidate, b: RankedMirrorCandidate): number {
  return b.totalScore - a.totalScore || a.cpLossFromBest - b.cpLossFromBest || a.move.localeCompare(b.move);
}

function minorCode(preferredMinor: 'knight' | 'bishop' | 'neutral'): 'n' | 'b' | null {
  if (preferredMinor === 'knight') return 'n';
  if (preferredMinor === 'bishop') return 'b';
  return null;
}

function deterministicCenteredJitter(input: string, magnitude: number): number {
  if (magnitude <= 0) return 0;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const bucket = (hash >>> 0) % 2001;
  return ((bucket / 1000) - 1) * magnitude;
}

function roundPercent(value: number): string {
  return `${Math.round(Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)) * 100)}%`;
}
