# 3D Realism Gap Assessment

Date: 2026-06-12
Status: Current procedural mesh units are not realistic enough.

## Direct Answer

The current battlefield is real 3D, but it is not realistic 3D in the style of the user's references.

## What Is Improved

- The battlefield is rendered in Three.js.
- The playable units are volumetric meshes, not flat sprites.
- Units are grounded on board squares.
- Armies face each other instead of always facing the camera.
- Movement and capture are animated through the chess pipeline.
- Missing production models no longer crash the scene; the procedural fallback loads.

## Why It Still Fails The Reference

- Human bodies are low-poly and simplified.
- Faces, anatomy, hands, armor, cloth folds, belts, jewelry, and hair are not realistic.
- Horses, elephants, and chariots are primitive approximations, not production models.
- Materials are basic colors, not PBR texture sets.
- Movement is procedural bob/lunge, not authored skeletal animation.
- Capture has impact effects but not cinematic combat choreography.
- It does not match the visual fidelity of the provided archer, horse, elephant, and chariot references.

## Required Fix

Do not keep refining primitive geometry and call it realistic.

Final visual quality requires an approved production GLB asset pack:

- realistic/stylized-realistic warrior models
- horse archer model
- war elephant commander model
- chariot model
- royal commander model
- Kaurava/Pandava variants
- PBR textures
- rigs and animation clips
- non-gory attack/hit/defeat motion

## Current Engineering Status

The runtime now has a production GLB slot contract:

`Product/public/assets/3d/kurukshetra-production-v1/`

Until the required 12 GLB files exist and are licensed/approved, the app uses procedural fallback units and must not claim final realistic 3D.
