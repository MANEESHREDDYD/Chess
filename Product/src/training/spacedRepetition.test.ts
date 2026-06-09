import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updatePuzzleReviewAfterAttempt,
  getDuePuzzleReviews,
  getReviewQueue,
  addDays,
  isDue
} from './spacedRepetition';
import * as dbModule from '../data/db';

vi.mock('../data/db', async (importOriginal) => {
  const actual = await importOriginal() as typeof dbModule;
  return {
    ...actual,
    openMirrorDb: vi.fn()
  };
});

describe('Spaced Repetition', () => {
  const playerId = 'player1';
  let mockDb: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDb = {
      get: vi.fn(),
      getAllFromIndex: vi.fn(),
      put: vi.fn()
    };

    (dbModule.openMirrorDb as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);
  });

  describe('Date Helpers', () => {
    it('isDue should calculate correctly', () => {
      const now = new Date('2023-01-05T12:00:00Z');
      expect(isDue('2023-01-04T12:00:00Z', now)).toBe(true);
      expect(isDue('2023-01-05T12:00:00Z', now)).toBe(true);
      expect(isDue('2023-01-06T12:00:00Z', now)).toBe(false);
    });

    it('addDays should add correctly', () => {
      const d = new Date('2023-01-01T12:00:00Z');
      const d3 = new Date(addDays(d, 3));
      expect(d3.toISOString().startsWith('2023-01-04')).toBe(true);
    });
  });

  describe('updatePuzzleReviewAfterAttempt', () => {
    it('creates a new record if it does not exist and updates it on first solve', async () => {
      mockDb.get.mockResolvedValue(undefined);
      
      const record = await updatePuzzleReviewAfterAttempt(playerId, 'puzzle1', 'fork', 'casual', false, 'solved');
      expect(record.attempts).toBe(1);
      expect(record.solved_streak).toBe(1);
      expect(record.interval_days).toBe(1);
      expect(record.lapses).toBe(0);
      expect(record.last_result).toBe('solved');
      expect(mockDb.put).toHaveBeenCalledWith('puzzle_reviews', record);
    });

    it('creates a new record and sets due today on failure', async () => {
      mockDb.get.mockResolvedValue(undefined);
      
      const record = await updatePuzzleReviewAfterAttempt(playerId, 'puzzle2', 'pin', 'casual', false, 'failed');
      expect(record.attempts).toBe(1);
      expect(record.solved_streak).toBe(0);
      expect(record.interval_days).toBe(0);
      expect(record.lapses).toBe(1);
      expect(isDue(record.next_due_at, new Date())).toBe(true);
    });

    it('resets solved_streak on failure and increments lapses', async () => {
      mockDb.get.mockResolvedValue({
        id: `${playerId}:p3`, player_id: playerId, puzzle_id: 'p3', motif: 'fork',
        next_due_at: '2025-01-01T00:00:00Z', interval_days: 14, ease: 2.5, attempts: 4, lapses: 0, solved_streak: 4,
        last_result: 'solved', updated_at: '2023-01-01T00:00:00Z'
      });

      const record = await updatePuzzleReviewAfterAttempt(playerId, 'p3', 'fork', 'casual', false, 'failed');
      expect(record.solved_streak).toBe(0);
      expect(record.lapses).toBe(1);
      expect(record.interval_days).toBe(0);
      expect(isDue(record.next_due_at, new Date())).toBe(true);
    });

    it('increases interval properly on consecutive solves', async () => {
      const record1 = await updatePuzzleReviewAfterAttempt(playerId, 'p4', 'fork', 'casual', false, 'solved');
      expect(record1.interval_days).toBe(1);

      mockDb.get.mockResolvedValue(record1);
      const record2 = await updatePuzzleReviewAfterAttempt(playerId, 'p4', 'fork', 'casual', false, 'solved');
      expect(record2.interval_days).toBe(3);

      mockDb.get.mockResolvedValue(record2);
      const record3 = await updatePuzzleReviewAfterAttempt(playerId, 'p4', 'fork', 'casual', false, 'solved');
      expect(record3.interval_days).toBe(7);
      
      mockDb.get.mockResolvedValue(record3);
      const record4 = await updatePuzzleReviewAfterAttempt(playerId, 'p4', 'fork', 'casual', false, 'solved');
      expect(record4.interval_days).toBe(14);
      
      mockDb.get.mockResolvedValue(record4);
      const record5 = await updatePuzzleReviewAfterAttempt(playerId, 'p4', 'fork', 'casual', false, 'solved');
      expect(record5.interval_days).toBe(30);
    });
  });

  describe('Queue and Filtering', () => {
    it('returns only due records', async () => {
      const now = new Date('2023-01-05T12:00:00Z');
      mockDb.getAllFromIndex.mockResolvedValue([
        { id: '1', next_due_at: '2023-01-04T12:00:00Z' }, // due
        { id: '2', next_due_at: '2023-01-05T12:00:00Z' }, // due
        { id: '3', next_due_at: '2023-01-06T12:00:00Z' }  // not due
      ]);

      const due = await getDuePuzzleReviews(playerId, now);
      expect(due.length).toBe(2);
      expect(due.map(d => d.id)).toEqual(['1', '2']);
    });

    it('getReviewQueue prioritizes lapses and multi-move', async () => {
      const now = new Date('2023-01-05T12:00:00Z');
      mockDb.getAllFromIndex.mockResolvedValue([
        { id: '1', next_due_at: '2023-01-05T12:00:00Z', lapses: 0, is_multi_move: false },
        { id: '2', next_due_at: '2023-01-05T12:00:00Z', lapses: 2, is_multi_move: false },
        { id: '3', next_due_at: '2023-01-05T12:00:00Z', lapses: 2, is_multi_move: true },
        { id: '4', next_due_at: '2023-01-04T12:00:00Z', lapses: 0, is_multi_move: false },
      ]);

      const queue = await getReviewQueue(playerId, now);
      expect(queue.length).toBe(4);
      // 3 should be first (lapses 2, multi move true)
      // 2 should be second (lapses 2, multi move false)
      // 4 should be third (lapses 0, but older due date)
      // 1 should be last (lapses 0, newer due date)
      expect(queue.map(q => q.id)).toEqual(['3', '2', '4', '1']);
    });
  });
});
