import type { StyleVector } from '../../ml/styleVector';
import type { MirrorDecisionTrace } from '../../engine/mirrorOpponent';

export interface SelfRecognitionOption {
  id: string;
  label: string;
  lines: string[];
}

export interface SelfRecognitionChallenge {
  correctOptionId: string;
  options: SelfRecognitionOption[];
}

export function buildSelfRecognitionChallenge(
  vector: StyleVector,
  traces: MirrorDecisionTrace[],
  seed: string
): SelfRecognitionChallenge {
  const real: SelfRecognitionOption = {
    id: 'real',
    label: 'Line A',
    lines: realLines(traces),
  };
  const cautious: SelfRecognitionOption = {
    id: 'cautious-decoy',
    label: 'Line B',
    lines: vectorLines(perturbVector(vector, 'cautious')),
  };
  const opposite: SelfRecognitionOption = {
    id: 'opposite-decoy',
    label: 'Line C',
    lines: vectorLines(perturbVector(vector, 'opposite')),
  };
  const options = seededShuffle([real, cautious, opposite], seed).map((option, index) => ({
    ...option,
    label: `Line ${String.fromCharCode(65 + index)}`,
  }));

  return {
    correctOptionId: 'real',
    options,
  };
}

function realLines(traces: MirrorDecisionTrace[]): string[] {
  const meaningful = traces
    .filter((trace) => trace.styleDimension !== 'engine')
    .slice(0, 3)
    .map(
      (trace) =>
        `${trace.san}: ${trace.overrodeStockfish ? 'overrode' : 'confirmed'} ${trace.stockfishTopSan ?? trace.stockfishTopMove ?? 'Stockfish'} through ${humanDimension(trace.styleDimension)}.`
    );

  if (meaningful.length > 0) return meaningful;

  return [
    'Stayed close to Stockfish because no strong style signal dominated.',
    'Chose solid continuations over personality-driven reranks.',
    'Kept the game mostly technical.',
  ];
}

function vectorLines(vector: StyleVector): string[] {
  const lines = [
    vector.exchange_willingness >= 0.65
      ? 'Accepted most equal trades.'
      : vector.exchange_willingness <= 0.35
        ? 'Avoided most equal trades.'
        : 'Traded only when the position stayed clear.',
    vector.time_pressure_blunder_rate >= 0.6
      ? 'Created forcing moments when the clock would matter.'
      : 'Kept the pace steady instead of forcing clock chaos.',
    average(Object.values(vector.motif_blindness)) >= 0.6
      ? 'Looked for tactical blind spots.'
      : 'Played around tactics more than traps.',
  ];

  if (vector.swindle_preference === 'swindle') {
    lines.push('Allowed messy counterplay when the board invited it.');
  } else if (vector.swindle_preference === 'principled') {
    lines.push('Preferred the clean line over the trap.');
  }

  return lines.slice(0, 3);
}

function perturbVector(vector: StyleVector, mode: 'cautious' | 'opposite'): StyleVector {
  if (mode === 'cautious') {
    return {
      ...vector,
      exchange_willingness: clamp01(vector.exchange_willingness * 0.45),
      time_pressure_blunder_rate: clamp01(vector.time_pressure_blunder_rate * 0.45),
      swindle_preference: 'principled',
    };
  }

  return {
    ...vector,
    exchange_willingness: 1 - vector.exchange_willingness,
    time_pressure_blunder_rate: 1 - vector.time_pressure_blunder_rate,
    motif_blindness: Object.fromEntries(
      Object.entries(vector.motif_blindness).map(([motif, value]) => [motif, 1 - value])
    ) as StyleVector['motif_blindness'],
    swindle_preference: vector.swindle_preference === 'swindle' ? 'principled' : 'swindle',
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const copy = [...items];
  let state = hashSeed(seed);
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    const swapIndex = Math.abs(state) % (index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash;
}

function humanDimension(dimension: MirrorDecisionTrace['styleDimension']): string {
  return dimension.replace(/_/g, ' ');
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
