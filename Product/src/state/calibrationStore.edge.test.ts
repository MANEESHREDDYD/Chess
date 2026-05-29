import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteMirrorDb } from '../data/db';
import { useCalibrationStore } from './calibrationStore';

beforeEach(async () => {
  useCalibrationStore.getState().resetForTests();
  await deleteMirrorDb();
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
