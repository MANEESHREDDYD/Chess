import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Task8VyasaMatch } from './Task8VyasaMatch';

vi.mock('../Board/BoardView', () => ({
  BoardView: ({ fen }: { fen: string }) => <div data-testid="fen">{fen}</div>,
}));

vi.mock('../../engine/calibrationOpponent', () => ({
  init: vi.fn().mockResolvedValue(undefined),
  move: vi.fn().mockResolvedValue(null),
  dispose: vi.fn(),
}));

describe('Task8VyasaMatch', () => {
  it('renders the opening Vyasa line', () => {
    render(<Task8VyasaMatch />);

    expect(screen.getByText(/Task 8 · Vyasa match/i)).toBeInTheDocument();
    expect(screen.getByText(/We are still arranging our houses/i)).toBeInTheDocument();
    expect(screen.getByTestId('fen')).toHaveTextContent('rnbqkbnr');
  });
});
