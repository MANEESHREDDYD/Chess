import { describe, it, expect, beforeEach } from 'vitest';
import { openMirrorDb, initializeStoryProgressForPlayer, getStoryProgressForPlayer, completeStoryChapter } from '../data/db';

const TEST_PLAYER_ID = 'test-player-story-123';

describe('Story Progress', () => {
  beforeEach(async () => {
    const db = await openMirrorDb();
    const tx = db.transaction('story_progress', 'readwrite');
    // Clear only this player's data to avoid nuking other test data unnecessarily, 
    // though IndexedDB in memory is generally fresh per test run anyway in vitest+fake-indexeddb.
    const store = tx.objectStore('story_progress');
    const all = await store.getAll();
    for (const record of all) {
      if (record.player_id === TEST_PLAYER_ID) {
        await store.delete(record.id);
      }
    }
    await tx.done;
  });

  it('initializes story progress correctly', async () => {
    await initializeStoryProgressForPlayer(TEST_PLAYER_ID);
    const progress = await getStoryProgressForPlayer(TEST_PLAYER_ID);
    
    // We expect exactly 7 seeded chapters from mahabharataStorySeed
    expect(progress.length).toBe(7);
    
    const ch1 = progress.find(p => p.chapter_id === 'ch1_apprentice_arrives');
    expect(ch1?.status).toBe('available');
    
    const ch2 = progress.find(p => p.chapter_id === 'ch2_honest_move');
    expect(ch2?.status).toBe('locked');
  });

  it('initializeStoryProgressForPlayer does not create duplicate progress rows when called twice', async () => {
    await initializeStoryProgressForPlayer(TEST_PLAYER_ID);
    const firstProgress = await getStoryProgressForPlayer(TEST_PLAYER_ID);
    expect(firstProgress.length).toBe(7);

    // Call it again
    await initializeStoryProgressForPlayer(TEST_PLAYER_ID);
    const secondProgress = await getStoryProgressForPlayer(TEST_PLAYER_ID);
    
    // Should still be exactly 7
    expect(secondProgress.length).toBe(7);
  });

  it('safely handles migration for existing players with 3-chapter progress', async () => {
    const db = await openMirrorDb();
    
    // 1. Manually insert the first 3 chapters to simulate a v1.7.0 player
    const v1_7_chapters = ['ch1_apprentice_arrives', 'ch2_honest_move', 'ch3_fork_in_field'];
    const tx = db.transaction('story_progress', 'readwrite');
    for (const chapter_id of v1_7_chapters) {
      await tx.store.put({
        id: `${TEST_PLAYER_ID}_${chapter_id}`,
        player_id: TEST_PLAYER_ID,
        chapter_id,
        status: chapter_id === 'ch1_apprentice_arrives' ? 'complete' : 'available', // Let's say ch1 is complete
        attempts: 1,
        updated_at: new Date().toISOString(),
      });
    }
    await tx.done;

    // Verify they only have 3 chapters initially
    const initialProgress = await getStoryProgressForPlayer(TEST_PLAYER_ID);
    expect(initialProgress.length).toBe(3);
    expect(initialProgress.find(p => p.chapter_id === 'ch1_apprentice_arrives')?.status).toBe('complete');

    // 2. Call the initialize function, simulating the player opening the app after the Act 1 update
    await initializeStoryProgressForPlayer(TEST_PLAYER_ID);

    // 3. Verify they now have 7 chapters and old progress was retained
    const newProgress = await getStoryProgressForPlayer(TEST_PLAYER_ID);
    expect(newProgress.length).toBe(7);
    
    const ch1 = newProgress.find(p => p.chapter_id === 'ch1_apprentice_arrives');
    expect(ch1?.status).toBe('complete'); // Ensure old progress wasn't overwritten
    
    const ch4 = newProgress.find(p => p.chapter_id === 'ch4_direct_path');
    expect(ch4).toBeDefined();
    expect(ch4?.status).toBe('locked'); // New chapters should be locked
  });

  it('completes a chapter and unlocks the next', async () => {
    await initializeStoryProgressForPlayer(TEST_PLAYER_ID);
    
    await completeStoryChapter(TEST_PLAYER_ID, 'ch1_apprentice_arrives', 'win');
    
    const progress = await getStoryProgressForPlayer(TEST_PLAYER_ID);
    
    const ch1 = progress.find(p => p.chapter_id === 'ch1_apprentice_arrives');
    expect(ch1?.status).toBe('complete');
    expect(ch1?.attempts).toBe(1);
    expect(ch1?.best_result).toBe('win');
    
    const ch2 = progress.find(p => p.chapter_id === 'ch2_honest_move');
    expect(ch2?.status).toBe('available');
    
    const ch3 = progress.find(p => p.chapter_id === 'ch3_fork_in_field');
    expect(ch3?.status).toBe('locked');

    // Completing up to ch6 unlocks ch7
    await completeStoryChapter(TEST_PLAYER_ID, 'ch2_honest_move', 'win');
    await completeStoryChapter(TEST_PLAYER_ID, 'ch3_fork_in_field', 'win');
    await completeStoryChapter(TEST_PLAYER_ID, 'ch4_direct_path', 'win');
    await completeStoryChapter(TEST_PLAYER_ID, 'ch5_teachers_position', 'win');
    await completeStoryChapter(TEST_PLAYER_ID, 'ch6_risk_of_fire', 'win');

    const finalProgress = await getStoryProgressForPlayer(TEST_PLAYER_ID);
    const ch7 = finalProgress.find(p => p.chapter_id === 'ch7_difficult_choice');
    expect(ch7?.status).toBe('available');
  });
});
