import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Task3EndgameTechnique } from './Task3EndgameTechnique';
import { dispose as disposeCalibrationOpponent, move as moveCalibrationOpponent } from '../../engine/calibrationOpponent';

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

  it('ignores a late engine reply after unmount', async () => {
    let resolveMove: (move: string | null) => void = () => undefined;
    vi.mocked(moveCalibrationOpponent).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMove = resolve;
      })
    );
    const { unmount } = render(<Task3EndgameTechnique />);

    fireEvent.click(screen.getByTestId('move'));
    unmount();
    resolveMove('a2a1q');

    await waitFor(() => {
      expect(disposeCalibrationOpponent).toHaveBeenCalled();
    });
  });
});
