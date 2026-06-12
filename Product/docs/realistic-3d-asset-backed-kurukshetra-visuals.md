# Realistic 3D Asset-Backed Kurukshetra Visuals

Milestone: M-VOLUMETRIC-3D-KURUKSHETRA-MESH-PIECES-1
Date: 2026-06-12

## Why This Milestone Exists

The previous 3D scene still looked wrong because the playable units were flat generated image cards in a Three.js scene. The user explicitly called out that they looked like images, did not face each other, and did not move/capture like physical 3D chess units.

This milestone replaces the playable board pieces with actual procedural Three.js mesh units. It keeps licensing clean and removes the camera-facing billboard behavior, while still acknowledging that final realistic game-character quality requires authored rigged GLB assets.

## Reference Use

The uploaded references guided:

- archer posture, bows, quivers, leather armor, and dhoti cloth
- horse archer shape and tack
- advisor/standard-bearer silhouette
- ornate chariot form and wheels
- war elephant, caparison, howdah, tusks, and rider
- royal commander, crown, sword, shield, and banner
- dusty battlefield board material

The reference images were not copied, embedded, or stored in the repository.

## Implemented Assets

Folder:

`Product/public/assets/3d/kurukshetra-realism-v1/`

Archived/generated reference assets:

- `pawn-foot-archer.png`
- `knight-horse-archer.png`
- `bishop-advisor-standard.png`
- `rook-war-chariot.png`
- `queen-war-elephant.png`
- `king-royal-commander.png`
- `realistic-board-texture.png`

Traceability assets:

- `source-unit-sheet-chroma.png`
- `unit-sheet-transparent.png`
- `*-chroma.png` for individually generated complex units
- `asset-contact-sheet.jpg`

## Rendering Approach

- Three.js still owns the interactive 3D board/camera/canvas.
- chess.js and `gameStore` still own all chess rules.
- Playable pieces are volumetric mesh units, not sprites or camera-facing image planes.
- Colored token bases were removed; each unit uses a grounded contact shadow.
- White/Pandava and Black/Kaurava armies face each other by board orientation.
- Movement includes march/step/roll body motion, knight leap, attacker lunge, and non-gory impact/fall/dust capture reaction.
- The board surface uses a realistic generated texture.
- Invisible square hit planes preserve exact square clicking.
- Reduced-motion fallback and WebGL fallback remain.

## Honesty Boundary

This is now true 3D mesh presentation inside a Three.js scene, but it is not final realistic/AAA character art. Full production 3D still requires licensed or project-authored 3D models, PBR textures, rigs, skeletal animations, hit reactions, and animation blending.

## Verification

Screenshot folder:

`Product/artifacts/realistic-3d-kurukshetra-visuals/`

Required screenshots:

- `reference-3d-desktop-initial.png`
- `reference-3d-desktop-after-e4.png`
- `reference-3d-capture-impact.png`
- `reference-3d-mobile.png`
- `reference-3d-reduced-motion-fallback.png`
- `reference-3d-webgl-fallback.png`
