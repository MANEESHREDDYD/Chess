import type { Motif, PreferredMinor, StyleVector } from '../ml/styleVector';

export type MirrorPersonalityMode =
  | 'current_self'
  | 'past_self'
  | 'aggressive_self'
  | 'cautious_self'
  | 'blunder_prone_self'
  | 'improved_self';

export type MirrorConfidence = 'low' | 'medium' | 'high';

export interface RecentPlayerWeaknessSummary {
  weakestMotif?: string | null;
  strongestMotif?: string | null;
  averageCpLoss?: number | null;
  blunderCount?: number | null;
  feedbackTags?: string[];
}

export interface StyleVectorSignals {
  aggressionIndex: number;
  riskIndex: number;
  exchangePreference: number;
  timePressureRisk: number;
  motifWeaknessAverage: number;
  weakestMotif: Motif | null;
  strongestMotif: Motif | null;
  preferredMinor: PreferredMinor;
  openingSignalStrength: number;
  insufficientData: boolean;
  evidence: string[];
}

export interface MirrorPersonalityProfile {
  mode: MirrorPersonalityMode;
  label: string;
  summary: string;
  engineWeight: number;
  cpLossWeight: number;
  styleSimilarityWeight: number;
  captureWeight: number;
  checkWeight: number;
  castleWeight: number;
  queenEarlyPenalty: number;
  riskWeight: number;
  safetyWeight: number;
  weaknessWeight: number;
  openingWeight: number;
  preferredMinorWeight: number;
  drawishPenalty: number;
  maxCpLoss: number;
  controlledWeaknessCp: number;
  variationCp: number;
}

export const MIRROR_PERSONALITY_MODES: MirrorPersonalityMode[] = [
  'current_self',
  'past_self',
  'aggressive_self',
  'cautious_self',
  'blunder_prone_self',
  'improved_self',
];

export const MIRROR_PERSONALITY_LABELS: Record<MirrorPersonalityMode, string> = {
  current_self: 'Current self',
  past_self: 'Past self',
  aggressive_self: 'Aggressive self',
  cautious_self: 'Cautious self',
  blunder_prone_self: 'Blunder-prone self',
  improved_self: 'Improved self',
};

export function normalizePersonalityMode(value: unknown): MirrorPersonalityMode {
  return MIRROR_PERSONALITY_MODES.includes(value as MirrorPersonalityMode)
    ? (value as MirrorPersonalityMode)
    : 'current_self';
}

export function deriveStyleVectorSignals(vector: StyleVector | null | undefined): StyleVectorSignals {
  if (!vector) {
    return {
      aggressionIndex: 0.5,
      riskIndex: 0.5,
      exchangePreference: 0.5,
      timePressureRisk: 0.5,
      motifWeaknessAverage: 0.5,
      weakestMotif: null,
      strongestMotif: null,
      preferredMinor: 'neutral',
      openingSignalStrength: 0,
      insufficientData: true,
      evidence: ['No StyleVector is available; Mirror falls back to safe engine-first behavior.'],
    };
  }

  const motifEntries = Object.entries(vector.motif_blindness ?? {}) as Array<[Motif, number]>;
  const safeMotifs = motifEntries.map(([motif, value]) => [motif, clamp01(value)] as const);
  const weakestMotif = safeMotifs.length > 0
    ? [...safeMotifs].sort((a, b) => b[1] - a[1])[0][0]
    : null;
  const strongestMotif = safeMotifs.length > 0
    ? [...safeMotifs].sort((a, b) => a[1] - b[1])[0][0]
    : null;
  const motifWeaknessAverage = safeMotifs.length > 0
    ? safeMotifs.reduce((total, [, value]) => total + value, 0) / safeMotifs.length
    : 0.5;
  const exchangePreference = clamp01(vector.exchange_willingness);
  const timePressureRisk = clamp01(vector.time_pressure_blunder_rate);
  const swindleSignal = vector.swindle_preference === 'swindle' ? 0.78 : 0.32;
  const endgameGap = 1 - clamp01(vector.endgame_strength);
  const aggressionIndex = clamp01(
    exchangePreference * 0.38 +
      swindleSignal * 0.24 +
      timePressureRisk * 0.18 +
      endgameGap * 0.2
  );
  const riskIndex = clamp01(timePressureRisk * 0.46 + motifWeaknessAverage * 0.32 + swindleSignal * 0.22);
  const openingSignalStrength = clamp01(
    ((vector.opening_white_top3?.length ?? 0) + (vector.opening_black_top3?.length ?? 0)) / 6
  );

  const evidence = [
    `exchange_willingness=${roundPercent(exchangePreference)}`,
    `time_pressure_blunder_rate=${roundPercent(timePressureRisk)}`,
    weakestMotif ? `weakest_motif=${weakestMotif}` : null,
    strongestMotif ? `strongest_motif=${strongestMotif}` : null,
    `preferred_minor=${vector.preferred_minor}`,
    `detected_elo=${Math.round(finiteNumber(vector.detected_elo, 0))}`,
  ].filter((entry): entry is string => Boolean(entry));

  const insufficientData =
    openingSignalStrength === 0 &&
    safeMotifs.every(([, value]) => value >= 0.95) &&
    vector.avg_move_time_ms <= 0;

  return {
    aggressionIndex,
    riskIndex,
    exchangePreference,
    timePressureRisk,
    motifWeaknessAverage,
    weakestMotif,
    strongestMotif,
    preferredMinor: vector.preferred_minor,
    openingSignalStrength,
    insufficientData,
    evidence,
  };
}

export function personalityProfileFor(
  mode: MirrorPersonalityMode,
  vector: StyleVector | null | undefined,
  weaknessSummary?: RecentPlayerWeaknessSummary
): MirrorPersonalityProfile {
  const signals = deriveStyleVectorSignals(vector);
  const recentBlunderPressure = clamp01((weaknessSummary?.blunderCount ?? 0) / 6);
  const risk = clamp01(signals.riskIndex + recentBlunderPressure * 0.12);
  const aggression = signals.aggressionIndex;
  const exchange = signals.exchangePreference;

  if (mode === 'aggressive_self') {
    return {
      mode,
      label: MIRROR_PERSONALITY_LABELS[mode],
      summary: 'Favors captures, checks, forcing moves, and controlled pressure when the engine window is safe.',
      engineWeight: 0.9,
      cpLossWeight: 0.34,
      styleSimilarityWeight: 0.78,
      captureWeight: 58 + exchange * 46,
      checkWeight: 54 + aggression * 48,
      castleWeight: 4,
      queenEarlyPenalty: -10,
      riskWeight: 28 + risk * 26,
      safetyWeight: 6,
      weaknessWeight: 10,
      openingWeight: 20,
      preferredMinorWeight: 12,
      drawishPenalty: 28,
      maxCpLoss: 145,
      controlledWeaknessCp: 0,
      variationCp: 2,
    };
  }

  if (mode === 'past_self') {
    return {
      mode,
      label: MIRROR_PERSONALITY_LABELS[mode],
      summary: 'Uses an older local StyleVector when available, preserving prior habits inside a playable CP window.',
      engineWeight: 0.92,
      cpLossWeight: 0.38,
      styleSimilarityWeight: 0.92,
      captureWeight: (exchange - 0.5) * 86,
      checkWeight: 14 + aggression * 32,
      castleWeight: 8,
      queenEarlyPenalty: 12,
      riskWeight: (risk - 0.45) * 42,
      safetyWeight: 8,
      weaknessWeight: signals.motifWeaknessAverage * 30,
      openingWeight: 26,
      preferredMinorWeight: 12,
      drawishPenalty: 16,
      maxCpLoss: 150,
      controlledWeaknessCp: 0,
      variationCp: 1,
    };
  }

  if (mode === 'cautious_self') {
    return {
      mode,
      label: MIRROR_PERSONALITY_LABELS[mode],
      summary: 'Keeps the user profile but prefers safer king, lower risk, and fewer speculative exchanges.',
      engineWeight: 1.08,
      cpLossWeight: 0.62,
      styleSimilarityWeight: 0.62,
      captureWeight: (exchange - 0.55) * 38,
      checkWeight: 12 + aggression * 20,
      castleWeight: 42,
      queenEarlyPenalty: 42,
      riskWeight: -64,
      safetyWeight: 48,
      weaknessWeight: -12,
      openingWeight: 18,
      preferredMinorWeight: 10,
      drawishPenalty: 10,
      maxCpLoss: 110,
      controlledWeaknessCp: 0,
      variationCp: 1,
    };
  }

  if (mode === 'blunder_prone_self') {
    return {
      mode,
      label: MIRROR_PERSONALITY_LABELS[mode],
      summary: 'Shows a controlled version of the user weakness profile without leaving the legal candidate set.',
      engineWeight: 0.72,
      cpLossWeight: 0.16,
      styleSimilarityWeight: 0.76,
      captureWeight: 26 + exchange * 34,
      checkWeight: 22 + aggression * 30,
      castleWeight: -8,
      queenEarlyPenalty: -16,
      riskWeight: 42 + risk * 34,
      safetyWeight: -12,
      weaknessWeight: 52 + signals.motifWeaknessAverage * 34,
      openingWeight: 8,
      preferredMinorWeight: 6,
      drawishPenalty: 18,
      maxCpLoss: 220,
      controlledWeaknessCp: 220,
      variationCp: 2,
    };
  }

  if (mode === 'improved_self') {
    return {
      mode,
      label: MIRROR_PERSONALITY_LABELS[mode],
      summary: 'Keeps the recognizable style signal while lowering CP loss and avoiding known weakness traps.',
      engineWeight: 1.18,
      cpLossWeight: 1.04,
      styleSimilarityWeight: 0.46,
      captureWeight: (exchange - 0.45) * 32,
      checkWeight: 12 + aggression * 18,
      castleWeight: 32,
      queenEarlyPenalty: 52,
      riskWeight: -58,
      safetyWeight: 46,
      weaknessWeight: -48,
      openingWeight: 20,
      preferredMinorWeight: 8,
      drawishPenalty: 12,
      maxCpLoss: 55,
      controlledWeaknessCp: 0,
      variationCp: 0,
    };
  }

  return {
    mode,
    label: MIRROR_PERSONALITY_LABELS.current_self,
    summary: 'Closest to the raw StyleVector while staying inside a safe Stockfish candidate window.',
    engineWeight: 1,
    cpLossWeight: 0.45,
    styleSimilarityWeight: 0.88,
    captureWeight: (exchange - 0.5) * 90,
    checkWeight: 16 + aggression * 34,
    castleWeight: 12,
    queenEarlyPenalty: 18,
    riskWeight: (risk - 0.5) * 36,
    safetyWeight: 12,
    weaknessWeight: signals.motifWeaknessAverage * 24,
    openingWeight: 24,
    preferredMinorWeight: 10,
    drawishPenalty: 18,
    maxCpLoss: 135,
    controlledWeaknessCp: 0,
    variationCp: 1,
  };
}

function roundPercent(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function finiteNumber(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, finiteNumber(value, 0)));
}
