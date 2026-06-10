import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteMirrorDb } from '../data/db';
import { generateClueVariants } from './adaptiveClueEngine';
import {
  getSeenClueVariantIds,
  hasUnseenClueVariant,
  recordClueVariantShown,
  selectUnseenClueVariant,
} from './clueMemory';
import { seedPuzzles } from '../data/cluePuzzles';

afterEach(async () => {
  await deleteMirrorDb();
});

describe('clue memory', () => {
  it('records shown variants and avoids repeats outside review mode', async () => {
    const puzzle = seedPuzzles[0];
    const variants = generateClueVariants(puzzle, 1, 'adaptive');
    const first = selectUnseenClueVariant(variants, [], false);

    expect(first).not.toBeNull();
    await recordClueVariantShown({
      playerId: 'player-memory',
      puzzleId: puzzle.id,
      clueLevel: 1,
      variantId: first!.id,
      mode: 'adaptive',
      attemptContext: 'unit-test',
      shownAt: '2026-06-10T00:00:00.000Z',
    });

    const seen = await getSeenClueVariantIds('player-memory', puzzle.id, 1);
    const second = selectUnseenClueVariant(variants, seen, false);

    expect(seen).toContain(first!.id);
    expect(second?.id).not.toBe(first!.id);
  });

  it('allows repeated clue variants in review mode', () => {
    const variants = generateClueVariants(seedPuzzles[0], 1, 'review');
    const selected = selectUnseenClueVariant(variants, variants.map((variant) => variant.id), true);

    expect(hasUnseenClueVariant(variants, variants.map((variant) => variant.id), true)).toBe(true);
    expect(selected?.id).toBe(variants[0].id);
  });
});
