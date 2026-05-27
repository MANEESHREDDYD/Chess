import { computeDetectedElo } from '../lib/eloDetect';

export { eloBandFromRating } from '../lib/eloDetect';

export const STYLE_VECTOR_SCHEMA_VERSION = 1;

export const MOTIFS = ['fork', 'pin', 'skewer', 'removing_the_defender'] as const;

export type Motif = (typeof MOTIFS)[number];
export type EloBand = 'apprentice' | 'initiate' | 'adept' | 'master';
export type PreferredMinor = 'knight' | 'bishop' | 'neutral';
export type SwindlePreference = 'principled' | 'swindle' | null;
export type EndgameOutcome = 'full' | 'partial' | 'none';
export type VyasaResult = 'win' | 'draw' | 'loss' | 'abandoned';

export interface StyleVector {
  opening_white_top3: string[];
  opening_black_top3: string[];
  avg_move_time_ms: number;
  time_pressure_blunder_rate: number;
  exchange_willingness: number;
  preferred_minor: PreferredMinor;
  motif_blindness: Record<Motif, number>;
  endgame_strength: number;
  swindle_preference: SwindlePreference;
  detected_elo: number;
  elo_band: EloBand;
  schema_version: 1;
}

export interface TacticalAttempt {
  motif: Motif;
  correct?: boolean | null;
  timed_out?: boolean | null;
}

export interface TacticalTaskOutput {
  attempts?: TacticalAttempt[];
  correct_count?: number | null;
  total_count?: number | null;
  motif_blindness?: Partial<Record<Motif, number | null>>;
  time_pressure_blunder_rate?: number | null;
}

export interface ExchangeChoice {
  decision: 'accept' | 'decline';
  kept_minor?: PreferredMinor;
}

export interface CalibrationRunData {
  task1?: TacticalTaskOutput;
  task2?: {
    selected_move?: string | null;
  };
  task3?: {
    outcome?: EndgameOutcome | null;
    score?: number | null;
  };
  task4?: TacticalTaskOutput;
  task5?: {
    choice?: SwindlePreference;
  };
  task6?: {
    selected_replies?: Array<string | null>;
  };
  task7?: {
    choices?: ExchangeChoice[];
  };
  task8?: {
    result?: VyasaResult | null;
    avg_cp_loss?: number | null;
    avg_move_time_ms?: number | null;
  };
}

export function computeStyleVector(data: CalibrationRunData): StyleVector {
  const endgameStrength = computeEndgameStrength(data.task3);
  const detectedElo = computeDetectedElo(data);

  return {
    opening_white_top3: compactTopMoves([data.task2?.selected_move]),
    opening_black_top3: compactTopMoves(data.task6?.selected_replies ?? []),
    avg_move_time_ms: nonNegativeNumber(data.task8?.avg_move_time_ms, 0),
    time_pressure_blunder_rate: computeTimePressureBlunderRate(data.task4),
    exchange_willingness: computeExchangeWillingness(data.task7?.choices),
    preferred_minor: computePreferredMinor(data.task7?.choices),
    motif_blindness: computeMotifBlindness(data.task1, data.task4),
    endgame_strength: endgameStrength,
    swindle_preference: validSwindlePreference(data.task5?.choice),
    detected_elo: detectedElo.detected_elo,
    elo_band: detectedElo.elo_band,
    schema_version: STYLE_VECTOR_SCHEMA_VERSION,
  };
}

function computeTimePressureBlunderRate(task4: TacticalTaskOutput | undefined): number {
  const explicitRate = finiteNumberOrNull(task4?.time_pressure_blunder_rate);
  if (explicitRate !== null) return clamp01(explicitRate);

  const attempts = task4?.attempts ?? [];
  if (attempts.length === 0) return 1;

  const misses = attempts.filter((attempt) => !attempt.correct || attempt.timed_out).length;
  return clamp01(misses / attempts.length);
}

function computeMotifBlindness(
  task1: TacticalTaskOutput | undefined,
  task4: TacticalTaskOutput | undefined
): Record<Motif, number> {
  return MOTIFS.reduce(
    (blindness, motif) => ({
      ...blindness,
      [motif]: motifBlindnessFor(motif, task1, task4),
    }),
    {} as Record<Motif, number>
  );
}

function motifBlindnessFor(
  motif: Motif,
  task1: TacticalTaskOutput | undefined,
  task4: TacticalTaskOutput | undefined
): number {
  const explicitRates = [task1?.motif_blindness?.[motif], task4?.motif_blindness?.[motif]]
    .map(finiteNumberOrNull)
    .filter((value): value is number => value !== null);

  if (explicitRates.length > 0) {
    return clamp01(average(explicitRates));
  }

  const attempts = [...(task1?.attempts ?? []), ...(task4?.attempts ?? [])].filter(
    (attempt) => attempt.motif === motif
  );
  if (attempts.length === 0) return 1;

  const misses = attempts.filter((attempt) => !attempt.correct || attempt.timed_out).length;
  return clamp01(misses / attempts.length);
}

function computeEndgameStrength(task3: CalibrationRunData['task3']): number {
  const explicitScore = finiteNumberOrNull(task3?.score);
  if (explicitScore !== null) return clamp01(explicitScore);

  if (task3?.outcome === 'full') return 1;
  if (task3?.outcome === 'partial') return 0.5;
  return 0;
}

function computeExchangeWillingness(choices: ExchangeChoice[] | undefined): number {
  if (!choices || choices.length === 0) return 0.5;
  const accepted = choices.filter((choice) => choice.decision === 'accept').length;
  return clamp01(accepted / choices.length);
}

function computePreferredMinor(choices: ExchangeChoice[] | undefined): PreferredMinor {
  const kept = (choices ?? []).map((choice) => choice.kept_minor).filter(isMinorPreference);
  const knightCount = kept.filter((minor) => minor === 'knight').length;
  const bishopCount = kept.filter((minor) => minor === 'bishop').length;

  if (knightCount > bishopCount) return 'knight';
  if (bishopCount > knightCount) return 'bishop';
  return 'neutral';
}

function compactTopMoves(moves: Array<string | null | undefined>): string[] {
  return moves.filter((move): move is string => typeof move === 'string' && move.length > 0).slice(0, 3);
}

function validSwindlePreference(value: SwindlePreference | undefined): SwindlePreference {
  return value === 'principled' || value === 'swindle' ? value : null;
}

function isMinorPreference(value: PreferredMinor | undefined): value is PreferredMinor {
  return value === 'knight' || value === 'bishop';
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function nonNegativeNumber(value: number | null | undefined, fallback: number): number {
  return Math.max(0, finiteNumber(value, fallback));
}

function finiteNumberOrNull(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Number(value) : null;
}

function finiteNumber(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
