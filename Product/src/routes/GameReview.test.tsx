import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GameReview from './GameReview';
import { usePlayerStore } from '../state/playerStore';

vi.mock('../data/db', () => ({
  getGameReviewForSource: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../review/gameReviewService', () => ({
  compareRetryMove: vi.fn(),
  createGameReview: vi.fn(),
  exportGameReviewMarkdown: vi.fn(),
}));

describe('GameReview route', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      activePlayerId: 'player-1',
      activePlayer: {
        id: 'player-1',
        display_name: 'Local Player',
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    });
  });

  it('renders the review route without requiring cloud or LLM services', async () => {
    render(
      <MemoryRouter initialEntries={['/review/imported_game/ig-1']}>
        <Routes>
          <Route path="/review/:sourceType/:sourceId" element={<GameReview />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Review your game')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Analyze game/i })).toBeInTheDocument();
    expect(screen.getByText(/Runtime GenAI is not used/i)).toBeInTheDocument();
  });
});
