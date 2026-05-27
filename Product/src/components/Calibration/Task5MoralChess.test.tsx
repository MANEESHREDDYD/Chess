import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Task5MoralChess } from './Task5MoralChess';

vi.mock('../Board/BoardView', () => ({
  BoardView: ({ fen }: { fen: string }) => <div data-testid="fen">{fen}</div>,
}));

describe('Task5MoralChess', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('replays the selected line over three plies', async () => {
    render(<Task5MoralChess />);

    expect(screen.getByText(/Choose the patient conversion or the swindle/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /patient conversion/i }));

    const initialFen = screen.getByTestId('fen').textContent;

    await act(async () => {
      vi.advanceTimersByTime(750);
    });

    expect(screen.getByTestId('fen').textContent).not.toBe(initialFen);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/Ready to continue in 1s/i)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
