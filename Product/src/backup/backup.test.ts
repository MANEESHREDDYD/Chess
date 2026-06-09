import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportMirrorBackup, validateBackupFile, importMirrorBackup } from './backupService';
import { openMirrorDb, MIRROR_DB_NAME } from '../data/db';
import 'fake-indexeddb/auto';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
})();
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('Backup Service', () => {
  beforeEach(async () => {
    // Clear DB
    const db = await openMirrorDb(MIRROR_DB_NAME);
    type StoreName =
      | 'players'
      | 'calibration_runs'
      | 'style_vectors'
      | 'mirror_matches'
      | 'feedback'
      | 'local_matches'
      | 'saved_analyses'
      | 'clue_attempts'
      | 'story_progress'
      | 'achievements'
      | 'puzzle_reviews'
      | 'account_links';
    const storeNames = Array.from(db.objectStoreNames) as StoreName[];
    if (storeNames.length > 0) {
      const tx = db.transaction(storeNames, 'readwrite');
      for (const storeName of storeNames) {
        await tx.objectStore(storeName).clear();
      }
      await tx.done;
    }
    
    mockLocalStorage.clear();
  });

  it('exports active player and all data correctly', async () => {
    const db = await openMirrorDb(MIRROR_DB_NAME);
    
    // Setup dummy data
    await db.put('players', { id: 'p1', display_name: 'Player 1', created_at: '2020-01-01', updated_at: '2020-01-01' });
    await db.put('players', { id: 'p2', display_name: 'Player 2', created_at: '2020-01-01', updated_at: '2020-01-01' });
    
    await db.put('local_matches', { 
      id: 'm1', player_id: 'p1', mode: 'computer', side: 'white', actual_side: 'white', 
      difficulty: 'Beginner', result: 'draw', result_label: 'Draw', pgn: '', move_count: 0, 
      created_at: '2020-01-01', completed_at: '2020-01-01' 
    });
    await db.put('local_matches', { 
      id: 'm2', player_id: 'p2', mode: 'computer', side: 'white', actual_side: 'white', 
      difficulty: 'Beginner', result: 'draw', result_label: 'Draw', pgn: '', move_count: 0, 
      created_at: '2020-01-01', completed_at: '2020-01-01' 
    });

    mockLocalStorage.setItem('mirror-settings', JSON.stringify({ state: { activeTheme: 'dark' } }));

    // Export active player
    const backupActive = await exportMirrorBackup('p1');
    expect(backupActive.schema_version).toBe(1);
    expect(backupActive.app_name).toBe('MIRROR');
    expect(backupActive.data.players.length).toBe(1);
    expect(backupActive.data.players[0].id).toBe('p1');
    expect(backupActive.data.local_matches.length).toBe(1);
    expect(backupActive.data.local_matches[0].id).toBe('m1');
    expect(backupActive.data.settings['mirror-settings']).toBeDefined();

    // Export all data
    const backupAll = await exportMirrorBackup();
    expect(backupAll.data.players.length).toBe(2);
    expect(backupAll.data.local_matches.length).toBe(2);
  });

  it('validates backup files correctly', () => {
    const valid = {
      schema_version: 1,
      app_name: 'MIRROR',
      data: { players: [{ id: 'p1' }] }
    };

    expect(() => validateBackupFile(valid)).not.toThrow();

    const invalidApp = { ...valid, app_name: 'OTHER' };
    expect(() => validateBackupFile(invalidApp)).toThrow(/app_name is not "MIRROR"/);

    const invalidType = 'string';
    expect(() => validateBackupFile(invalidType)).toThrow(/Not a JSON object/);

    const invalidDataArray = { ...valid, data: { players: 'not array' } };
    expect(() => validateBackupFile(invalidDataArray)).toThrow(/must be an array/);
    
    const missingId = { ...valid, data: { players: [{ name: 'test' }] } };
    expect(() => validateBackupFile(missingId)).toThrow(/missing an 'id'/);
  });

  it('imports using merge strategy correctly', async () => {
    const db = await openMirrorDb(MIRROR_DB_NAME);
    
    // Existing record
    await db.put('players', { id: 'p1', display_name: 'Old Name', created_at: '2020-01-01', updated_at: '2020-01-01' });

    const backupFile = {
      schema_version: 1,
      app_name: "MIRROR" as const,
      created_at: '2020-01-02',
      data: {
        players: [
          { id: 'p1', display_name: 'New Name', created_at: '2020-01-01', updated_at: '2020-01-02' }, // newer
          { id: 'p2', display_name: 'P2', created_at: '2020-01-01', updated_at: '2020-01-01' } // new
        ],
        local_matches: [],
        mirror_matches: [],
        calibration_runs: [],
        style_vectors: [],
        saved_analyses: [],
        clue_attempts: [],
        puzzle_reviews: [],
        story_progress: [],
        achievements: [],
        account_links: [],
        settings: {}
      }
    };

    await importMirrorBackup(backupFile, { mode: 'merge' });

    const p1 = await db.get('players', 'p1');
    expect(p1?.display_name).toBe('New Name');

    const p2 = await db.get('players', 'p2');
    expect(p2?.display_name).toBe('P2');
  });

  it('preserves stronger puzzle review and complete story progress during merge', async () => {
    const db = await openMirrorDb(MIRROR_DB_NAME);
    
    // Existing record: story complete, review strong
    await db.put('story_progress', { 
      id: 'p1:c1', player_id: 'p1', chapter_id: 'c1', status: 'complete', updated_at: '2020-01-01', attempts: 1 
    });
    
    await db.put('puzzle_reviews', {
      id: 'p1:rev1', player_id: 'p1', puzzle_id: 'rev1', motif: 'fork',
      interval_days: 7, ease: 2.5, attempts: 3, lapses: 0, solved_streak: 3,
      last_result: 'solved', next_due_at: '2020-01-08', updated_at: '2020-01-01'
    });

    const backupFile = {
      schema_version: 1,
      app_name: "MIRROR" as const,
      created_at: '2020-01-02',
      data: {
        players: [], local_matches: [], mirror_matches: [], calibration_runs: [], style_vectors: [], saved_analyses: [], clue_attempts: [], achievements: [], account_links: [], settings: {},
        story_progress: [
          // Even though updated_at is newer, it's 'locked', so merge should reject downgrade
          { id: 'p1:c1', player_id: 'p1', chapter_id: 'c1', status: 'locked' as const, updated_at: '2020-01-02', attempts: 0 }
        ],
        puzzle_reviews: [
          // Newer updated_at, but lower solved_streak, merge should reject
          {
            id: 'p1:rev1', player_id: 'p1', puzzle_id: 'rev1', motif: 'fork',
            interval_days: 1, ease: 2.0, attempts: 4, lapses: 1, solved_streak: 0,
            last_result: 'failed' as const, next_due_at: '2020-01-02', updated_at: '2020-01-02'
          }
        ]
      }
    };

    await importMirrorBackup(backupFile, { mode: 'merge' });

    const story = await db.get('story_progress', 'p1:c1');
    expect(story?.status).toBe('complete'); // Not downgraded

    const review = await db.get('puzzle_reviews', 'p1:rev1');
    expect(review?.solved_streak).toBe(3); // Preserved stronger
  });

  it('idempotently merges achievements', async () => {
    const db = await openMirrorDb(MIRROR_DB_NAME);
    
    await db.put('achievements', { id: 'p1:ach1', player_id: 'p1', achievement_id: 'ach1', title: 'T', earned_at: '2020-01-01' });

    const backupFile = {
      schema_version: 1,
      app_name: "MIRROR" as const,
      created_at: '2020-01-02',
      data: {
        players: [], local_matches: [], mirror_matches: [], calibration_runs: [], style_vectors: [], saved_analyses: [], clue_attempts: [], puzzle_reviews: [], story_progress: [], account_links: [], settings: {},
        achievements: [
          { id: 'p1:ach1', player_id: 'p1', achievement_id: 'ach1', title: 'T', earned_at: '2020-01-01' }
        ]
      }
    };

    await importMirrorBackup(backupFile, { mode: 'merge' });
    const achs = await db.getAll('achievements');
    expect(achs.length).toBe(1); // Didn't duplicate
  });
});
