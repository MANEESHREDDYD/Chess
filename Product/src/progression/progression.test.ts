import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPlayerProgressSummary, scanAndGrantAchievements, getRecommendedNextAction, type PlayerProgressSummary } from './progression';
import * as dbModule from '../data/db';
import { mahabharataStorySeed } from '../story/mahabharataStorySeed';

vi.mock('../data/db', async (importOriginal) => {
  const actual = await importOriginal() as typeof dbModule;
  return {
    ...actual,
    openMirrorDb: vi.fn()
  };
});

describe('Player Progression', () => {
  const playerId = 'player-1';
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDb = {
      getAll: vi.fn().mockResolvedValue([]),
      getAllFromIndex: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue({ id: playerId, calibration_status: 'complete' }),
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(undefined),
          put: vi.fn().mockResolvedValue(undefined),
        }),
        done: Promise.resolve()
      })
    };

    (dbModule.openMirrorDb as any).mockResolvedValue(mockDb);
  });

  it('calculates deterministic XP and level from empty state', async () => {
    const summary = await getPlayerProgressSummary(playerId);
    expect(summary.total_xp).toBe(0);
    expect(summary.level).toBe(1);
    expect(summary.achievements).toEqual([]);
    expect(summary.current_streak_days).toBe(0);
  });

  it('calculates XP correctly for activities', async () => {
    mockDb.getAll.mockImplementation((store: string) => {
      if (store === 'local_matches') return Promise.resolve([
        { player_id: playerId, result: 'white_win', created_at: '2023-01-01' }
      ]);
      if (store === 'mirror_matches') return Promise.resolve([
        { player_id: playerId, completed_at: '2023-01-01' }
      ]);
      return Promise.resolve([]);
    });
    mockDb.getAllFromIndex.mockImplementation((store: string) => {
      if (store === 'clue_attempts') return Promise.resolve([
        { player_id: playerId, solved: true, total_steps: 1 },
        { player_id: playerId, solved: true, total_steps: 3 }
      ]);
      if (store === 'story_progress') return Promise.resolve([
        { player_id: playerId, status: 'complete', chapter_id: 'c1' }
      ]);
      return Promise.resolve([]);
    });

    const summary = await getPlayerProgressSummary(playerId);
    
    // local_match = 10, mirror_match = 20
    // clue single = 15, clue multi = 30
    // story chapter = 25
    // Total = 10 + 20 + 15 + 30 + 25 = 100
    expect(summary.total_xp).toBe(100);
    // Level = floor(sqrt(100/100)) + 1 = 1 + 1 = 2
    expect(summary.level).toBe(2);
  });

  it('calculates Act I and Act II completion XP', async () => {
    const act1Ids = mahabharataStorySeed.filter(c => c.act_number === 1).map(c => c.id);
    const act2Ids = mahabharataStorySeed.filter(c => c.act_number === 2).map(c => c.id);
    
    const storyProgress = [...act1Ids, ...act2Ids].map(id => ({
      player_id: playerId,
      chapter_id: id,
      status: 'complete'
    }));

    mockDb.getAllFromIndex.mockImplementation((store: string) => {
      if (store === 'story_progress') return Promise.resolve(storyProgress);
      return Promise.resolve([]);
    });

    const summary = await getPlayerProgressSummary(playerId);
    
    // chapters XP: 12 * 25 = 300
    // act1: 100
    // act2: 150
    // Total: 550
    expect(summary.total_xp).toBe(550);
  });

  it('calculates clue solved rate and multi-move counts', async () => {
    mockDb.getAllFromIndex.mockImplementation((store: string) => {
      if (store === 'clue_attempts') return Promise.resolve([
        { player_id: playerId, solved: true, total_steps: 1, motif: 'fork' },
        { player_id: playerId, solved: false, total_steps: 1, motif: 'fork' },
        { player_id: playerId, solved: true, total_steps: 2, motif: 'pin' },
        { player_id: playerId, solved: false, total_steps: 2, motif: 'pin' },
      ]);
      return Promise.resolve([]);
    });

    const summary = await getPlayerProgressSummary(playerId);
    expect(summary.clue_attempts).toBe(4);
    expect(summary.clue_solved).toBe(2);
    expect(summary.clue_solved_rate).toBe(50);
    expect(summary.multi_move_attempts).toBe(2);
    expect(summary.multi_move_solved).toBe(1);
  });

  it('calculates streaks across same day, consecutive days, and broken streaks', async () => {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date(today); dayBefore.setDate(dayBefore.getDate() - 2);
    const oldDate = new Date(today); oldDate.setDate(oldDate.getDate() - 10);
    
    mockDb.getAll.mockImplementation((store: string) => {
      if (store === 'local_matches') return Promise.resolve([
        { player_id: playerId, created_at: today.toISOString() },
        { player_id: playerId, created_at: today.toISOString() }, // duplicate same day
        { player_id: playerId, created_at: yesterday.toISOString() },
        { player_id: playerId, created_at: dayBefore.toISOString() },
        { player_id: playerId, created_at: oldDate.toISOString() },
      ]);
      return Promise.resolve([]);
    });

    const summary = await getPlayerProgressSummary(playerId);
    expect(summary.current_streak_days).toBe(3);
    // best streak should also be 3
    expect(summary.best_streak_days).toBe(3);
  });

  it('returns valid recommended next actions', () => {
    const baseSummary: PlayerProgressSummary = {
      player_id: playerId, total_games: 0, total_mirror_matches: 0, total_analyses: 0,
      clue_attempts: 0, clue_solved: 0, clue_solved_rate: 0, multi_move_attempts: 0,
      multi_move_solved: 0, story_chapters_complete: 0, story_total_chapters: 12,
      current_streak_days: 0, best_streak_days: 0, total_xp: 0, level: 1,
      achievements: [], due_reviews_count: 0, next_action: '', updated_at: ''
    };

    expect(getRecommendedNextAction(baseSummary, { id: 'x', display_name: 'x', created_at: 'x', updated_at: 'x' }))
      .toBe("Complete calibration to unlock personalized Mirror.");

    expect(getRecommendedNextAction(baseSummary, { id: 'x', display_name: 'x', created_at: 'x', updated_at: 'x', calibration_status: 'complete' }))
      .toBe("Play your first Mirror match.");
      
    baseSummary.total_mirror_matches = 1;
    baseSummary.weakest_motif = 'fork';
    expect(getRecommendedNextAction(baseSummary, { id: 'x', display_name: 'x', created_at: 'x', updated_at: 'x', calibration_status: 'complete' }))
      .toBe("Train your weakest motif (fork) in Clue Chess.");
  });

  it('grants achievements only once', async () => {
    // Mock enough data to trigger first mirror match achievement
    mockDb.getAll.mockImplementation((store: string) => {
      if (store === 'mirror_matches') return Promise.resolve([{ player_id: playerId, completed_at: '2023-01-01' }]);
      return Promise.resolve([]);
    });

    const mockPut = vi.fn().mockResolvedValue(undefined);
    // simulate achievement doesn't exist yet
    const mockGet = vi.fn().mockResolvedValue(undefined); 
    
    mockDb.transaction.mockReturnValue({
      objectStore: vi.fn().mockReturnValue({
        get: mockGet,
        put: mockPut
      }),
      done: Promise.resolve()
    });

    await scanAndGrantAchievements(playerId);
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut.mock.calls[0][0].achievement_id).toBe('first_mirror');

    // Second run, simulate it already exists
    mockGet.mockResolvedValue({ id: `${playerId}:first_mirror` });
    mockPut.mockClear();

    await scanAndGrantAchievements(playerId);
    expect(mockPut).not.toHaveBeenCalled();
  });
});
