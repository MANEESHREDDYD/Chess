import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { EloBand, StyleVector } from '../ml/styleVector';

export type { EloBand, StyleVector, SwindlePreference } from '../ml/styleVector';

export const MIRROR_DB_NAME = 'mirror-pwa';
export const MIRROR_DB_VERSION = 5;

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

export interface AnalysisSummary {
  total_moves: number;
  analyzed_moves: number;
  average_cp_loss: number;
  accuracy_estimate?: number;
  best_count: number;
  good_count: number;
  inaccuracy_count: number;
  mistake_count: number;
  blunder_count: number;
  missed_tactic_count?: number;
  opening_phase_moves?: number;
  middlegame_phase_moves?: number;
  endgame_phase_moves?: number;
}

export interface AnalysisMove {
  ply: number;
  move_number: number;
  color: "white" | "black";
  san: string;
  uci?: string;
  fen_before: string;
  fen_after: string;
  best_eval_cp?: number;
  played_eval_cp?: number;
  cp_loss?: number;
  classification: "best" | "good" | "inaccuracy" | "mistake" | "blunder" | "book" | "forced" | "unknown";
  best_move?: string;
  best_line?: string[];
  note?: string;
}

// USER-OWNED / MIRROR
export interface AnalysisRecord {
  id: string;
  player_id: string;
  match_id: string;
  match_type: "computer" | "mirror";
  source: "local_stockfish";
  engine_depth: number;
  engine_version?: string;
  status: "pending" | "complete" | "failed";
  created_at: string;
  completed_at?: string;
  pgn: string;
  summary: AnalysisSummary;
  moves: AnalysisMove[];
  metadata?: Record<string, unknown>;
}

export interface ClueAttemptRecord {
  id: string;
  player_id: string;
  puzzle_id: string;
  source: "seed" | "analysis_mistake" | "manual";
  fen: string;
  solution_moves: string[];
  attempted_moves: string[];
  motif?: "fork" | "pin" | "skewer" | "removing_the_defender" | "mate" | "hanging_piece" | "endgame" | "opening" | "unknown";
  difficulty: "beginner" | "casual" | "club" | "strong";
  hints_used: number;
  solved: boolean;
  time_spent_ms?: number;
  started_at: string;
  completed_at?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

import type { StoryProgressRecord } from '../story/storyTypes';
export type { StoryProgressRecord };

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
  saved_analyses: {
    key: string;
    value: AnalysisRecord;
    indexes: {
      player_id: string;
      match_id: string;
      match_type: string;
      created_at: string;
    };
  };
  clue_attempts: {
    key: string;
    value: ClueAttemptRecord;
    indexes: {
      player_id: string;
      puzzle_id: string;
      created_at: string;
      motif: string;
      solved: number; // indexeddb doesn't index booleans well, but we can store true/false and use string/number
    };
  };
  story_progress: {
    key: string;
    value: StoryProgressRecord;
    indexes: {
      player_id: string;
      chapter_id: string;
      status: string;
      updated_at: string;
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
      if (oldVersion < 3) {
        createV3Schema(db);
      }
      if (oldVersion < 4) {
        createV4Schema(db);
      }
      if (oldVersion < 5) {
        createV5Schema(db);
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

// -----------------------------------------------------------------------------
// ANALYSIS API
// -----------------------------------------------------------------------------

export async function putAnalysisRecord(record: AnalysisRecord, dbName = MIRROR_DB_NAME): Promise<void> {
  const db = await openMirrorDb(dbName);
  await db.put('saved_analyses', record);
}

export async function getAnalysisForMatch(matchId: string, dbName = MIRROR_DB_NAME): Promise<AnalysisRecord | undefined> {
  const db = await openMirrorDb(dbName);
  // Match ID is unique per game
  const records = await db.getAllFromIndex('saved_analyses', 'match_id');
  return records.find(r => r.match_id === matchId);
}

export async function getAnalysesForPlayer(playerId: string, limit?: number, dbName = MIRROR_DB_NAME): Promise<AnalysisRecord[]> {
  const db = await openMirrorDb(dbName);
  let rows = await db.getAllFromIndex('saved_analyses', 'player_id', playerId);
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (limit) {
    rows = rows.slice(0, limit);
  }
  return rows;
}

export async function updateAnalysisRecord(id: string, patch: Partial<AnalysisRecord>, dbName = MIRROR_DB_NAME): Promise<AnalysisRecord> {
  const db = await openMirrorDb(dbName);
  const existing = await db.get('saved_analyses', id);
  if (!existing) throw new Error('Analysis record not found');
  const updated = { ...existing, ...patch };
  await db.put('saved_analyses', updated);
  return updated;
}

// -----------------------------------------------------------------------------
// CLUE ATTEMPTS API
// -----------------------------------------------------------------------------

export async function putClueAttempt(record: ClueAttemptRecord, dbName = MIRROR_DB_NAME): Promise<void> {
  const db = await openMirrorDb(dbName);
  await db.put('clue_attempts', record);
}

export async function getClueAttemptsForPlayer(playerId: string, limit?: number, dbName = MIRROR_DB_NAME): Promise<ClueAttemptRecord[]> {
  const db = await openMirrorDb(dbName);
  let rows = await db.getAllFromIndex('clue_attempts', 'player_id', playerId);
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (limit) rows = rows.slice(0, limit);
  return rows;
}

export async function getRecentFailedClueAttempts(playerId: string, limit?: number, dbName = MIRROR_DB_NAME): Promise<ClueAttemptRecord[]> {
  const db = await openMirrorDb(dbName);
  let rows = await db.getAllFromIndex('clue_attempts', 'player_id', playerId);
  rows = rows.filter(r => !r.solved);
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (limit) rows = rows.slice(0, limit);
  return rows;
}

export async function getClueStatsForPlayer(playerId: string, dbName = MIRROR_DB_NAME) {
  const db = await openMirrorDb(dbName);
  const rows = await db.getAllFromIndex('clue_attempts', 'player_id', playerId);
  
  let solved_count = 0;
  let total_hints = 0;
  const motifAttempts: Record<string, number> = {};
  const motifFails: Record<string, number> = {};

  for (const r of rows) {
    if (r.solved) solved_count++;
    total_hints += r.hints_used;
    if (r.motif) {
      motifAttempts[r.motif] = (motifAttempts[r.motif] || 0) + 1;
      if (!r.solved) {
        motifFails[r.motif] = (motifFails[r.motif] || 0) + 1;
      }
    }
  }

  const attempt_count = rows.length;
  const solved_rate = attempt_count > 0 ? solved_count / attempt_count : 0;
  const average_hints_used = attempt_count > 0 ? total_hints / attempt_count : 0;

  let weakest_motif: string | null = null;
  let most_attempted_motif: string | null = null;

  if (attempt_count > 0) {
    const sortedAttempts = Object.entries(motifAttempts).sort((a, b) => b[1] - a[1]);
    if (sortedAttempts.length > 0) most_attempted_motif = sortedAttempts[0][0];

    const sortedFails = Object.entries(motifFails).sort((a, b) => b[1] - a[1]);
    if (sortedFails.length > 0) weakest_motif = sortedFails[0][0];
  }

  return {
    attempt_count,
    solved_count,
    solved_rate,
    average_hints_used,
    weakest_motif,
    most_attempted_motif
  };
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

function createV3Schema(db: IDBPDatabase<MirrorDB>): void {
  const analyses = db.createObjectStore('saved_analyses', { keyPath: 'id' });
  analyses.createIndex('player_id', 'player_id');
  analyses.createIndex('match_id', 'match_id');
  analyses.createIndex('match_type', 'match_type');
  analyses.createIndex('created_at', 'created_at');
}

function createV4Schema(db: IDBPDatabase<MirrorDB>) {
  const store = db.createObjectStore('clue_attempts', { keyPath: 'id' });
  store.createIndex('player_id', 'player_id');
  store.createIndex('puzzle_id', 'puzzle_id');
  store.createIndex('created_at', 'created_at');
  store.createIndex('motif', 'motif');
  store.createIndex('solved', 'solved');
}

function createV5Schema(db: IDBPDatabase<MirrorDB>) {
  const store = db.createObjectStore('story_progress', { keyPath: 'id' });
  store.createIndex('player_id', 'player_id');
  store.createIndex('chapter_id', 'chapter_id');
  store.createIndex('status', 'status');
  store.createIndex('updated_at', 'updated_at');
}

function makeId(prefix: string): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}

// ----------------------------------------------------------------------------
// STORY PROGRESS HELPERS

import { mahabharataStorySeed } from '../story/mahabharataStorySeed';

export async function putStoryProgress(record: StoryProgressRecord): Promise<void> {
  const db = await openMirrorDb();
  await db.put('story_progress', record);
}

export async function getStoryProgressForPlayer(playerId: string): Promise<StoryProgressRecord[]> {
  const db = await openMirrorDb();
  return db.getAllFromIndex('story_progress', 'player_id', playerId);
}

export async function getStoryProgressForChapter(playerId: string, chapterId: string): Promise<StoryProgressRecord | undefined> {
  const db = await openMirrorDb();
  return db.get('story_progress', `${playerId}_${chapterId}`);
}

export async function initializeStoryProgressForPlayer(playerId: string): Promise<void> {
  const db = await openMirrorDb();
  const tx = db.transaction('story_progress', 'readwrite');
  const store = tx.objectStore('story_progress');
  
  // Create an initial record for each chapter only if it doesn't exist
  for (const chapter of mahabharataStorySeed) {
    const recordId = `${playerId}_${chapter.id}`;
    const existing = await store.get(recordId);
    if (!existing) {
      // First chapter is available, others are locked
      const status = chapter.required_previous_chapter_id ? 'locked' : 'available';
      await store.put({
        id: recordId,
        player_id: playerId,
        chapter_id: chapter.id,
        status,
        attempts: 0,
        updated_at: new Date().toISOString()
      });
    }
  }
  await tx.done;
}

export async function completeStoryChapter(
  playerId: string, 
  chapterId: string, 
  result?: 'win' | 'loss' | 'draw'
): Promise<void> {
  const db = await openMirrorDb();
  const tx = db.transaction('story_progress', 'readwrite');
  const store = tx.objectStore('story_progress');

  const recordId = `${playerId}_${chapterId}`;
  const existing = await store.get(recordId);
  
  if (existing) {
    existing.status = 'complete';
    existing.attempts += 1;
    if (result && !existing.best_result) existing.best_result = result;
    if (!existing.completed_at) existing.completed_at = new Date().toISOString();
    existing.updated_at = new Date().toISOString();
    await store.put(existing);
  }

  // Find the next chapter that requires this chapter and unlock it
  const nextChapter = mahabharataStorySeed.find(c => c.required_previous_chapter_id === chapterId);
  if (nextChapter) {
    const nextRecordId = `${playerId}_${nextChapter.id}`;
    const nextExisting = await store.get(nextRecordId);
    if (nextExisting && nextExisting.status === 'locked') {
      nextExisting.status = 'available';
      nextExisting.updated_at = new Date().toISOString();
      await store.put(nextExisting);
    }
  }

  await tx.done;
}
