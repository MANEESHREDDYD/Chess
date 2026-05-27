import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Task1Tactical } from './Task1Tactical';

vi.mock('../Board/BoardView', () => ({
  BoardView: ({ fen, onPieceDrop }: { fen: string; onPieceDrop: (from: string, to: string) => boolean }) => (
    <div>
      <div data-testid="fen">{fen}</div>
      <button data-testid="drop" onClick={() => onPieceDrop('f3', 'd2')}>
        drop
      </button>
    </div>
  ),
}));

describe('Task1Tactical', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('advances after a correct tactical move', () => {
    render(<Task1Tactical />);

    expect(screen.getByText('Task 1 · Tactical sight')).toBeInTheDocument();
    expect(screen.getByText('1 / 4 · t1-fork-003Tx')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('drop'));

    expect(screen.getByText('2 / 4 · t1-pin-005Bm')).toBeInTheDocument();
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
