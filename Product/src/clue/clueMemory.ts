import {
  getClueMemoryForPuzzleLevel,
  putClueMemoryRecord,
  type ClueMemoryRecord,
} from '../data/db';
import type { ClueMode, ClueVariant } from './clueTypes';

export function buildClueMemoryId(input: {
  playerId: string;
  puzzleId: string;
  clueLevel: number;
  variantId: string;
  mode: ClueMode;
}): string {
  return [
    'clue-memory',
    safePart(input.playerId),
    safePart(input.puzzleId),
    `L${input.clueLevel}`,
    safePart(input.variantId),
    input.mode,
  ].join(':');
}

export async function getSeenClueVariantIds(
  playerId: string,
  puzzleId: string,
  clueLevel: number,
  dbName?: string
): Promise<string[]> {
  const rows = await getClueMemoryForPuzzleLevel(playerId, puzzleId, clueLevel, dbName);
  return Array.from(new Set(rows.map((row) => row.clue_variant_id)));
}

export function hasUnseenClueVariant(variants: ClueVariant[], seenVariantIds: string[], allowRepeat = false): boolean {
  if (allowRepeat) return variants.length > 0;
  return variants.some((variant) => !seenVariantIds.includes(variant.id));
}

export function selectUnseenClueVariant(
  variants: ClueVariant[],
  seenVariantIds: string[],
  allowRepeat = false
): ClueVariant | null {
  if (variants.length === 0) return null;
  if (allowRepeat) return variants[0];
  return variants.find((variant) => !seenVariantIds.includes(variant.id)) ?? null;
}

export async function recordClueVariantShown(input: {
  playerId: string;
  puzzleId: string;
  clueLevel: number;
  variantId: string;
  mode: ClueMode;
  attemptContext: string;
  shownAt?: string;
  dbName?: string;
}): Promise<ClueMemoryRecord> {
  const record: ClueMemoryRecord = {
    id: buildClueMemoryId(input),
    player_id: input.playerId,
    puzzle_id: input.puzzleId,
    clue_level: input.clueLevel,
    clue_variant_id: input.variantId,
    shown_at: input.shownAt ?? new Date().toISOString(),
    attempt_context: input.attemptContext,
    mode: input.mode,
  };
  await putClueMemoryRecord(record, input.dbName);
  return record;
}

function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}
