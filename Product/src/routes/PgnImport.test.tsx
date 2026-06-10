import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteMirrorDb, openMirrorDb } from '../data/db';
import { usePlayerStore } from '../state/playerStore';
import PgnImport from './PgnImport';

const PGN = `[Event "Route import"]
[White "Local Player"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0`;

beforeEach(async () => {
  await deleteMirrorDb();
  const db = await openMirrorDb();
  await db.put('players', {
    id: 'player-route',
    display_name: 'Local Player',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  });
  usePlayerStore.setState({
    activePlayerId: 'player-route',
    activePlayer: {
      id: 'player-route',
      display_name: 'Local Player',
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    },
  });
});

afterEach(async () => {
  await deleteMirrorDb();
  usePlayerStore.setState({ activePlayerId: null, activePlayer: null });
});

describe('PGN import route', () => {
  it('renders and imports a pasted PGN locally after preview', async () => {
    render(
      <MemoryRouter>
        <PgnImport />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /Import games/i })).toBeInTheDocument();
    expect(await screen.findByText(/Local-only: no OAuth/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/\[Event "Training game"\]/i), {
      target: { value: PGN },
    });
    fireEvent.click(screen.getByRole('button', { name: /Preview import/i }));

    await waitFor(() => {
      expect(screen.getByText(/Detected 1 game/i)).toBeInTheDocument();
      expect(screen.getByText(/Game 1: Local Player vs Opponent/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Import locally/i }));

    await waitFor(() => {
      expect(screen.getByText(/Saved 1 imported game/i)).toBeInTheDocument();
      expect(screen.getByText(/Post-import summary/i)).toBeInTheDocument();
      expect(screen.getByText(/Latest imported games/i)).toBeInTheDocument();
    });
  });
});
