import type { StyleVector } from './styleVector';
import type { MirrorDecisionTrace, StyleDimension } from '../engine/mirrorOpponent';

export type MirrorResult = 'You won' | 'Mirror won' | 'Draw' | 'Game ended';

export interface EvolvingMirrorInput {
  vector: StyleVector;
  result: MirrorResult;
  traces: MirrorDecisionTrace[];
}

export interface EvolvingMirrorUpdate {
  vector: StyleVector;
  deltaLine: string;
  dimension: StyleDimension;
}

export function sharpenMirrorVector({
  vector,
  result,
  traces,
}: EvolvingMirrorInput): EvolvingMirrorUpdate {
  const dimension = dominantDimension(traces);
  const next: StyleVector = {
    ...vector,
    opening_white_top3: [...vector.opening_white_top3],
    opening_black_top3: [...vector.opening_black_top3],
    motif_blindness: { ...vector.motif_blindness },
    detected_elo: vector.detected_elo,
  };

  if (result === 'You won') {
    shoreUpDimension(next, dimension);
  } else if (result === 'Draw') {
    deepenDimension(next, dimension, 0.015);
  } else {
    softenDimension(next, dimension);
  }

  return {
    vector: next,
    dimension,
    deltaLine: deltaLineFor(dimension, result),
  };
}

function dominantDimension(traces: MirrorDecisionTrace[]): StyleDimension {
  const counts = traces
    .filter((trace) => trace.styleDimension !== 'engine')
    .reduce<Partial<Record<StyleDimension, number>>>(
      (total, trace) => ({
        ...total,
        [trace.styleDimension]: (total[trace.styleDimension] ?? 0) + 1,
      }),
      {}
    );

  return (
    (Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] as StyleDimension | undefined) ??
    'motif_blindness'
  );
}

function shoreUpDimension(vector: StyleVector, dimension: StyleDimension): void {
  if (dimension === 'exchange_willingness') {
    vector.exchange_willingness = stepToward(vector.exchange_willingness, 0.5, 0.04);
    return;
  }

  if (dimension === 'time_pressure') {
    vector.time_pressure_blunder_rate = clamp01(vector.time_pressure_blunder_rate - 0.04);
    return;
  }

  if (dimension === 'motif_blindness') {
    Object.keys(vector.motif_blindness).forEach((motif) => {
      vector.motif_blindness[motif as keyof typeof vector.motif_blindness] = clamp01(
        vector.motif_blindness[motif as keyof typeof vector.motif_blindness] - 0.035
      );
    });
    return;
  }

  if (dimension === 'aggression' || dimension === 'swindle_preference') {
    vector.time_pressure_blunder_rate = clamp01(vector.time_pressure_blunder_rate - 0.025);
    vector.exchange_willingness = stepToward(vector.exchange_willingness, 0.5, 0.02);
    return;
  }

  if (dimension === 'opening_repertoire' && vector.opening_black_top3.length > 1) {
    vector.opening_black_top3 = vector.opening_black_top3.slice(0, 2);
  }
}

function deepenDimension(vector: StyleVector, dimension: StyleDimension, amount: number): void {
  if (dimension === 'exchange_willingness') {
    vector.exchange_willingness = clamp01(vector.exchange_willingness + amount);
  }

  if (dimension === 'time_pressure') {
    vector.time_pressure_blunder_rate = clamp01(vector.time_pressure_blunder_rate - amount);
  }

  if (dimension === 'motif_blindness') {
    Object.keys(vector.motif_blindness).forEach((motif) => {
      vector.motif_blindness[motif as keyof typeof vector.motif_blindness] = clamp01(
        vector.motif_blindness[motif as keyof typeof vector.motif_blindness] - amount
      );
    });
  }
}

function softenDimension(vector: StyleVector, dimension: StyleDimension): void {
  if (dimension === 'aggression' || dimension === 'swindle_preference') {
    vector.time_pressure_blunder_rate = clamp01(vector.time_pressure_blunder_rate + 0.01);
  }
}

function deltaLineFor(dimension: StyleDimension, result: MirrorResult): string {
  if (dimension === 'exchange_willingness') {
    return 'Your Mirror has studied that game. It will not accept that trade so easily again.';
  }

  if (dimension === 'time_pressure') {
    return 'Your Mirror has studied that game. It will press the clock with a steadier hand.';
  }

  if (dimension === 'motif_blindness') {
    return 'Your Mirror has studied that game. One old tactical wound has closed a little.';
  }

  if (dimension === 'opening_repertoire') {
    return 'Your Mirror has studied that game. It remembers the opening road more narrowly now.';
  }

  if (dimension === 'preferred_minor') {
    return 'Your Mirror has studied that game. The minor-piece preference is a little sharper.';
  }

  if (result === 'Mirror won') {
    return 'Your Mirror has studied that game. It will not grow stronger from an easy win.';
  }

  return 'Your Mirror has studied that game. Its attacks will spend themselves a little less freely.';
}

function stepToward(value: number, target: number, step: number): number {
  if (value < target) return clamp01(Math.min(target, value + step));
  return clamp01(Math.max(target, value - step));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
