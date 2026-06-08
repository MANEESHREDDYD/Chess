import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteMirrorDb, openMirrorDb } from '../data/db';
import { useCalibrationStore } from './calibrationStore';
import { usePlayerStore } from './playerStore';

beforeEach(async () => {
  useCalibrationStore.getState().resetForTests();
  usePlayerStore.getState().clearActivePlayer();
  await deleteMirrorDb();
  const db = await openMirrorDb();
  await db.put('players', {
    id: 'local-player',
    display_name: 'Local Test Player',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  usePlayerStore.setState({ activePlayerId: 'local-player' });
  if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
    localStorage.setItem('mirror_active_player_id', 'local-player');
  }
});

afterEach(async () => {
  useCalibrationStore.getState().resetForTests();
  await deleteMirrorDb();
});

describe('calibrationStore edge inputs', () => {
  it('does not persist a taskNaN key or non-finite current task index', async () => {
    await useCalibrationStore.getState().startRun();

    await useCalibrationStore.getState().submitTask(Number.NaN, { abandoned: true });

    const state = useCalibrationStore.getState();
    expect(state.taskOutputs).not.toHaveProperty('taskNaN');
    expect(Number.isFinite(state.currentTaskIndex)).toBe(true);
  });
});
