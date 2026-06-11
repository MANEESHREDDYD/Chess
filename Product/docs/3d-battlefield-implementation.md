# Kurukshetra Battlefield Mode — Implementation Notes

Milestone: M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1

## Architecture (`Product/src/three/`)

| File | Role |
| --- | --- |
| `BattlefieldScene.tsx` | Canvas composition: sky/fog, lights, camera, board, pieces, props, dust; derives selection/legal/check display state from the FEN; exposes a dev test hook |
| `BattlefieldBoard.tsx` | 8×8 embedded board (sand/clay squares), highlight layer (selected halo, legal rings, capture rings, last-move tint, pulsing check ring), square raycast clicks |
| `BattlefieldPiece.tsx` | Procedural piece meshes (shared module-level geometries/materials), move glide + knight leap arc, capture dissolve + dust burst, piece-click → square click |
| `BattlefieldProps.tsx` | Terrain disc, rocks, trees, Pandava/Kaurava banners, distant camp tents, war elephant + horse edge props (never on the board) |
| `BattlefieldCamera.tsx` | Perspective camera + constrained OrbitControls; flips for the player's side |
| `BattlefieldEffects.tsx` | Ambient drifting dust (single Points object, zero allocations per frame) |
| `BattlefieldFallback.tsx` | 2D-board wrapper with quiet reason notice + `BattlefieldErrorBoundary` for lazy-chunk/WebGL crashes |
| `BattlefieldControls.tsx` | Keyboard-accessible 2D/3D segmented toggle |
| `useBattlefieldSettings.ts` | Persisted mode + WebGL detection + reduced-motion gating (3D available on every device/viewport) |
| `useBattlefieldAnimations.ts` | FEN-diff reconciler producing stable piece instances so meshes animate instead of remounting (covers castling/en-passant/promotion) |
| `battlefieldTypes.ts` | Square↔world math, FEN placement parser, shared types |
| `assetManifest.ts` | In-code registry mirroring `assets/3d/asset-manifest.json` |

## Authority & integration

- 3D owns **nothing** about chess. It renders the FEN from `gameStore`, raycasts clicks, and
  calls `gameStore.makePlayerMove` — the same legal pipeline as the 2D `BoardView`
  (chess.js stays the single source of truth).
- Integrated on `/play`: the 2D/3D toggle lives in the context bar; the 3D canvas replaces
  only the board card content. Lazy-loaded chunk — three.js never enters the main bundle.
- Promotion auto-queens in 3D (documented limitation; the 2D board has the full picker).

## Fallback ladder

1. WebGL missing → 2D board + notice (verified with `--disable-webgl` browser).
2. `prefers-reduced-motion` → 2D board + notice (verified via emulation).
3. Lazy-chunk/initialization crash → `BattlefieldErrorBoundary` → 2D board + notice.
4. Otherwise 3D renders at every viewport (incl. 390×844) with DPR capped at 1.75.

## Performance practices

Shared geometries/materials at module scope; no scene remount per move (instance
reconciliation); one Points object for dust; deterministic prop scatter (stable
screenshots); shadows on a single 1024² directional light; `dpr=[1,1.75]`;
`powerPreference: high-performance`. Verified by
`scripts/run-3d-battlefield-performance-check.mjs` (load, moves, double route switch,
mobile, both fallbacks, zero external requests).

## Honest status

Current art is **procedural low-poly placeholder** (see `3d-kurukshetra-visual-
specification.md` for the user's target-quality reference bar and the licensed-asset path
required to reach it). Do not describe the battlefield as realistic anywhere in UI copy.
