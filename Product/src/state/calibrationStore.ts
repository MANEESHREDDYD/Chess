import { create } from 'zustand';
import {
  openMirrorDb,
  type CalibrationRunRecord,
  type PlayerRecord,
  type StyleVectorRecord,
} from '../data/db';
import { computeStyleVector, type CalibrationRunData, type StyleVector } from '../ml/styleVector';

const LOCAL_PLAYER_ID = 'local-player';
const TOTAL_TASKS = 8;
const RUN_STALE_MS = 24 * 60 * 60 * 1000;

type TaskOutputs = Record<string, unknown>;

interface CalibrationStateValues {
  run: CalibrationRunRecord | null;
  currentTaskIndex: number;
  taskOutputs: TaskOutputs;
  styleVector: StyleVector | null;
  isLoading: boolean;
}

interface CalibrationActions {
  startRun: () => Promise<CalibrationRunRecord>;
  resumeRun: () => Promise<CalibrationRunRecord>;
  submitTask: (taskIndex: number, output: unknown) => Promise<void>;
  completeRun: () => Promise<StyleVectorRecord | null>;
  abandonRun: () => Promise<void>;
  resetForTests: () => void;
}

export type CalibrationState = CalibrationStateValues & CalibrationActions;

export const initialCalibrationState: CalibrationStateValues = {
  run: null,
  currentTaskIndex: 1,
  taskOutputs: {},
  styleVector: null,
  isLoading: false,
};

export const useCalibrationStore = create<CalibrationState>((set, get) => ({
  ...initialCalibrationState,

  startRun: async () => {
    set({ isLoading: true });
    const db = await openMirrorDb();
    const now = new Date().toISOString();
    const player = await ensureLocalPlayer(now);
    const run: CalibrationRunRecord = {
      id: makeId('calibration-run'),
      player_id: player.id,
      started_at: now,
      status: 'in_progress',
      current_task_index: 1,
      task_outputs: {},
    };

    await db.put('calibration_runs', run);
    set({
      run,
      currentTaskIndex: 1,
      taskOutputs: {},
      styleVector: null,
      isLoading: false,
    });

    return run;
  },

  resumeRun: async () => {
    set({ isLoading: true });
    const db = await openMirrorDb();
    const runs = await db.getAllFromIndex('calibration_runs', 'started_at');
    const inProgressRuns = runs.filter(
      (run) => run.player_id === LOCAL_PLAYER_ID && run.status === 'in_progress'
    );
    const latestRun = inProgressRuns[inProgressRuns.length - 1];

    if (!latestRun) {
      set({ isLoading: false });
      return get().startRun();
    }

    if (isStale(latestRun.started_at)) {
      const abandonedRun: CalibrationRunRecord = { ...latestRun, status: 'abandoned' };
      await db.put('calibration_runs', abandonedRun);
      set({ isLoading: false });
      return get().startRun();
    }

    set({
      run: latestRun,
      currentTaskIndex: nextTaskIndex(latestRun.task_outputs),
      taskOutputs: latestRun.task_outputs,
      styleVector: null,
      isLoading: false,
    });

    return latestRun;
  },

  submitTask: async (taskIndex, output) => {
    const run = get().run ?? (await get().startRun());
    const normalizedTaskIndex = normalizeTaskIndex(taskIndex);
    const taskKey = toTaskKey(normalizedTaskIndex);
    const taskOutputs = { ...run.task_outputs, [taskKey]: output };
    const updatedRun: CalibrationRunRecord = {
      ...run,
      task_outputs: taskOutputs,
      current_task_index: Math.min(TOTAL_TASKS, normalizedTaskIndex + 1),
    };

    await (await openMirrorDb()).put('calibration_runs', updatedRun);
    set({
      run: updatedRun,
      taskOutputs,
      currentTaskIndex: updatedRun.current_task_index,
    });
  },

  completeRun: async () => {
    const run = get().run;
    if (!run) return null;

    const db = await openMirrorDb();
    const now = new Date().toISOString();
    const vector = computeStyleVector(run.task_outputs as CalibrationRunData);
    const styleVectorRow: StyleVectorRecord = {
      id: makeId('style-vector'),
      player_id: run.player_id,
      calibration_run_id: run.id,
      source: 'calibration',
      vector,
      computed_at: now,
    };
    const completedRun: CalibrationRunRecord = {
      ...run,
      status: 'completed',
      completed_at: now,
      style_vector_id: styleVectorRow.id,
    };
    const player = await ensureLocalPlayer(now);

    await db.put('style_vectors', styleVectorRow);
    await db.put('calibration_runs', completedRun);
    await db.put('players', {
      ...player,
      current_style_vector_id: styleVectorRow.id,
      detected_elo: vector.detected_elo,
      elo_band: vector.elo_band,
      updated_at: now,
    });

    set({
      run: completedRun,
      currentTaskIndex: TOTAL_TASKS,
      taskOutputs: completedRun.task_outputs,
      styleVector: vector,
    });

    return styleVectorRow;
  },

  abandonRun: async () => {
    const run = get().run;
    if (!run) return;

    const abandonedRun: CalibrationRunRecord = { ...run, status: 'abandoned' };
    await (await openMirrorDb()).put('calibration_runs', abandonedRun);
    set({
      ...initialCalibrationState,
      run: abandonedRun,
      taskOutputs: abandonedRun.task_outputs,
    });
  },

  resetForTests: () => {
    set(initialCalibrationState);
  },
}));

async function ensureLocalPlayer(now = new Date().toISOString()): Promise<PlayerRecord> {
  const db = await openMirrorDb();
  const existing = await db.get('players', LOCAL_PLAYER_ID);
  if (existing) return existing;

  const player: PlayerRecord = {
    id: LOCAL_PLAYER_ID,
    created_at: now,
    updated_at: now,
  };
  await db.put('players', player);
  return player;
}

function nextTaskIndex(taskOutputs: TaskOutputs): number {
  const completedTasks = Object.keys(taskOutputs).filter((key) => /^task\d+$/.test(key)).length;
  return Math.min(TOTAL_TASKS, completedTasks + 1);
}

function toTaskKey(taskIndex: number): string {
  return `task${normalizeTaskIndex(taskIndex)}`;
}

function normalizeTaskIndex(taskIndex: number): number {
  if (!Number.isFinite(taskIndex)) return 1;
  return Math.max(1, Math.min(TOTAL_TASKS, Math.round(taskIndex)));
}

function isStale(startedAt: string): boolean {
  const startedAtMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedAtMs)) return true;
  return Date.now() - startedAtMs > RUN_STALE_MS;
}

function makeId(prefix: string): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}
