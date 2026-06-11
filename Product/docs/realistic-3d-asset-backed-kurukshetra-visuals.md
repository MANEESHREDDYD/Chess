# Realistic 3D Asset-Backed Kurukshetra Visuals

Milestone: M-REALISTIC-3D-ASSET-BACKED-KURUKSHETRA-VISUALS-1
Date: 2026-06-11

## Why This Milestone Exists

The previous 3D scene still looked toy-like because it used procedural primitive meshes. The user explicitly rejected that result and asked for realistic visuals based on the uploaded references.

This milestone replaces the visible board pieces with realistic generated image assets rendered inside the Three.js scene as camera-facing billboards. This is a practical realism pass without importing unlicensed models.

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

Project assets:

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
- Pieces are realistic transparent PNG billboards on small 3D bases.
- The board surface uses a realistic generated texture.
- Invisible square hit planes preserve exact square clicking.
- Existing move, knight leap, capture dissolve, reduced-motion fallback, and WebGL fallback remain.

## Honesty Boundary

This is now realistic 3D visual presentation inside a Three.js scene, but it is not yet rigged GLB character modeling. Full production 3D would still require licensed or project-authored 3D models, PBR textures, rigs, and animations.

## Verification

Screenshot folder:

`Product/artifacts/realistic-3d-kurukshetra-visuals/`

Required screenshots:

- `reference-3d-desktop-initial.png`
- `reference-3d-desktop-after-e4.png`
- `reference-3d-mobile.png`
- `reference-3d-reduced-motion-fallback.png`
- `reference-3d-webgl-fallback.png`
