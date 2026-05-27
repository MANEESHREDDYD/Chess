import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Task3EndgameTechnique } from './Task3EndgameTechnique';

vi.mock('../Board/BoardView', () => ({
  BoardView: ({ fen, onPieceDrop }: { fen: string; onPieceDrop: (from: string, to: string) => boolean }) => (
    <div>
      <div data-testid="fen">{fen}</div>
      <button data-testid="move" onClick={() => onPieceDrop('c1', 'c2')}>
        move
      </button>
    </div>
  ),
}));

vi.mock('../../engine/calibrationOpponent', () => ({
  init: vi.fn().mockResolvedValue(undefined),
  move: vi.fn().mockResolvedValue(null),
  dispose: vi.fn(),
}));

describe('Task3EndgameTechnique', () => {
  it('renders the endgame task and tracks a user move', async () => {
    render(<Task3EndgameTechnique />);

    expect(screen.getByText(/Task 3 · Endgame technique/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('move'));

    await waitFor(() => {
      expect(screen.getByText('1', { selector: 'dd' })).toBeInTheDocument();
    });
  });
});
