import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteMirrorDb, openMirrorDb } from '../data/db';
import { usePlayerStore } from '../state/playerStore';
import AnalyticsDashboard from './AnalyticsDashboard';

const playerId = 'analytics-route-player';

beforeEach(async () => {
  await deleteMirrorDb();
  const db = await openMirrorDb();
  await db.put('players', {
    id: playerId,
    display_name: 'Route Analytics',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    calibration_status: 'not_started',
  });
  usePlayerStore.setState({
    activePlayerId: playerId,
    activePlayer: {
      id: playerId,
      display_name: 'Route Analytics',
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
      calibration_status: 'not_started',
    },
  });
});

afterEach(async () => {
  await deleteMirrorDb();
  usePlayerStore.setState({ activePlayerId: null, activePlayer: null });
});

describe('AnalyticsDashboard route', () => {
  it('renders the local-first analytics dashboard without cloud or GenAI runtime', async () => {
    render(
      <MemoryRouter initialEntries={['/analytics']}>
        <Routes>
          <Route path="/analytics" element={<AnalyticsDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /Player intelligence dashboard/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Runtime GenAI and cloud upload are not used/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export Markdown/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export JSON/i })).toBeInTheDocument();
      expect(screen.getByText('Data quality')).toBeInTheDocument();
      expect(screen.getByText('Game Review Pro summary')).toBeInTheDocument();
      expect(screen.getByText('StyleVector profile')).toBeInTheDocument();
      expect(screen.getByText('Recommended next actions')).toBeInTheDocument();
      expect(screen.getByText(/No Game Review Pro records exist yet/i)).toBeInTheDocument();
    });
  });
});
