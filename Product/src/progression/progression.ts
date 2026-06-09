import {
  openMirrorDb,
  type AchievementRecord,
  type PlayerRecord
} from '../data/db';
import { mahabharataStorySeed } from '../story/mahabharataStorySeed';
import { getDuePuzzleReviews } from '../training/spacedRepetition';

export interface PlayerProgressSummary {
  player_id: string;
  total_games: number;
  total_mirror_matches: number;
  total_analyses: number;
  clue_attempts: number;
  clue_solved: number;
  clue_solved_rate: number;
  multi_move_attempts: number;
  multi_move_solved: number;
  story_chapters_complete: number;
  story_total_chapters: number;
  current_story_chapter?: string;
  current_streak_days: number;
  best_streak_days: number;
  total_xp: number;
  level: number;
  strongest_motif?: string;
  weakest_motif?: string;
  achievements: AchievementRecord[];
  due_reviews_count: number;
  next_action: string;
  updated_at: string;
}

const XP_RULES = {
  REGULAR_GAME: 10,
  MIRROR_MATCH: 20,
  ANALYSIS: 10,
  CLUE_SINGLE: 15,
  CLUE_MULTI: 30,
  STORY_CHAPTER: 25,
  ACT_1_COMPLETE: 100,
  ACT_2_COMPLETE: 150
};

function toLocalYMD(dateString?: string | number | Date): string | null {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getPlayerProgressSummary(playerId: string): Promise<PlayerProgressSummary> {
  const db = await openMirrorDb();

  const [
    localMatches,
    mirrorMatches,
    analyses,
    clueAttempts,
    storyProgress,
    achievements,
    player,
    dueReviews
  ] = await Promise.all([
    db.getAll('local_matches'),
    db.getAll('mirror_matches'),
    db.getAllFromIndex('saved_analyses', 'player_id', playerId),
    db.getAllFromIndex('clue_attempts', 'player_id', playerId),
    db.getAllFromIndex('story_progress', 'player_id', playerId),
    db.getAllFromIndex('achievements', 'player_id', playerId),
    db.get('players', playerId),
    getDuePuzzleReviews(playerId, new Date())
  ]);

  const playerLocalMatches = localMatches.filter(m => m.player_id === playerId);
  const filteredMirrorMatches = mirrorMatches.filter(m => m.player_id === playerId);

  const completedGames = playerLocalMatches.filter(m => m.result !== 'abandoned');
  const completedMirror = filteredMirrorMatches.filter(m => !!m.completed_at);
  const solvedClues = clueAttempts.filter(c => c.solved);
  
  const multiMoveAttempts = clueAttempts.filter(c => (c.total_steps || 0) > 1);
  const multiMoveSolved = multiMoveAttempts.filter(c => c.solved);

  const completedChapters = storyProgress.filter(s => s.status === 'complete');
  
  // Act completion check
  const act1Chapters = mahabharataStorySeed.filter(c => c.act_number === 1).map(c => c.id);
  const act2Chapters = mahabharataStorySeed.filter(c => c.act_number === 2).map(c => c.id);
  
  const act1Complete = act1Chapters.every(id => completedChapters.some(c => c.chapter_id === id));
  const act2Complete = act2Chapters.every(id => completedChapters.some(c => c.chapter_id === id));

  let totalXp = 0;
  totalXp += completedGames.length * XP_RULES.REGULAR_GAME;
  totalXp += completedMirror.length * XP_RULES.MIRROR_MATCH;
  totalXp += analyses.length * XP_RULES.ANALYSIS;
  
  for (const clue of solvedClues) {
    if ((clue.total_steps || 0) > 1) {
      totalXp += XP_RULES.CLUE_MULTI;
    } else {
      totalXp += XP_RULES.CLUE_SINGLE;
    }
  }

  totalXp += completedChapters.length * XP_RULES.STORY_CHAPTER;
  if (act1Complete) totalXp += XP_RULES.ACT_1_COMPLETE;
  if (act2Complete) totalXp += XP_RULES.ACT_2_COMPLETE;

  const level = Math.floor(Math.sqrt(totalXp / 100)) + 1;

  // Streak Calculation
  const dates = new Set<string>();
  for (const m of playerLocalMatches) {
    const ymd = toLocalYMD(m.created_at);
    if (ymd) dates.add(ymd);
  }
  for (const m of filteredMirrorMatches) {
    const ymd = toLocalYMD(m.started_at);
    if (ymd) dates.add(ymd);
  }
  for (const a of analyses) {
    const ymd = toLocalYMD(a.created_at);
    if (ymd) dates.add(ymd);
  }
  for (const c of clueAttempts) {
    const ymd = toLocalYMD(c.created_at);
    if (ymd) dates.add(ymd);
  }
  for (const s of storyProgress) {
    const ymd = toLocalYMD(s.updated_at);
    if (ymd) dates.add(ymd);
  }

  const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));
  
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  
  if (sortedDates.length > 0) {
    const today = toLocalYMD(new Date())!;
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = toLocalYMD(yesterdayDate)!;
    
    // Check if the streak is currently alive
    const streakAlive = sortedDates[0] === today || sortedDates[0] === yesterday;
    
    // Calculate current streak
    if (streakAlive) {
      currentStreak = 1;
      const checkDate = new Date(sortedDates[0]);
      for (let i = 1; i < sortedDates.length; i++) {
        checkDate.setDate(checkDate.getDate() - 1);
        const expectedYMD = toLocalYMD(checkDate);
        if (sortedDates[i] === expectedYMD) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate best streak
    tempStreak = 1;
    bestStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i-1]);
      prevDate.setDate(prevDate.getDate() - 1);
      const expectedYMD = toLocalYMD(prevDate);
      
      if (sortedDates[i] === expectedYMD) {
        tempStreak++;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      } else {
        tempStreak = 1;
      }
    }
  }

  // Motifs
  const motifCounts: Record<string, { attempts: number, solved: number }> = {};
  for (const c of clueAttempts) {
    if (!c.motif) continue;
    if (!motifCounts[c.motif]) motifCounts[c.motif] = { attempts: 0, solved: 0 };
    motifCounts[c.motif].attempts++;
    if (c.solved) motifCounts[c.motif].solved++;
  }
  
  let strongestMotif: string | undefined;
  let weakestMotif: string | undefined;
  let maxRate = -1;
  let minRate = 2;

  for (const [motif, stats] of Object.entries(motifCounts)) {
    if (stats.attempts < 3) continue; // need min sample
    const rate = stats.solved / stats.attempts;
    if (rate > maxRate) {
      maxRate = rate;
      strongestMotif = motif;
    }
    if (rate < minRate) {
      minRate = rate;
      weakestMotif = motif;
    }
  }

  const clueSolvedRate = clueAttempts.length > 0 ? (solvedClues.length / clueAttempts.length) * 100 : 0;
  
  const availableStory = storyProgress.find(s => s.status === 'available');
  const currentChapter = availableStory?.chapter_id;

  const summary: PlayerProgressSummary = {
    player_id: playerId,
    total_games: playerLocalMatches.length,
    total_mirror_matches: filteredMirrorMatches.length,
    total_analyses: analyses.length,
    clue_attempts: clueAttempts.length,
    clue_solved: solvedClues.length,
    clue_solved_rate: clueSolvedRate,
    multi_move_attempts: multiMoveAttempts.length,
    multi_move_solved: multiMoveSolved.length,
    story_chapters_complete: completedChapters.length,
    story_total_chapters: mahabharataStorySeed.length,
    current_story_chapter: currentChapter,
    current_streak_days: currentStreak,
    best_streak_days: bestStreak,
    total_xp: totalXp,
    level,
    strongest_motif: strongestMotif,
    weakest_motif: weakestMotif,
    achievements: achievements.sort((a, b) => b.earned_at.localeCompare(a.earned_at)),
    due_reviews_count: dueReviews.length,
    next_action: "",

    updated_at: new Date().toISOString()
  };

  summary.next_action = getRecommendedNextAction(summary, player);

  return summary;
}

export function getRecommendedNextAction(summary: PlayerProgressSummary, player?: PlayerRecord): string {
  if (!player) return "Prompt onboarding flow.";
  if (!player.calibration_status || player.calibration_status !== 'complete') {
    return "Complete calibration to unlock personalized Mirror.";
  }
  if (summary.due_reviews_count > 0) {
    return `Review ${summary.due_reviews_count} due puzzle${summary.due_reviews_count > 1 ? 's' : ''} in Clue Chess.`;
  }
  if (summary.total_mirror_matches === 0) {
    return "Play your first Mirror match.";
  }
  if (summary.weakest_motif) {
    const formatted = summary.weakest_motif.replace(/_/g, ' ');
    return `Train your weakest motif (${formatted}) in Clue Chess.`;
  }
  if (summary.current_story_chapter) {
    const ch = mahabharataStorySeed.find(c => c.id === summary.current_story_chapter);
    return `Continue Story Mode: ${ch?.title || 'Next Chapter'}.`;
  }
  if (summary.total_games > 0 && summary.total_analyses === 0) {
    return "Analyze your latest game.";
  }
  if (summary.current_streak_days > 0) {
    return "Keep your streak alive today!";
  }
  return "Play a match to start your streak.";
}

export async function scanAndGrantAchievements(playerId: string): Promise<void> {
  const db = await openMirrorDb();
  const summary = await getPlayerProgressSummary(playerId);
  
  const tx = db.transaction('achievements', 'readwrite');
  const store = tx.objectStore('achievements');
  
  const grant = async (id: string, title: string, description: string) => {
    const fullId = `${playerId}:${id}`;
    const existing = await store.get(fullId);
    if (!existing) {
      await store.put({
        id: fullId,
        player_id: playerId,
        achievement_id: id,
        title,
        description,
        earned_at: new Date().toISOString()
      });
    }
  };

  if (summary.total_mirror_matches > 0) {
    await grant('first_mirror', 'First Mirror Match', 'Completed your first match against the Mirror.');
  }
  if (summary.total_analyses > 0) {
    await grant('first_analysis', 'First Analysis', 'Analyzed a game to find improvements.');
  }
  if (summary.clue_solved > 0) {
    await grant('first_clue', 'First Clue Solved', 'Solved a Clue Chess puzzle.');
  }
  if (summary.multi_move_solved > 0) {
    await grant('first_multi_move', 'First Multi-Move Line', 'Successfully calculated and solved a multi-move sequence.');
  }
  
  // Story acts
  const completedIds = new Set(
    (await db.getAllFromIndex('story_progress', 'player_id', playerId))
      .filter(s => s.status === 'complete')
      .map(s => s.chapter_id)
  );

  const act1Chapters = mahabharataStorySeed.filter(c => c.act_number === 1).map(c => c.id);
  const act2Chapters = mahabharataStorySeed.filter(c => c.act_number === 2).map(c => c.id);
  const act3Chapters = mahabharataStorySeed.filter(c => c.act_number === 3).map(c => c.id);
  
  if (act1Chapters.every(id => completedIds.has(id))) {
    await grant('act_1_complete', 'Act I Complete', 'Finished the first act of the story campaign.');
  }
  
  // Act II Started: Has completed Chapter 7 and played Chapter 8, or completed Chapter 8
  if (completedIds.has(act2Chapters[0]) || 
     ((await db.get('story_progress', `${playerId}_${act2Chapters[0]}`))?.attempts || 0) > 0) {
    await grant('act_2_started', 'Act II Started', 'Entered the second act of the story campaign.');
  }

  if (act2Chapters.every(id => completedIds.has(id))) {
    await grant('act_2_complete', 'Act II Complete', 'Finished the second act of the story campaign.');
  }

  // Act III Started
  if (act3Chapters.length > 0 && (completedIds.has(act3Chapters[0]) || 
     ((await db.get('story_progress', `${playerId}_${act3Chapters[0]}`))?.attempts || 0) > 0)) {
    await grant('act_3_started', 'Act III Started', 'Entered the third act of the story campaign.');
  }

  if (summary.current_streak_days >= 3) {
    await grant('three_day_streak', 'Three-Day Streak', 'Maintained activity for three consecutive days.');
  }
  if (summary.clue_solved >= 10) {
    await grant('ten_puzzles', 'Ten Puzzles Solved', 'Solved ten tactical puzzles in Clue Chess.');
  }

  await tx.done;
}
