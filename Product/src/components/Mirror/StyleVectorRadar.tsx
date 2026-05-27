import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { StyleVector, PreferredMinor, SwindlePreference, Motif } from '../../ml/styleVector';

type StyleVectorRadarProps = {
  vector: StyleVector;
  onChange: (vector: StyleVector) => void;
};

type RadarAxis = {
  key: string;
  label: string;
  getValue: (vector: StyleVector) => number;
  setValue: (vector: StyleVector, value: number) => StyleVector;
};

const RADAR_AXES: RadarAxis[] = [
  {
    key: 'opening-white',
    label: 'White opening',
    getValue: (vector) => openingScore(vector.opening_white_top3[0]),
    setValue: (vector, value) => ({ ...vector, opening_white_top3: [openingMoveFor(value, 'white')] }),
  },
  {
    key: 'opening-black',
    label: 'Black reply',
    getValue: (vector) => openingScore(vector.opening_black_top3[0]),
    setValue: (vector, value) => ({ ...vector, opening_black_top3: [openingMoveFor(value, 'black')] }),
  },
  {
    key: 'tempo',
    label: 'Move time',
    getValue: (vector) => clamp01(vector.avg_move_time_ms / 20_000),
    setValue: (vector, value) => ({ ...vector, avg_move_time_ms: Math.round(clamp01(value) * 20_000) }),
  },
  {
    key: 'pressure',
    label: 'Time trouble',
    getValue: (vector) => clamp01(vector.time_pressure_blunder_rate),
    setValue: (vector, value) => ({ ...vector, time_pressure_blunder_rate: clamp01(value) }),
  },
  {
    key: 'trades',
    label: 'Trades',
    getValue: (vector) => clamp01(vector.exchange_willingness),
    setValue: (vector, value) => ({ ...vector, exchange_willingness: clamp01(value) }),
  },
  {
    key: 'minor',
    label: 'Minor piece',
    getValue: (vector) => minorScore(vector.preferred_minor),
    setValue: (vector, value) => ({ ...vector, preferred_minor: minorFor(value) }),
  },
  {
    key: 'motif',
    label: 'Motif blindness',
    getValue: (vector) => averageMotifBlindness(vector.motif_blindness),
    setValue: (vector, value) => ({ ...vector, motif_blindness: fillMotifBlindness(value) }),
  },
  {
    key: 'endgame',
    label: 'Endgame',
    getValue: (vector) => clamp01(vector.endgame_strength),
    setValue: (vector, value) => ({ ...vector, endgame_strength: clamp01(value) }),
  },
];

const SWINDLE_CHOICES: Array<{ value: SwindlePreference; label: string }> = [
  { value: 'principled', label: 'Principled' },
  { value: null, label: 'Unset' },
  { value: 'swindle', label: 'Swindle' },
];

export function StyleVectorRadar({ vector, onChange }: StyleVectorRadarProps) {
  const isCompact = useMediaQuery('(max-width: 599px)');
  const [activeAxis, setActiveAxis] = useState<number | null>(null);

  useEffect(() => {
    if (activeAxis === null) return;
    function stopDragging() {
      setActiveAxis(null);
    }

    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
    return () => {
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [activeAxis]);

  const axisValues = useMemo(() => RADAR_AXES.map((axis) => axis.getValue(vector)), [vector]);
  const points = useMemo(() => axisValues.map((value, index) => pointForValue(value, index, RADAR_AXES.length)), [axisValues]);

  function updateAxis(index: number, value: number): void {
    onChange(RADAR_AXES[index].setValue(vector, value));
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>): void {
    if (activeAxis === null) return;
    const nextValue = valueFromPointer(event, activeAxis, RADAR_AXES.length);
    updateAxis(activeAxis, nextValue);
  }

  if (isCompact) {
    return (
      <section className="style-vector-radar style-vector-radar--sliders" aria-label="Style vector sliders">
        <header className="style-vector-radar__header">
          <h2>Style vector</h2>
          <p>Adjust the vector directly on a phone-sized layout.</p>
        </header>

        <div className="style-vector-radar__sliders">
          {RADAR_AXES.map((axis, index) => (
            <label key={axis.key} className="style-vector-radar__slider-row">
              <span>{axis.label}</span>
              <input
                aria-label={axis.label}
                type="range"
                min="0"
                max="100"
                value={Math.round(axisValues[index] * 100)}
                onChange={(event) => updateAxis(index, Number(event.target.value) / 100)}
              />
            </label>
          ))}
        </div>

        <fieldset className="style-vector-radar__swindle">
          <legend>Swindle preference</legend>
          <div className="style-vector-radar__chips">
            {SWINDLE_CHOICES.map((choice) => (
              <button
                key={choice.label}
                type="button"
                aria-pressed={vector.swindle_preference === choice.value}
                onClick={() => onChange({ ...vector, swindle_preference: choice.value })}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </fieldset>
      </section>
    );
  }

  return (
    <section className="style-vector-radar style-vector-radar--radar" aria-label="Style vector radar">
      <header className="style-vector-radar__header">
        <h2>Style vector</h2>
        <p>Drag a spoke to reshape the radar.</p>
      </header>

      <svg
        viewBox="0 0 320 320"
        className="style-vector-radar__chart"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setActiveAxis(null)}
        aria-hidden="true"
      >
        <circle cx="160" cy="160" r="124" className="style-vector-radar__ring" />
        <circle cx="160" cy="160" r="92" className="style-vector-radar__ring style-vector-radar__ring--inner" />
        <polygon points={points.map(({ x, y }) => `${x},${y}`).join(' ')} className="style-vector-radar__polygon" />

        {RADAR_AXES.map((axis, index) => {
          const { x, y } = pointForValue(axisValues[index], index, RADAR_AXES.length);
          const angle = angleForIndex(index, RADAR_AXES.length);
          const end = pointOnCircle(160, 160, 124, angle);

          return (
            <g key={axis.key}>
              <line x1="160" y1="160" x2={end.x} y2={end.y} className="style-vector-radar__spoke" />
              <text x={labelPoint(angle).x} y={labelPoint(angle).y} className="style-vector-radar__label">
                {axis.label}
              </text>
              <circle
                cx={x}
                cy={y}
                r="7"
                className="style-vector-radar__handle"
                onPointerDown={(event) => {
                  setActiveAxis(index);
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  updateAxis(index, valueFromPointer(event, index, RADAR_AXES.length));
                }}
              />
            </g>
          );
        })}
      </svg>

      <fieldset className="style-vector-radar__swindle">
        <legend>Swindle preference</legend>
        <div className="style-vector-radar__chips">
          {SWINDLE_CHOICES.map((choice) => (
            <button
              key={choice.label}
              type="button"
              aria-pressed={vector.swindle_preference === choice.value}
              onClick={() => onChange({ ...vector, swindle_preference: choice.value })}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function getSnapshot(): boolean {
    return typeof window !== 'undefined' && window.matchMedia(query).matches;
  }

  function getServerSnapshot(): boolean {
    return false;
  }

  function subscribe(onStoreChange: () => void): () => void {
    if (typeof window === 'undefined') {
      return () => undefined;
    }

    const mediaQueryList = window.matchMedia(query);
    const listener = () => onStoreChange();
    mediaQueryList.addEventListener('change', listener);
    return () => mediaQueryList.removeEventListener('change', listener);
  }
}

function openingScore(opening: string | undefined): number {
  const normalized = (opening ?? '').toLowerCase();
  if (normalized.startsWith('e4') || normalized.startsWith('e5')) return 1;
  if (normalized.startsWith('d4') || normalized.startsWith('d5')) return 0.82;
  if (normalized.startsWith('c4') || normalized.startsWith('c5')) return 0.64;
  if (normalized.startsWith('nf3') || normalized.startsWith('nf6')) return 0.48;
  return 0.3;
}

function openingMoveFor(value: number, side: 'white' | 'black'): string {
  const moves = side === 'white' ? ['e4', 'd4', 'c4', 'Nf3', 'b3'] : ['e5', 'd5', 'c5', 'Nf6', 'b6'];
  const index = Math.min(moves.length - 1, Math.max(0, Math.round(clamp01(value) * (moves.length - 1))));
  return moves[index];
}

function minorScore(value: PreferredMinor): number {
  if (value === 'knight') return 0;
  if (value === 'neutral') return 0.5;
  return 1;
}

function minorFor(value: number): PreferredMinor {
  if (value < 0.33) return 'knight';
  if (value < 0.66) return 'neutral';
  return 'bishop';
}

function averageMotifBlindness(motifBlindness: Record<Motif, number>): number {
  const values = Object.values(motifBlindness);
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function fillMotifBlindness(value: number): Record<Motif, number> {
  const next = clamp01(value);
  return {
    fork: next,
    pin: next,
    skewer: next,
    removing_the_defender: next,
  };
}

function pointForValue(value: number, index: number, totalAxes: number): { x: number; y: number } {
  const angle = angleForIndex(index, totalAxes);
  return pointOnCircle(160, 160, 124 * clamp01(value), angle);
}

function pointOnCircle(centerX: number, centerY: number, radius: number, angle: number): { x: number; y: number } {
  return {
    x: centerX + Math.sin(angle) * radius,
    y: centerY - Math.cos(angle) * radius,
  };
}

function labelPoint(angle: number): { x: number; y: number } {
  return pointOnCircle(160, 160, 145, angle);
}

function angleForIndex(index: number, totalAxes: number): number {
  return -Math.PI / 2 + (index * Math.PI * 2) / totalAxes;
}

function valueFromPointer(event: React.PointerEvent<SVGSVGElement | SVGCircleElement>, axisIndex: number, totalAxes: number): number {
  const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget;
  const bounds = svg.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  const angle = angleForIndex(axisIndex, totalAxes);
  const dx = x - 160;
  const dy = y - 160;
  const projected = (dx * Math.sin(angle) - dy * Math.cos(angle)) / 124;
  return clamp01(projected);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
