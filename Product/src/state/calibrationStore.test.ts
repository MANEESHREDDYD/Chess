import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteMirrorDb, openMirrorDb, type CalibrationRunRecord } from '../data/db';
import { useCalibrationStore } from './calibrationStore';

const STALE_STARTED_AT = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

beforeEach(async () => {
  useCalibrationStore.getState().resetForTests();
  await deleteMirrorDb();
});

afterEach(async () => {
  useCalibrationStore.getState().resetForTests();
  await deleteMirrorDb();
});

describe('calibrationStore', () => {
  it('starts, records, and completes a calibration run', async () => {
    const store = useCalibrationStore.getState();

    const run = await store.startRun();
    await useCalibrationStore.getState().submitTask(1, { correct_count: 4, total_count: 4 });
    await useCalibrationStore.getState().submitTask(2, { selected_move: 'e4' });
    await useCalibrationStore.getState().submitTask(3, { outcome: 'full' });
    await useCalibrationStore.getState().submitTask(4, {
      correct_count: 3,
      total_count: 4,
      time_pressure_blunder_rate: 0.25,
    });
    await useCalibrationStore.getState().submitTask(5, { choice: 'principled' });
    await useCalibrationStore.getState().submitTask(6, { selected_replies: ['e5', 'd5'] });
    await useCalibrationStore.getState().submitTask(7, {
      choices: [
        { decision: 'decline', kept_minor: 'knight' },
        { decision: 'accept', kept_minor: 'bishop' },
      ],
    });
    await useCalibrationStore.getState().submitTask(8, {
      result: 'draw',
      avg_cp_loss: 45,
      avg_move_time_ms: 12000,
    });

    const vectorRow = await useCalibrationStore.getState().completeRun();
    const db = await openMirrorDb();
    const completedRun = await db.get('calibration_runs', run.id);
    const player = await db.get('players', 'local-player');

    expect(vectorRow?.source).toBe('calibration');
    expect(vectorRow?.vector.opening_white_top3).toEqual(['e4']);
    expect(completedRun?.status).toBe('completed');
    expect(completedRun?.style_vector_id).toBe(vectorRow?.id);
    expect(player?.current_style_vector_id).toBe(vectorRow?.id);
  });

  it('resumes an in-progress run after store reset', async () => {
    const run = await useCalibrationStore.getState().startRun();
    await useCalibrationStore.getState().submitTask(1, { correct_count: 2, total_count: 4 });

    useCalibrationStore.getState().resetForTests();
    const resumed = await useCalibrationStore.getState().resumeRun();
    const state = useCalibrationStore.getState();

    expect(resumed.id).toBe(run.id);
    expect(state.currentTaskIndex).toBe(2);
    expect(state.taskOutputs.task1).toEqual({ correct_count: 2, total_count: 4 });
  });

  it('abandons a stale run and starts fresh after 24 hours', async () => {
    const db = await openMirrorDb();
    const staleRun: CalibrationRunRecord = {
      id: 'stale-run',
      player_id: 'local-player',
      started_at: STALE_STARTED_AT,
      status: 'in_progress',
      current_task_index: 3,
      task_outputs: {
        task1: { correct_count: 2, total_count: 4 },
        task2: { selected_move: 'd4' },
      },
    };

    await db.put('calibration_runs', staleRun);

    const freshRun = await useCalibrationStore.getState().resumeRun();
    const abandoned = await db.get('calibration_runs', staleRun.id);

    expect(abandoned?.status).toBe('abandoned');
    expect(freshRun.id).not.toBe(staleRun.id);
    expect(freshRun.status).toBe('in_progress');
    expect(useCalibrationStore.getState().currentTaskIndex).toBe(1);
  });
});
