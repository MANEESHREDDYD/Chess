import { openMirrorDb, MIRROR_DB_NAME, type StoryProgressRecord, type PuzzleReviewRecord } from '../data/db';
import type { MirrorBackupFile, MirrorBackupData } from './backupTypes';

type BackupStoreName =
  | 'players'
  | 'local_matches'
  | 'mirror_matches'
  | 'imported_games'
  | 'calibration_runs'
  | 'style_vectors'
  | 'saved_analyses'
  | 'clue_attempts'
  | 'puzzle_reviews'
  | 'story_progress'
  | 'achievements'
  | 'account_links';

type MergeableBackupRecord = {
  id: string;
  player_id?: string;
  updated_at?: string;
  created_at?: string;
};

function hasRestorableSettings(value: unknown): value is { state: unknown } {
  return typeof value === 'object' && value !== null && 'state' in value;
}

export async function exportMirrorBackup(playerId?: string): Promise<MirrorBackupFile> {
  const db = await openMirrorDb(MIRROR_DB_NAME);
  
  // Fetch all arrays
  const data: MirrorBackupData = {
    players: await db.getAll('players'),
    local_matches: await db.getAll('local_matches'),
    mirror_matches: await db.getAll('mirror_matches'),
    imported_games: await db.getAll('imported_games'),
    calibration_runs: await db.getAll('calibration_runs'),
    style_vectors: await db.getAll('style_vectors'),
    saved_analyses: await db.getAll('saved_analyses'),
    clue_attempts: await db.getAll('clue_attempts'),
    puzzle_reviews: await db.getAll('puzzle_reviews'),
    story_progress: await db.getAll('story_progress'),
    achievements: await db.getAll('achievements'),
    account_links: await db.getAll('account_links'),
    settings: {}
  };

  // Only include settings if it's the active player export, or all data export
  try {
    const rawSettings = localStorage.getItem('mirror-settings');
    if (rawSettings) {
      data.settings['mirror-settings'] = JSON.parse(rawSettings);
    }
  } catch (e) {
    // Ignore parse errors from localStorage
  }

  // Filter if playerId is provided (active player mode)
  if (playerId) {
    data.players = data.players.filter(x => x.id === playerId);
    data.local_matches = data.local_matches.filter(x => x.player_id === playerId);
    data.mirror_matches = data.mirror_matches.filter(x => x.player_id === playerId);
    data.imported_games = data.imported_games.filter(x => x.player_id === playerId);
    data.calibration_runs = data.calibration_runs.filter(x => x.player_id === playerId);
    data.style_vectors = data.style_vectors.filter(x => x.player_id === playerId);
    data.saved_analyses = data.saved_analyses.filter(x => x.player_id === playerId);
    data.clue_attempts = data.clue_attempts.filter(x => x.player_id === playerId);
    data.puzzle_reviews = data.puzzle_reviews.filter(x => x.player_id === playerId);
    data.story_progress = data.story_progress.filter(x => x.player_id === playerId);
    data.achievements = data.achievements.filter(x => x.player_id === playerId);
    if (data.account_links) {
      data.account_links = data.account_links.filter(x => x.player_id === playerId);
    }
  }

  return {
    schema_version: 1,
    app_name: "MIRROR",
    created_at: new Date().toISOString(),
    exported_by: playerId || 'all-data',
    data
  };
}

export function downloadBackupJson(backup: MirrorBackupFile, mode: 'active-player' | 'all-data'): void {
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  
  const dateStr = new Date().toISOString().replace(/T/, '-').replace(/:/g, '').substring(0, 15);
  a.href = url;
  a.download = `mirror-backup-${mode}-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function validateBackupFile(raw: unknown): MirrorBackupFile {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid backup file: Not a JSON object.');
  }
  
  const rawObj = raw as Record<string, unknown>;
  
  if (rawObj.app_name !== 'MIRROR') {
    throw new Error('Invalid backup file: app_name is not "MIRROR".');
  }
  if (!rawObj.schema_version) {
    throw new Error('Invalid backup file: missing schema_version.');
  }
  if (!rawObj.data || typeof rawObj.data !== 'object') {
    throw new Error('Invalid backup file: missing data block.');
  }

  const dataObj = rawObj.data as Record<string, unknown>;

  const expectArray = (name: keyof MirrorBackupData) => {
    if (dataObj[name] && !Array.isArray(dataObj[name])) {
      throw new Error(`Invalid backup file: data.${name} must be an array if present.`);
    }
  };

  expectArray('players');
  expectArray('local_matches');
  expectArray('mirror_matches');
  expectArray('imported_games');
  expectArray('calibration_runs');
  expectArray('style_vectors');
  expectArray('saved_analyses');
  expectArray('clue_attempts');
  expectArray('puzzle_reviews');
  expectArray('story_progress');
  expectArray('achievements');
  expectArray('account_links');

  if (dataObj.settings && typeof dataObj.settings !== 'object') {
    throw new Error('Invalid backup file: data.settings must be an object if present.');
  }

  // Ensure arrays exist so the rest of the code can just iterate them
  const safeData: MirrorBackupData = {
    players: (dataObj.players as unknown as MirrorBackupData['players']) || [],
    local_matches: (dataObj.local_matches as unknown as MirrorBackupData['local_matches']) || [],
    mirror_matches: (dataObj.mirror_matches as unknown as MirrorBackupData['mirror_matches']) || [],
    imported_games: (dataObj.imported_games as unknown as MirrorBackupData['imported_games']) || [],
    calibration_runs: (dataObj.calibration_runs as unknown as MirrorBackupData['calibration_runs']) || [],
    style_vectors: (dataObj.style_vectors as unknown as MirrorBackupData['style_vectors']) || [],
    saved_analyses: (dataObj.saved_analyses as unknown as MirrorBackupData['saved_analyses']) || [],
    clue_attempts: (dataObj.clue_attempts as unknown as MirrorBackupData['clue_attempts']) || [],
    puzzle_reviews: (dataObj.puzzle_reviews as unknown as MirrorBackupData['puzzle_reviews']) || [],
    story_progress: (dataObj.story_progress as unknown as MirrorBackupData['story_progress']) || [],
    achievements: (dataObj.achievements as unknown as MirrorBackupData['achievements']) || [],
    account_links: (dataObj.account_links as unknown as MirrorBackupData['account_links']) || [],
    settings: (dataObj.settings as Record<string, unknown>) || {}
  };

  // Check required IDs
  const validateIds = (arr: unknown[], storeName: string) => {
    for (const item of arr) {
      if (!item || typeof item !== 'object' || !('id' in item) || !item.id) {
        throw new Error(`Invalid backup file: A record in ${storeName} is missing an 'id' field.`);
      }
    }
  };

  validateIds(safeData.players, 'players');
  validateIds(safeData.local_matches, 'local_matches');
  validateIds(safeData.mirror_matches, 'mirror_matches');
  validateIds(safeData.imported_games, 'imported_games');
  validateIds(safeData.calibration_runs, 'calibration_runs');
  validateIds(safeData.style_vectors, 'style_vectors');
  validateIds(safeData.saved_analyses, 'saved_analyses');
  validateIds(safeData.clue_attempts, 'clue_attempts');
  validateIds(safeData.puzzle_reviews, 'puzzle_reviews');
  validateIds(safeData.story_progress, 'story_progress');
  validateIds(safeData.achievements, 'achievements');
  if (safeData.account_links) {
    validateIds(safeData.account_links, 'account_links');
  }

  return {
    ...(rawObj as Record<string, unknown>),
    data: safeData
  } as unknown as MirrorBackupFile;
}

export function getBackupSummary(backup: MirrorBackupFile) {
  const d = backup.data;
  return {
    schema_version: backup.schema_version,
    players: d.players.length,
    matches: d.local_matches.length + d.mirror_matches.length,
    imported_games: d.imported_games.length,
    analyses: d.saved_analyses.length,
    clue_attempts: d.clue_attempts.length,
    puzzle_reviews: d.puzzle_reviews.length,
    achievements: d.achievements.length,
    story_progress: d.story_progress.filter((s: StoryProgressRecord) => s.status === 'complete').length,
    has_settings: Object.keys(d.settings || {}).length > 0
  };
}

export interface ImportOptions {
  mode: 'merge' | 'replace';
  importSettings?: boolean;
  replacePlayerId?: string; // If mode is 'replace', we only wipe data for this specific player. If null, we wipe all.
}

export async function importMirrorBackup(backup: MirrorBackupFile, options: ImportOptions): Promise<void> {
  const db = await openMirrorDb(MIRROR_DB_NAME);
  const data = backup.data;
  
  if (options.mode === 'replace') {
    // If replace mode, we need to delete existing data.
    // If replacePlayerId is set, delete only that player's data. Otherwise wipe everything.
    const stores = [
      'players', 'local_matches', 'mirror_matches', 'imported_games', 'calibration_runs',
      'style_vectors', 'saved_analyses', 'clue_attempts', 'puzzle_reviews',
      'story_progress', 'achievements', 'account_links'
    ] as const;

    for (const storeName of stores) {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      if (options.replacePlayerId) {
        if (storeName === 'players') {
          await store.delete(options.replacePlayerId);
        } else {
          // Iterate and delete by player_id
          const all = await store.getAll();
          for (const record of all as MergeableBackupRecord[]) {
            if (record.player_id === options.replacePlayerId) {
              await store.delete(record.id);
            }
          }
        }
      } else {
        await store.clear();
      }
      await tx.done;
    }
  }

  // Helper for safe merging
  const mergeRecords = async <T extends MergeableBackupRecord>(
    storeName: BackupStoreName,
    records: T[], 
    resolveConflict?: (local: T, remote: T) => T
  ) => {
    if (!records || records.length === 0) return;
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    for (const remote of records) {
      const local = await store.get(remote.id) as T | undefined;
      if (!local) {
        // Safe to insert
        await store.put(remote as never);
      } else {
        // Conflict resolution
        let merged = null;
        if (resolveConflict) {
          merged = resolveConflict(local, remote);
        } else {
          // Default merge logic by updated_at or created_at
          const localDate = local.updated_at || local.created_at;
          const remoteDate = remote.updated_at || remote.created_at;
          
          if (remoteDate && localDate) {
            if (new Date(remoteDate) > new Date(localDate)) {
              merged = remote;
            } else {
              merged = local;
            }
          } else if (remoteDate && !localDate) {
            merged = remote;
          } else {
            merged = local; // default keep local
          }
        }
        
        if (merged === remote) {
          await store.put(remote as never);
        }
      }
    }
    await tx.done;
  };

  await mergeRecords('players', data.players);
  await mergeRecords('local_matches', data.local_matches);
  await mergeRecords('mirror_matches', data.mirror_matches);
  await mergeRecords('imported_games', data.imported_games);
  await mergeRecords('calibration_runs', data.calibration_runs);
  await mergeRecords('style_vectors', data.style_vectors);
  await mergeRecords('saved_analyses', data.saved_analyses);
  await mergeRecords('clue_attempts', data.clue_attempts);
  
  // Custom conflict resolvers
  await mergeRecords('story_progress', data.story_progress, (local: StoryProgressRecord, remote: StoryProgressRecord) => {
    // Never downgrade a complete chapter
    if (local.status === 'complete' && remote.status !== 'complete') return local;
    if (remote.status === 'complete' && local.status !== 'complete') return remote;
    
    // Fallback to updated_at
    const localDate = local.updated_at ? new Date(local.updated_at) : new Date(0);
    const remoteDate = remote.updated_at ? new Date(remote.updated_at) : new Date(0);
    return remoteDate > localDate ? remote : local;
  });

  await mergeRecords('puzzle_reviews', data.puzzle_reviews, (local: PuzzleReviewRecord, remote: PuzzleReviewRecord) => {
    // Preserve stronger/more recent schedule when possible.
    // Generally prefer higher ease, higher streak, or later next_due_at if they seem more advanced
    if (remote.solved_streak > local.solved_streak) return remote;
    if (local.solved_streak > remote.solved_streak) return local;

    const localDate = local.updated_at ? new Date(local.updated_at) : new Date(0);
    const remoteDate = remote.updated_at ? new Date(remote.updated_at) : new Date(0);
    return remoteDate > localDate ? remote : local;
  });

  // Achievements: Idempotent. If both exist, they are conceptually the same achievement.
  // Standard merge (which keeps local by default) is fine.
  await mergeRecords('achievements', data.achievements);

  if (data.account_links) {
    await mergeRecords('account_links', data.account_links);
  }

  // Settings
  if (options.importSettings && data.settings && data.settings['mirror-settings']) {
    // Basic sanity checks before restoring
    const newSettings = data.settings['mirror-settings'];
    if (hasRestorableSettings(newSettings)) {
      localStorage.setItem('mirror-settings', JSON.stringify(newSettings));
    }
  }
}
