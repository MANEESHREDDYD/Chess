import type { PieceColor, PieceType } from './battlefieldTypes';

export type BattlefieldModelAnimationRole =
  | 'idle'
  | 'move'
  | 'attack'
  | 'capture'
  | 'hit'
  | 'check';

export type BattlefieldModelSlot = {
  id: string;
  color: PieceColor;
  type: PieceType;
  role: string;
  url: string;
  scale: number;
  yOffset: number;
  yawOffset: number;
  requiredAnimations: BattlefieldModelAnimationRole[];
};

const MODEL_ROOT = '/assets/3d/kurukshetra-production-v1';

const ROLE_BY_TYPE: Record<PieceType, string> = {
  p: 'foot archer',
  n: 'horse archer',
  b: 'advisor standard bearer',
  r: 'war chariot',
  q: 'war elephant commander',
  k: 'royal commander',
};

const FILE_BY_TYPE: Record<PieceType, string> = {
  p: 'foot-archer',
  n: 'horse-archer',
  b: 'advisor-standard-bearer',
  r: 'war-chariot',
  q: 'war-elephant-commander',
  k: 'royal-commander',
};

const SCALE_BY_TYPE: Record<PieceType, number> = {
  p: 0.5,
  n: 0.52,
  b: 0.5,
  r: 0.54,
  q: 0.52,
  k: 0.52,
};

const Y_OFFSET_BY_TYPE: Record<PieceType, number> = {
  p: -0.018,
  n: -0.022,
  b: -0.018,
  r: -0.026,
  q: -0.024,
  k: -0.018,
};

const REQUIRED_ANIMATIONS_BY_TYPE: Record<PieceType, BattlefieldModelAnimationRole[]> = {
  p: ['idle', 'move', 'attack', 'hit'],
  n: ['idle', 'move', 'attack', 'hit'],
  b: ['idle', 'move', 'attack', 'hit'],
  r: ['idle', 'move', 'attack', 'hit'],
  q: ['idle', 'move', 'attack', 'hit'],
  k: ['idle', 'move', 'attack', 'hit', 'check'],
};

export const BATTLEFIELD_MODEL_SLOTS: BattlefieldModelSlot[] = (['w', 'b'] as const).flatMap(
  (color) =>
    (['p', 'n', 'b', 'r', 'q', 'k'] as const).map((type) => ({
      id: `${color}-${type}`,
      color,
      type,
      role: ROLE_BY_TYPE[type],
      url: `${MODEL_ROOT}/${color === 'w' ? 'pandava' : 'kaurava'}-${FILE_BY_TYPE[type]}.glb`,
      scale: SCALE_BY_TYPE[type],
      yOffset: Y_OFFSET_BY_TYPE[type],
      yawOffset: 0,
      requiredAnimations: REQUIRED_ANIMATIONS_BY_TYPE[type],
    }))
);

export function getBattlefieldModelSlot(
  color: PieceColor,
  type: PieceType
): BattlefieldModelSlot {
  const slot = BATTLEFIELD_MODEL_SLOTS.find((entry) => entry.color === color && entry.type === type);
  if (!slot) throw new Error(`Missing Kurukshetra model slot for ${color}${type}`);
  return slot;
}

export function allBattlefieldModelUrls(): string[] {
  return BATTLEFIELD_MODEL_SLOTS.map((slot) => slot.url);
}
