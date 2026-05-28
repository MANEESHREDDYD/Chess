import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { EloBand, StyleVector } from '../ml/styleVector';

export type { EloBand, StyleVector, SwindlePreference } from '../ml/styleVector';

export const MIRROR_DB_NAME = 'mirror-pwa';
export const MIRROR_DB_VERSION = 1;

export type CalibrationRunStatus = 'in_progress' | 'completed' | 'abandoned';
export type StyleVectorSource = 'calibration' | 'tuned';

// Persistence-intent annotations (the storage seam — docs/ARCHITECTURE.md §B.3).
// These do not change runtime behavior. They mark where a future sync layer
// would draw its boundary so it does not have to be re-derived.
//
// LOCAL-ONLY            ephemeral, device-bound (settingsStore lives in
//                       localStorage, not here)
// USER-OWNED / MIRROR   authored on device, would mirror to server when
//                       accounts arrive; loss-on-clear is a UX bug
// SERVER-CANONICAL      cannot live device-authoritative (none yet)

// USER-OWNED / MIRROR
export interface PlayerRecord {
  id: string;
  created_at: string;
  updated_at: string;
  current_style_vector_id?: string;
  detected_elo?: number;
  elo_band?: EloBand;
}

// USER-OWNED / MIRROR
export interface CalibrationRunRecord {
  id: string;
  player_id: string;
  started_at: string;
  completed_at?: string;
  status: CalibrationRunStatus;
  current_task_index: number;
  task_outputs: Record<string, unknown>;
  style_vector_id?: string;
}

// USER-OWNED / MIRROR
export interface StyleVectorRecord {
  id: string;
  player_id: string;
  calibration_run_id?: string;
  source: StyleVectorSource;
  vector: StyleVector;
  computed_at: string;
  previous_vector_id?: string;
}

// USER-OWNED / MIRROR  (store provisioned at v1; no writers yet — Mirror match feature)
export interface MirrorMatchRecord {
  id: string;
  player_id: string;
  started_at: string;
  completed_at?: string;
  pgn?: string;
  result?: string;
  metadata?: Record<string, unknown>;
}

// USER-OWNED / MIRROR  (store provisioned at v1; no writers yet — beta-cohort signal,
// eventually the storage seam's first server-bound surface)
export interface FeedbackRecord {
  id: string;
  player_id?: string;
  mirror_match_id?: string;
  created_at: string;
  felt_like_me?: boolean;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface MirrorDB extends DBSchema {
  players: {
    key: string;
    value: PlayerRecord;
  };
  calibration_runs: {
    key: string;
    value: CalibrationRunRecord;
    indexes: {
      started_at: string;
    };
  };
  style_vectors: {
    key: string;
    value: StyleVectorRecord;
    indexes: {
      computed_at: string;
    };
  };
  mirror_matches: {
    key: string;
    value: MirrorMatchRecord;
  };
  feedback: {
    key: string;
    value: FeedbackRecord;
  };
}

const dbCache = new Map<string, Promise<IDBPDatabase<MirrorDB>>>();

export function openMirrorDb(dbName = MIRROR_DB_NAME): Promise<IDBPDatabase<MirrorDB>> {
  const cached = dbCache.get(dbName);
  if (cached) return cached;

  const dbPromise = openDB<MirrorDB>(dbName, MIRROR_DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        createV1Schema(db);
      }
    },
  });

  dbCache.set(dbName, dbPromise);
  return dbPromise;
}

export async function closeMirrorDb(dbName = MIRROR_DB_NAME): Promise<void> {
  const dbPromise = dbCache.get(dbName);
  if (!dbPromise) return;

  const db = await dbPromise;
  db.close();
  dbCache.delete(dbName);
}

export async function deleteMirrorDb(dbName = MIRROR_DB_NAME): Promise<void> {
  await closeMirrorDb(dbName);
  await deleteDB(dbName);
}

function createV1Schema(db: IDBPDatabase<MirrorDB>): void {
  db.createObjectStore('players', { keyPath: 'id' });

  const calibrationRuns = db.createObjectStore('calibration_runs', { keyPath: 'id' });
  calibrationRuns.createIndex('started_at', 'started_at');

  const styleVectors = db.createObjectStore('style_vectors', { keyPath: 'id' });
  styleVectors.createIndex('computed_at', 'computed_at');

  db.createObjectStore('mirror_matches', { keyPath: 'id' });
  db.createObjectStore('feedback', { keyPath: 'id' });
}
