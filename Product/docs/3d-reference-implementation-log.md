# 3D Reference Implementation Log

Milestone: M-VOLUMETRIC-3D-KURUKSHETRA-MESH-PIECES-1
Date: 2026-06-12

## Summary

The user rejected the generated image-card/billboard pass because the pieces still looked like flat images, stared at the user, floated visually, and did not move/capture like a physical chess army. This milestone replaces the playable unit renderer with actual volumetric Three.js mesh units while keeping the realistic board texture.

## Implemented

- Mesh foot archer pawn with body, armor, dhoti cloth, bow, arrow, and quiver.
- Mesh horse archer knight with horse body/legs/head, saddle, and mounted archer.
- Mesh advisor/standard bearer bishop with staff, spear head, and banner.
- Mesh ornate chariot rook with cabin, wheels, yoke, horses, and rider.
- Mesh war elephant commander queen with elephant body/head/trunk/tusks, caparison, howdah, and rider.
- Mesh royal commander king with crown, armor, shield, sword, and cloth.
- Realistic weathered Kurukshetra board texture.
- Opposing armies face each other by board orientation instead of facing the camera.
- Colored token bases removed; units sit on contact shadows.
- Attacker lunge plus non-gory impact/fall/dust capture reaction.
- Invisible hit planes for exact square clicks.
- Existing legal move, animation, capture, fallback, and board interaction pipeline preserved.

## Screenshots

Folder:

`Product/artifacts/realistic-3d-kurukshetra-visuals/`

Captured:

- `reference-3d-desktop-initial.png`
- `reference-3d-desktop-after-e4.png`
- `reference-3d-capture-impact.png`
- `reference-3d-mobile.png`
- `reference-3d-reduced-motion-fallback.png`
- `reference-3d-webgl-fallback.png`

## Verification

- `node scripts/run-3d-reference-implementation-check.mjs`: pass

## Remaining Caveat

This is now true 3D mesh presentation for the playable units, but it is still procedural prototype art. Full Harry-Potter-chess/PUBG/GTA-like realism requires licensed or project-authored rigged GLB models, PBR textures, skeletal animation clips, hit reactions, and animation blending.
