import { describe, expect, it } from 'vitest';
import {
  BATTLEFIELD_MODEL_SLOTS,
  allBattlefieldModelUrls,
  getBattlefieldModelSlot,
} from './battlefieldModelSlots';

describe('Kurukshetra production GLB model slots', () => {
  it('defines exactly one Pandava and one Kaurava GLB slot for every chess role', () => {
    expect(BATTLEFIELD_MODEL_SLOTS).toHaveLength(12);
    for (const color of ['w', 'b'] as const) {
      for (const type of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
        const slot = getBattlefieldModelSlot(color, type);
        expect(slot.color).toBe(color);
        expect(slot.type).toBe(type);
        expect(slot.url).toMatch(/^\/assets\/3d\/kurukshetra-production-v1\//);
        expect(slot.url).toMatch(/\.glb$/);
        expect(slot.requiredAnimations).toEqual(expect.arrayContaining(['idle', 'move', 'attack', 'hit']));
      }
    }
  });

  it('uses the explicit production filenames required by the asset drop folder', () => {
    expect(allBattlefieldModelUrls()).toEqual([
      '/assets/3d/kurukshetra-production-v1/pandava-foot-archer.glb',
      '/assets/3d/kurukshetra-production-v1/pandava-horse-archer.glb',
      '/assets/3d/kurukshetra-production-v1/pandava-advisor-standard-bearer.glb',
      '/assets/3d/kurukshetra-production-v1/pandava-war-chariot.glb',
      '/assets/3d/kurukshetra-production-v1/pandava-war-elephant-commander.glb',
      '/assets/3d/kurukshetra-production-v1/pandava-royal-commander.glb',
      '/assets/3d/kurukshetra-production-v1/kaurava-foot-archer.glb',
      '/assets/3d/kurukshetra-production-v1/kaurava-horse-archer.glb',
      '/assets/3d/kurukshetra-production-v1/kaurava-advisor-standard-bearer.glb',
      '/assets/3d/kurukshetra-production-v1/kaurava-war-chariot.glb',
      '/assets/3d/kurukshetra-production-v1/kaurava-war-elephant-commander.glb',
      '/assets/3d/kurukshetra-production-v1/kaurava-royal-commander.glb',
    ]);
  });
});
