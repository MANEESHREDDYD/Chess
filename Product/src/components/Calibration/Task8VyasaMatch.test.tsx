import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Task8VyasaMatch } from './Task8VyasaMatch';

vi.mock('../Board/BoardView', () => ({
  BoardView: ({ fen }: { fen: string }) => <div data-testid="fen">{fen}</div>,
}));

vi.mock('../../engine/calibrationOpponent', () => ({
  init: vi.fn().mockResolvedValue(undefined),
  move: vi.fn().mockResolvedValue(null),
  dispose: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
});

describe('Task8VyasaMatch', () => {
  it('renders the opening Vyasa line', () => {
    render(<Task8VyasaMatch />);

    expect(screen.getByText(/Task 8 · Vyasa match/i)).toBeInTheDocument();
    expect(screen.getByText(/We are still arranging our houses/i)).toBeInTheDocument();
    expect(screen.getByTestId('fen')).toHaveTextContent('rnbqkbnr');
  });

  it('reports a timeout completion only once even if the parent rerenders', async () => {
    vi.useFakeTimers();
    const firstComplete = vi.fn();
    const secondComplete = vi.fn();
    const { rerender } = render(<Task8VyasaMatch onComplete={firstComplete} />);

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 250);
    });

    expect(firstComplete).toHaveBeenCalledTimes(1);

    rerender(<Task8VyasaMatch onComplete={secondComplete} />);

    expect(secondComplete).not.toHaveBeenCalled();
  });
});
