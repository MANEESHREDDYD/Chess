import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteMirrorDb, openMirrorDb } from '../data/db';
import { usePlayerStore } from '../state/playerStore';
import ClueChess from './ClueChess';

vi.mock('../components/Board/BoardView', () => ({
  BoardView: () => <div data-testid="mock-board">Board</div>,
}));

const player = {
  id: 'clue-route-player',
  display_name: 'Clue Route',
  created_at: '2026-06-10T00:00:00.000Z',
  updated_at: '2026-06-10T00:00:00.000Z',
  calibration_status: 'complete' as const,
};

beforeEach(async () => {
  await deleteMirrorDb();
  const db = await openMirrorDb();
  await db.put('players', player);
  await db.put('puzzle_reviews', {
    id: `${player.id}:seed-pin-1`,
    player_id: player.id,
    puzzle_id: 'seed-pin-1',
    motif: 'pin',
    difficulty: 'beginner',
    next_due_at: '2020-01-01T00:00:00.000Z',
    interval_days: 1,
    ease: 2.1,
    attempts: 2,
    lapses: 1,
    solved_streak: 0,
    last_result: 'failed',
    updated_at: '2026-06-10T00:00:00.000Z',
  });
  usePlayerStore.setState({ activePlayerId: player.id, activePlayer: player });
});

afterEach(async () => {
  await deleteMirrorDb();
  usePlayerStore.setState({ activePlayerId: null, activePlayer: null });
});

describe('ClueChess route', () => {
  it('renders adaptive Clue Chess modes and route-driven motif review behavior', async () => {
    render(
      <MemoryRouter initialEntries={['/clue-chess?mode=adaptive&motif=pin&review=true']}>
        <Routes>
          <Route path="/clue-chess" element={<ClueChess />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /The right clue at the right difficulty/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('mock-board')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Adaptive Training/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Review Mode/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Streak Mode/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Boss Puzzle/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Kids Mode/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Show next clue/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reveal solution/i })).toBeInTheDocument();
      expect(screen.getByText(/Analytics requested review=true/i)).toBeInTheDocument();
    });
  });
});
