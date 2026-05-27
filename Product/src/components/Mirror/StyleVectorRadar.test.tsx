import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import aggressiveFixture from '../../ml/__fixtures__/aggressiveCalibration.json';
import defensiveFixture from '../../ml/__fixtures__/defensiveCalibration.json';
import { computeStyleVector, type CalibrationRunData } from '../../ml/styleVector';
import { StyleVectorRadar } from './StyleVectorRadar';
import { generateSummary } from './styleSummary';

const aggressiveCalibration = aggressiveFixture as unknown as CalibrationRunData;
const defensiveCalibration = defensiveFixture as unknown as CalibrationRunData;

describe('StyleVectorRadar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockMatchMedia(false);
  });

  it('updates a radar axis when dragged', () => {
    const vector = computeStyleVector(aggressiveCalibration);
    const onChange = vi.fn();

    render(<StyleVectorRadar vector={vector} onChange={onChange} />);

    const svg = screen.getByLabelText(/style vector radar/i);
    const targetHandle = svg.querySelectorAll('circle.style-vector-radar__handle')[0] as SVGCircleElement;

    fireEvent.pointerDown(targetHandle, { pointerId: 1, clientX: 160, clientY: 36 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 160, clientY: 20 });

    expect(onChange).toHaveBeenCalled();
    const nextVector = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as ReturnType<typeof computeStyleVector>;
    expect(nextVector.opening_white_top3[0]).not.toEqual(vector.opening_white_top3[0]);
  });

  it('renders sliders on a compact viewport', () => {
    mockMatchMedia(true);

    const vector = computeStyleVector(aggressiveCalibration);
    render(<StyleVectorRadar vector={vector} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/style vector sliders/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/white opening/i)).toHaveAttribute('type', 'range');
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});

describe('generateSummary', () => {
  it('produces different prose for aggressive and defensive fixtures', () => {
    const aggressive = generateSummary(computeStyleVector(aggressiveCalibration));
    const defensive = generateSummary(computeStyleVector(defensiveCalibration));

    expect(aggressive).toContain('As White you lean toward e4');
    expect(aggressive).toContain('You are willing to tempt fate');
    expect(defensive).toContain('As White you lean toward d4');
    expect(defensive).toContain('You prefer the cleaner line');
    expect(aggressive).not.toEqual(defensive);
  });
});

function mockMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(max-width: 599px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
