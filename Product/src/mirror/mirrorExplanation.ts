import type { MirrorPersonalityMode, MirrorConfidence, MirrorPersonalityProfile, StyleVectorSignals } from './mirrorPersonality';
import type { RankedMirrorCandidate } from './mirrorReranker';

export interface MirrorMoveExplanation {
  selected_move: string | null;
  personality_mode: MirrorPersonalityMode;
  style_reasons: string[];
  engine_reasons: string[];
  weakness_reasons: string[];
  confidence: MirrorConfidence;
  evidence: string[];
  insufficient_data: boolean;
  summary: string;
}

export interface BuildMirrorMoveExplanationInput {
  selected: RankedMirrorCandidate | null;
  stockfishTop: RankedMirrorCandidate | null;
  profile: MirrorPersonalityProfile;
  signals: StyleVectorSignals;
}

export function buildMirrorMoveExplanation({
  selected,
  stockfishTop,
  profile,
  signals,
}: BuildMirrorMoveExplanationInput): MirrorMoveExplanation {
  if (!selected) {
    return {
      selected_move: null,
      personality_mode: profile.mode,
      style_reasons: [],
      engine_reasons: ['No legal Stockfish candidate was available for Mirror reranking.'],
      weakness_reasons: [],
      confidence: 'low',
      evidence: signals.evidence,
      insufficient_data: true,
      summary: 'Mirror could not build a personalized move because no legal candidate was available.',
    };
  }

  const styleReasons = selected.explanationSignals.filter((signal) => signal.kind === 'style').map((signal) => signal.text);
  const engineReasons = selected.explanationSignals.filter((signal) => signal.kind === 'engine').map((signal) => signal.text);
  const weaknessReasons = selected.explanationSignals
    .filter((signal) => signal.kind === 'weakness')
    .map((signal) => signal.text);

  if (styleReasons.length === 0 && !signals.insufficientData) {
    styleReasons.push(`${profile.label} kept the move close to the available StyleVector profile.`);
  }

  if (signals.insufficientData) {
    styleReasons.push('Insufficient StyleVector evidence; Mirror weighted Stockfish safety more heavily.');
  }

  const selectedCpLoss = Math.round(selected.cpLossFromBest);
  const topMove = stockfishTop?.san ?? stockfishTop?.move ?? 'the top Stockfish move';
  const summary = selected.overrodeStockfish
    ? `Mirror chose ${selected.san} over ${topMove} because ${profile.label} valued ${selected.detail}.`
    : `Mirror chose ${selected.san}; it remained aligned with the top Stockfish candidate after ${profile.label} reranking.`;

  const evidence = [
    ...signals.evidence,
    `candidate=${selected.move}`,
    `cp_loss_from_best=${selectedCpLoss}`,
    `personality_mode=${profile.mode}`,
    selected.sourceWindow,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    selected_move: selected.move,
    personality_mode: profile.mode,
    style_reasons: unique(styleReasons),
    engine_reasons: unique([
      ...engineReasons,
      `Stockfish candidate rank ${selected.engineRank}; CP loss from candidate best is ${selectedCpLoss}.`,
    ]),
    weakness_reasons: unique(weaknessReasons),
    confidence: selected.confidence,
    evidence: unique(evidence),
    insufficient_data: signals.insufficientData,
    summary,
  };
}

export function formatMirrorMoveExplanation(
  explanation: MirrorMoveExplanation | null | undefined,
  moveNumber: number
): string {
  if (!explanation?.selected_move) {
    return 'Mirror followed the engine fallback because no personalized candidate explanation was available.';
  }

  const confidence = explanation.confidence.toUpperCase();
  const evidence = explanation.evidence.slice(0, 3).join('; ');
  const reason =
    explanation.style_reasons[0] ??
    explanation.engine_reasons[0] ??
    explanation.weakness_reasons[0] ??
    'the available candidate evidence supported it';

  return `${explanation.summary} Move ${moveNumber}. Confidence: ${confidence}. Evidence: ${evidence || reason}.`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
