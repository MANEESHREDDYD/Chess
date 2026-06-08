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
    
    // We expect exactly 3 seeded chapters from mahabharataStorySeed
    expect(progress.length).toBe(3);
    
    const ch1 = progress.find(p => p.chapter_id === 'ch1_apprentice_arrives');
    expect(ch1?.status).toBe('available');
    
    const ch2 = progress.find(p => p.chapter_id === 'ch2_honest_move');
    expect(ch2?.status).toBe('locked');
  });

  it('initializeStoryProgressForPlayer does not create duplicate progress rows when called twice', async () => {
    await initializeStoryProgressForPlayer(TEST_PLAYER_ID);
    const firstProgress = await getStoryProgressForPlayer(TEST_PLAYER_ID);
    expect(firstProgress.length).toBe(3);

    // Call it again
    await initializeStoryProgressForPlayer(TEST_PLAYER_ID);
    const secondProgress = await getStoryProgressForPlayer(TEST_PLAYER_ID);
    
    // Should still be exactly 3
    expect(secondProgress.length).toBe(3);
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
  });
});
