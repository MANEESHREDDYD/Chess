import { openMirrorDb, type PuzzleReviewRecord } from '../data/db';

export function toDateKey(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}

export function addDays(date: Date | string | number, days: number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function isDue(nextDueAt: string, now: Date | string | number): boolean {
  return toDateKey(nextDueAt) <= toDateKey(now);
}

export async function getOrCreatePuzzleReview(
  playerId: string,
  puzzleId: string,
  motif: string,
  difficulty: string = 'casual',
  isMultiMove: boolean = false
): Promise<PuzzleReviewRecord> {
  const db = await openMirrorDb();
  const id = `${playerId}:${puzzleId}`;
  const existing = await db.get('puzzle_reviews', id);
  if (existing) return existing;

  const now = new Date().toISOString();
  return {
    id,
    player_id: playerId,
    puzzle_id: puzzleId,
    motif,
    difficulty,
    is_multi_move: isMultiMove,
    next_due_at: now, // New puzzles are due immediately (or rather, haven't been reviewed yet)
    interval_days: 0,
    ease: 2.5,
    attempts: 0,
    lapses: 0,
    solved_streak: 0,
    last_result: 'failed', // Default to failed before first attempt
    updated_at: now,
  };
}

export async function updatePuzzleReviewAfterAttempt(
  playerId: string,
  puzzleId: string,
  motif: string,
  difficulty: string,
  isMultiMove: boolean,
  result: 'solved' | 'failed'
): Promise<PuzzleReviewRecord> {
  const db = await openMirrorDb();

  
  const record = await getOrCreatePuzzleReview(playerId, puzzleId, motif, difficulty, isMultiMove);
  
  const now = new Date();
  record.last_attempt_at = now.toISOString();
  record.attempts += 1;
  record.last_result = result;
  
  if (result === 'failed') {
    record.solved_streak = 0;
    record.lapses += 1;
    record.interval_days = 0;
    record.ease = Math.max(1.3, record.ease - 0.2); // Simple SM-2 ease decrease
    record.next_due_at = now.toISOString(); // Due immediately/today
  } else {
    record.solved_streak += 1;
    record.ease = record.ease + 0.1; // Simple SM-2 ease increase
    
    switch (record.solved_streak) {
      case 1:
        record.interval_days = 1;
        break;
      case 2:
        record.interval_days = 3;
        break;
      case 3:
        record.interval_days = 7;
        break;
      case 4:
        record.interval_days = 14;
        break;
      default:
        record.interval_days = 30; // Max 30 days for now
        break;
    }
    record.next_due_at = addDays(now, record.interval_days);
  }

  record.updated_at = now.toISOString();
  await db.put('puzzle_reviews', record);
  return record;
}

export async function getDuePuzzleReviews(playerId: string, now: Date | string | number = new Date()): Promise<PuzzleReviewRecord[]> {
  const db = await openMirrorDb();
  const allReviews = await db.getAllFromIndex('puzzle_reviews', 'player_id', playerId);
  return allReviews.filter(r => isDue(r.next_due_at, now));
}

export async function getReviewQueue(playerId: string, now: Date | string | number = new Date(), limit: number = 20): Promise<PuzzleReviewRecord[]> {
  const due = await getDuePuzzleReviews(playerId, now);
  
  // Sort priority:
  // 1. Lapses descending (failed recently/often)
  // 2. Multi-move first
  // 3. Oldest next_due_at
  
  due.sort((a, b) => {
    if (b.lapses !== a.lapses) return b.lapses - a.lapses;
    
    const aMulti = a.is_multi_move ? 1 : 0;
    const bMulti = b.is_multi_move ? 1 : 0;
    if (bMulti !== aMulti) return bMulti - aMulti;
    
    return a.next_due_at.localeCompare(b.next_due_at);
  });
  
  return due.slice(0, limit);
}

export async function getReviewStats(playerId: string) {
  const db = await openMirrorDb();
  const allReviews = await db.getAllFromIndex('puzzle_reviews', 'player_id', playerId);
  
  const now = new Date();
  const dueCount = allReviews.filter(r => isDue(r.next_due_at, now)).length;
  
  const totalAttempts = allReviews.reduce((sum, r) => sum + r.attempts, 0);
  const totalLapses = allReviews.reduce((sum, r) => sum + r.lapses, 0);
  const totalSolves = totalAttempts - totalLapses;
  const solveRate = totalAttempts > 0 ? (totalSolves / totalAttempts) * 100 : 0;
  
  // Identify weakest motifs based on lapses
  const motifLapses: Record<string, number> = {};
  for (const r of allReviews) {
    if (r.lapses > 0) {
      motifLapses[r.motif] = (motifLapses[r.motif] || 0) + r.lapses;
    }
  }
  
  const weakMotifs = Object.entries(motifLapses)
    .sort((a, b) => b[1] - a[1])
    .map(e => e[0]);

  return {
    dueCount,
    totalReviews: allReviews.length,
    solveRate,
    weakMotifs
  };
}
