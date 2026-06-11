import { useRef } from 'react';
import {
  parseFenPlacement,
  type BattlefieldPieceInstance,
  type SquareName,
} from './battlefieldTypes';

export const CAPTURE_EFFECT_MS = 420;

let instanceCounter = 0;

/**
 * Reconciles successive FENs into a stable list of piece INSTANCES so meshes
 * animate between squares instead of remounting. Pure diffing — no chess
 * knowledge beyond "same type+color that vanished here probably moved there"
 * (which also covers castling and en passant as two independent transitions).
 */
export function useBattlefieldPieces(fen: string): BattlefieldPieceInstance[] {
  const stateRef = useRef<{ fen: string; pieces: BattlefieldPieceInstance[] } | null>(null);

  if (stateRef.current === null) {
    stateRef.current = {
      fen,
      pieces: parseFenPlacement(fen).map((p) => ({
        id: `bf-${instanceCounter++}`,
        type: p.type,
        color: p.color,
        square: p.square,
        fromSquare: null,
        capturedAt: null,
      })),
    };
  } else if (stateRef.current.fen !== fen) {
    stateRef.current = { fen, pieces: reconcile(stateRef.current.pieces, fen) };
  }

  // Drop pieces whose capture animation has fully played out.
  const now = Date.now();
  stateRef.current.pieces = stateRef.current.pieces.filter(
    (p) => p.capturedAt === null || now - p.capturedAt < CAPTURE_EFFECT_MS + 200
  );

  return stateRef.current.pieces;
}

function reconcile(
  previous: BattlefieldPieceInstance[],
  fen: string
): BattlefieldPieceInstance[] {
  const next = parseFenPlacement(fen);
  const alive = previous.filter((p) => p.capturedAt === null);
  const dying = previous.filter((p) => p.capturedAt !== null);

  const bySquare = new Map<SquareName, BattlefieldPieceInstance>(
    alive.map((p) => [p.square, p])
  );
  const claimed = new Set<BattlefieldPieceInstance>();
  const result: BattlefieldPieceInstance[] = [];
  const unmatched: typeof next = [];

  // Pass 1: pieces that did not move.
  for (const target of next) {
    const existing = bySquare.get(target.square);
    if (existing && existing.type === target.type && existing.color === target.color) {
      claimed.add(existing);
      result.push({ ...existing, fromSquare: null });
    } else {
      unmatched.push(target);
    }
  }

  // Pass 2: match moved pieces by type+color, preferring the nearest origin.
  const free = alive.filter((p) => !claimed.has(p));
  for (const target of unmatched) {
    let best: BattlefieldPieceInstance | null = null;
    let bestDist = Infinity;
    for (const candidate of free) {
      if (claimed.has(candidate)) continue;
      if (candidate.type !== target.type || candidate.color !== target.color) continue;
      const dist = squareDistance(candidate.square, target.square);
      if (dist < bestDist) {
        best = candidate;
        bestDist = dist;
      }
    }
    if (best) {
      claimed.add(best);
      result.push({ ...best, fromSquare: best.square, square: target.square });
    } else {
      // Promotion (pawn became queen) or a brand-new piece: spawn in place.
      result.push({
        id: `bf-${instanceCounter++}`,
        type: target.type,
        color: target.color,
        square: target.square,
        fromSquare: null,
        capturedAt: null,
      });
    }
  }

  // Anything alive but unclaimed was captured (or promoted away) — dissolve it.
  const now = Date.now();
  for (const piece of alive) {
    if (!claimed.has(piece)) {
      result.push({ ...piece, capturedAt: now });
    }
  }

  return [...result, ...dying];
}

function squareDistance(a: SquareName, b: SquareName): number {
  const df = a.charCodeAt(0) - b.charCodeAt(0);
  const dr = Number(a[1]) - Number(b[1]);
  return df * df + dr * dr;
}
