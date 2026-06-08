import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { EloBand, StyleVector } from '../ml/styleVector';

export type { EloBand, StyleVector, SwindlePreference } from '../ml/styleVector';

export const MIRROR_DB_NAME = 'mirror-pwa';
export const MIRROR_DB_VERSION = 2;

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
  display_name: string;
  created_at: string;
  updated_at: string;
  current_style_vector_id?: string;
  calibration_status?: "not_started" | "in_progress" | "complete";
  settings?: Record<string, unknown>;
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

// USER-OWNED / MIRROR
export interface MirrorMatchRecord {
  id: string;
  player_id: string;
  started_at: string;
  completed_at?: string;
  pgn?: string;
  result?: string;
  metadata?: Record<string, unknown>;
}

// USER-OWNED / LOCAL ONLY
export interface LocalMatchRecord {
  id: string;
  player_id: string;
  mode: 'computer';
  side: 'white' | 'black' | 'random';
  actual_side: 'white' | 'black';
  difficulty: 'Beginner' | 'Casual' | 'Club' | 'Strong';
  result: 'white_win' | 'black_win' | 'draw' | 'resigned' | 'abandoned';
  result_label: string;
  pgn: string;
  move_count: number;
  created_at: string;
  completed_at: string;
  metadata?: Record<string, unknown>;
}

// USER-OWNED / MIRROR  (anonymous event/feedback records today; eventual
// storage seam's first server-bound surface)
export interface FeedbackRecord {
  id: string;
  player_id: string;
  mirror_match_id: string;
  style_vector_id: string;
  felt_like_me: 'yes' | 'somewhat' | 'no';
  perceived_strength: 'weaker' | 'equal' | 'stronger';
  similar_notes?: string;
  wrong_notes?: string;
  created_at: string;
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
  local_matches: {
    key: string;
    value: LocalMatchRecord;
    indexes: {
      created_at: string;
    };
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
      if (oldVersion < 2) {
        createV2Schema(db);
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

// -----------------------------------------------------------------------------
// PLAYER API
// -----------------------------------------------------------------------------

export async function createLocalPlayer(display_name: string, dbName = MIRROR_DB_NAME): Promise<PlayerRecord> {
  const db = await openMirrorDb(dbName);
  const now = new Date().toISOString();
  const player: PlayerRecord = {
    id: `player-${Date.now()}`,
    display_name,
    created_at: now,
    updated_at: now,
    calibration_status: 'not_started',
    settings: {},
  };
  await db.put('players', player);
  return player;
}

export async function getLocalPlayer(playerId: string, dbName = MIRROR_DB_NAME): Promise<PlayerRecord | undefined> {
  const db = await openMirrorDb(dbName);
  return db.get('players', playerId);
}

export async function getAllLocalPlayers(dbName = MIRROR_DB_NAME): Promise<PlayerRecord[]> {
  const db = await openMirrorDb(dbName);
  return db.getAll('players');
}

export async function updateLocalPlayer(playerId: string, patch: Partial<PlayerRecord>, dbName = MIRROR_DB_NAME): Promise<PlayerRecord> {
  const db = await openMirrorDb(dbName);
  const existing = await db.get('players', playerId);
  if (!existing) throw new Error('Player not found');
  const updated = { ...existing, ...patch, updated_at: new Date().toISOString() };
  await db.put('players', updated);
  return updated;
}

export async function getOrCreateDefaultPlayer(dbName = MIRROR_DB_NAME): Promise<PlayerRecord> {
  const players = await getAllLocalPlayers(dbName);
  if (players.length > 0) return players[0];
  return createLocalPlayer('Local Player', dbName);
}

// -----------------------------------------------------------------------------
// CALIBRATION API
// -----------------------------------------------------------------------------

export async function createCalibrationRun(playerId: string, dbName = MIRROR_DB_NAME): Promise<CalibrationRunRecord> {
  const db = await openMirrorDb(dbName);
  const now = new Date().toISOString();
  const run: CalibrationRunRecord = {
    id: `calib-${Date.now()}`,
    player_id: playerId,
    started_at: now,
    status: 'in_progress',
    current_task_index: 0,
    task_outputs: {},
  };
  await db.put('calibration_runs', run);
  await updateLocalPlayer(playerId, { calibration_status: 'in_progress' }, dbName);
  return run;
}

export async function updateCalibrationRun(runId: string, patch: Partial<CalibrationRunRecord>, dbName = MIRROR_DB_NAME): Promise<CalibrationRunRecord> {
  const db = await openMirrorDb(dbName);
  const existing = await db.get('calibration_runs', runId);
  if (!existing) throw new Error('Calibration run not found');
  const updated = { ...existing, ...patch };
  await db.put('calibration_runs', updated);
  return updated;
}

export async function completeCalibrationRun(runId: string, taskOutputs: Record<string, unknown>, dbName = MIRROR_DB_NAME): Promise<CalibrationRunRecord> {
  return updateCalibrationRun(runId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    task_outputs: taskOutputs,
  }, dbName);
}

export async function getLatestCalibrationRunForPlayer(playerId: string, dbName = MIRROR_DB_NAME): Promise<CalibrationRunRecord | null> {
  const db = await openMirrorDb(dbName);
  const rows = await db.getAllFromIndex('calibration_runs', 'started_at');
  const playerRows = rows.filter((row) => row.player_id === playerId);
  return playerRows.length > 0 ? playerRows[playerRows.length - 1] : null;
}

// -----------------------------------------------------------------------------
// STYLE VECTOR API
// -----------------------------------------------------------------------------

export async function getLatestStyleVectorRecord(
  playerId: string,
  dbName = MIRROR_DB_NAME
): Promise<StyleVectorRecord | null> {
  const db = await openMirrorDb(dbName);
  const rows = await db.getAllFromIndex('style_vectors', 'computed_at');
  const playerRows = rows.filter((row) => row.player_id === playerId);
  return playerRows[playerRows.length - 1] ?? null;
}

export async function getCurrentStyleVectorRecord(
  playerId: string,
  dbName = MIRROR_DB_NAME
): Promise<StyleVectorRecord | null> {
  const db = await openMirrorDb(dbName);
  const player = await db.get('players', playerId);
  if (!player?.current_style_vector_id) return getLatestStyleVectorRecord(playerId, dbName);

  const row = await db.get('style_vectors', player.current_style_vector_id);
  return row?.player_id === playerId ? row : null;
}

export async function putMirrorMatchRecord(
  record: MirrorMatchRecord,
  dbName = MIRROR_DB_NAME
): Promise<void> {
  const db = await openMirrorDb(dbName);
  await db.put('mirror_matches', record);
}

export async function getMirrorMatchRecord(
  matchId: string,
  dbName = MIRROR_DB_NAME
): Promise<MirrorMatchRecord | undefined> {
  const db = await openMirrorDb(dbName);
  return db.get('mirror_matches', matchId);
}

export async function getMirrorMatchesForPlayer(
  playerId: string,
  dbName = MIRROR_DB_NAME
): Promise<MirrorMatchRecord[]> {
  const db = await openMirrorDb(dbName);
  const rows = await db.getAll('mirror_matches');
  return rows.filter((row) => row.player_id === playerId && row.completed_at);
}

export async function mergeMirrorMatchMetadata(
  matchId: string,
  metadata: Record<string, unknown>,
  dbName = MIRROR_DB_NAME
): Promise<MirrorMatchRecord | null> {
  const db = await openMirrorDb(dbName);
  const existing = await db.get('mirror_matches', matchId);
  if (!existing) return null;

  const updated: MirrorMatchRecord = {
    ...existing,
    metadata: {
      ...(existing.metadata ?? {}),
      ...metadata,
    },
  };
  await db.put('mirror_matches', updated);
  return updated;
}

export async function putStyleVectorRecord(
  record: StyleVectorRecord,
  dbName = MIRROR_DB_NAME
): Promise<void> {
  const db = await openMirrorDb(dbName);
  await db.put('style_vectors', record);
}

export async function setCurrentStyleVector(
  playerId: string,
  styleVector: StyleVectorRecord,
  dbName = MIRROR_DB_NAME
): Promise<void> {
  await updateLocalPlayer(playerId, {
    current_style_vector_id: styleVector.id,
    detected_elo: styleVector.vector.detected_elo,
    elo_band: styleVector.vector.elo_band,
    calibration_status: 'complete'
  }, dbName);
}

export async function logAnonymousEvent(
  eventType: string,
  metadata?: Record<string, unknown>,
  dbName = MIRROR_DB_NAME
): Promise<Partial<FeedbackRecord>> {
  const event: Partial<FeedbackRecord> = {
    id: makeId('event'),
    created_at: new Date().toISOString(),
    metadata: {
      event_type: eventType,
      ...metadata,
    },
  };
  await (await openMirrorDb(dbName)).put('feedback', event as FeedbackRecord);
  return event;
}

export async function saveFeedbackRecord(record: FeedbackRecord, dbName = MIRROR_DB_NAME): Promise<void> {
  const db = await openMirrorDb(dbName);
  await db.put('feedback', record);
}

export async function getFeedbackRecords(dbName = MIRROR_DB_NAME): Promise<FeedbackRecord[]> {
  const db = await openMirrorDb(dbName);
  return db.getAll('feedback');
}

export async function putLocalMatchRecord(
  record: LocalMatchRecord,
  dbName = MIRROR_DB_NAME
): Promise<void> {
  const db = await openMirrorDb(dbName);
  await db.put('local_matches', record);
}

export async function getLocalMatches(
  dbName = MIRROR_DB_NAME
): Promise<LocalMatchRecord[]> {
  const db = await openMirrorDb(dbName);
  return db.getAllFromIndex('local_matches', 'created_at');
}

export async function getLocalMatchesForPlayer(
  playerId: string,
  limit?: number,
  dbName = MIRROR_DB_NAME
): Promise<LocalMatchRecord[]> {
  const db = await openMirrorDb(dbName);
  const rows = await db.getAllFromIndex('local_matches', 'created_at');
  let playerRows = rows.filter(r => r.player_id === playerId);
  playerRows.reverse(); // Newest first
  if (limit) {
    playerRows = playerRows.slice(0, limit);
  }
  return playerRows;
}

export async function getRecentLocalMatches(
  limit?: number,
  dbName = MIRROR_DB_NAME
): Promise<LocalMatchRecord[]> {
  const db = await openMirrorDb(dbName);
  const rows = await db.getAllFromIndex('local_matches', 'created_at');
  rows.reverse();
  if (limit) {
    return rows.slice(0, limit);
  }
  return rows;
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

function createV2Schema(db: IDBPDatabase<MirrorDB>): void {
  const localMatches = db.createObjectStore('local_matches', { keyPath: 'id' });
  localMatches.createIndex('created_at', 'created_at');
}

function makeId(prefix: string): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}
