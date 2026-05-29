import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Mirror from './Mirror';
import type { StyleVectorRecord } from '../data/db';

const dbMocks = vi.hoisted(() => ({
  getLatestStyleVectorRecord: vi.fn(),
  getMirrorMatchesForPlayer: vi.fn(),
  getMirrorMatchRecord: vi.fn(),
  logAnonymousEvent: vi.fn(),
  mergeMirrorMatchMetadata: vi.fn(),
  putMirrorMatchRecord: vi.fn(),
  putStyleVectorRecord: vi.fn(),
  setCurrentStyleVector: vi.fn(),
}));

const opponentMocks = vi.hoisted(() => ({
  dispose: vi.fn(),
}));

vi.mock('../components/Board/BoardView', () => ({
  BoardView: () => <div data-testid="mirror-board" />,
}));

vi.mock('../data/db', () => ({
  getLatestStyleVectorRecord: dbMocks.getLatestStyleVectorRecord,
  getMirrorMatchesForPlayer: dbMocks.getMirrorMatchesForPlayer,
  getMirrorMatchRecord: dbMocks.getMirrorMatchRecord,
  logAnonymousEvent: dbMocks.logAnonymousEvent,
  mergeMirrorMatchMetadata: dbMocks.mergeMirrorMatchMetadata,
  putMirrorMatchRecord: dbMocks.putMirrorMatchRecord,
  putStyleVectorRecord: dbMocks.putStyleVectorRecord,
  setCurrentStyleVector: dbMocks.setCurrentStyleVector,
}));

vi.mock('../engine/mirrorOpponent', () => ({
  createMirrorOpponent: vi.fn(() => ({
    id: 'mock-mirror',
    getMove: vi.fn(),
    getMoveWithTrace: vi.fn(),
    dispose: opponentMocks.dispose,
  })),
  describeMirrorDecision: vi.fn(() => 'It played the engine move because no style signal dominated.'),
  summarizeMirrorReranks: vi.fn(() => ({
    totalMirrorMoves: 0,
    overrideCount: 0,
    overrideRate: 0,
    overridesByDimension: {},
  })),
}));

vi.mock('../engine/stockfishBridge', () => ({
  stopThinking: vi.fn(),
}));

vi.mock('../state/settingsStore', () => ({
  useSettingsStore: <T,>(selector: (state: { activeTheme: string; setActiveTheme: (themeId: string) => void }) => T): T =>
    selector({ activeTheme: 'standard', setActiveTheme: vi.fn() }),
}));

describe('Mirror match persistence failure recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getLatestStyleVectorRecord.mockResolvedValue(styleRecord());
    dbMocks.getMirrorMatchesForPlayer.mockResolvedValue([]);
    dbMocks.getMirrorMatchRecord.mockResolvedValue(undefined);
    dbMocks.logAnonymousEvent.mockResolvedValue({ id: 'event-1', created_at: 'now' });
    dbMocks.mergeMirrorMatchMetadata.mockResolvedValue({});
    dbMocks.putStyleVectorRecord.mockResolvedValue(undefined);
    dbMocks.setCurrentStyleVector.mockResolvedValue(undefined);
  });

  it('does not latch a failed save and allows the completed match to be retried', async () => {
    dbMocks.putMirrorMatchRecord
      .mockRejectedValueOnce(new Error('IndexedDB write failed'))
      .mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <Mirror />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /resign/i }));

    expect(await screen.findByText(/Match finished, but save failed: IndexedDB write failed/i)).toBeInTheDocument();
    expect(dbMocks.putMirrorMatchRecord).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /retry save/i }));

    await waitFor(() => {
      expect(dbMocks.putMirrorMatchRecord).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(/Match saved. Your Mirror has been sharpened/i)).toBeInTheDocument();
  });
});

function styleRecord(): StyleVectorRecord {
  return {
    id: 'style-vector-1',
    player_id: 'local-player',
    source: 'calibration',
    computed_at: '2026-05-29T00:00:00.000Z',
    vector: {
      opening_white_top3: ['e4'],
      opening_black_top3: ['e5'],
      avg_move_time_ms: 9000,
      time_pressure_blunder_rate: 0.4,
      exchange_willingness: 0.5,
      preferred_minor: 'neutral',
      motif_blindness: {
        fork: 0.2,
        pin: 0.2,
        skewer: 0.2,
        removing_the_defender: 0.2,
      },
      endgame_strength: 0.5,
      swindle_preference: null,
      detected_elo: 1500,
      elo_band: 'initiate',
      schema_version: 1,
    },
  };
}
