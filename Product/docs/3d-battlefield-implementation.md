# Kurukshetra Battlefield Mode - Implementation Notes

Milestone: M-3D-REFERENCE-ANALYSIS-AND-ASSET-BRIEF-1
Status: Reference-guided procedural prototype.

## Architecture (`Product/src/three/`)

| File | Role |
| --- | --- |
| `BattlefieldScene.tsx` | Canvas composition: fog, lights, camera, board, pieces, props, dust; derives selection/legal/check state from FEN; exposes a browser test hook |
| `BattlefieldBoard.tsx` | 8x8 embedded board, selected/legal/capture/last-move/check highlights, square raycast clicks |
| `BattlefieldPiece.tsx` | Procedural unit meshes: archer pawns, horse knights, advisor bishops, chariot rooks, elephant queens, royal-command kings |
| `BattlefieldProps.tsx` | Procedural terrain, fort boundary, tents, rocks, dry trees, banners, off-board soldiers, elephants, horses, and chariots |
| `BattlefieldCamera.tsx` | Tilted strategy camera with constrained OrbitControls and player-side flip |
| `BattlefieldEffects.tsx` | Ambient drifting dust as one Points object |
| `BattlefieldFallback.tsx` | 2D-board wrapper and error boundary fallback |
| `BattlefieldControls.tsx` | Keyboard-accessible 2D/3D segmented toggle |
| `useBattlefieldSettings.ts` | Persisted mode, WebGL detection, and reduced-motion gating |
| `useBattlefieldAnimations.ts` | FEN-diff reconciler with stable piece instances for move/capture animation |
| `battlefieldTypes.ts` | Square/world math, FEN placement parser, shared types |
| `assetManifest.ts` | In-code procedural asset registry mirroring `assets/3d/asset-manifest.json` |

## Authority and Integration

- 3D owns nothing about chess rules.
- The scene renders FEN from `gameStore`, raycasts square clicks, and calls `gameStore.makePlayerMove`.
- chess.js remains the single source of truth.
- The 2D/3D toggle lives on `/play`; the 3D canvas replaces only the board content.
- Promotion auto-queens in 3D for now; the full promotion picker remains in 2D.

## Reference-Guided Improvements

- Pawns now read as human archers with bow, arrow, quiver, cloth, leather armor, and headband.
- Knights now read as mounted horse archers.
- Bishops now read as advisors/standard bearers with shield, spear, and banner.
- Rooks now read as war chariots with wheels, panels, rider, and spear.
- Queens now read as elephant commanders with caparison, tusks, howdah, rider, and mace.
- Kings now read as royal commanders with crown, shield, sword, and standard.
- The scene now includes a fort silhouette, off-board battle lines, tents, banners, rocks, trees, horses, elephants, chariots, and denser dust.

## Fallback Ladder

1. WebGL missing: 2D board plus notice.
2. Reduced motion: 2D board plus notice.
3. Lazy chunk or scene crash: error boundary plus 2D board.
4. Otherwise 3D renders at desktop and mobile viewports with DPR capped at 1.75.

## Performance Practices

- Shared geometries and materials live at module scope.
- No scene remount per move.
- Dust uses one Points object.
- Prop scatter is deterministic for stable screenshots.
- Shadows use a single 1024px directional light map.
- No external model, texture, font, or CDN requests are allowed.

## Honest Status

This is a stronger prototype, not final realistic 3D. Final quality requires approved, licensed or project-authored models, textures, rigs, and animations. Do not describe the current battlefield as final realism in UI copy, docs, tags, or release notes.
