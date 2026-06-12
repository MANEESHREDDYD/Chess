# 3D Kurukshetra Combat Choreography Pass

Date: 2026-06-12

## What Changed

The battlefield now adds role-specific runtime combat cues on top of the
Blender GLB animation clips:

- Foot and horse archers show a forward arrow volley cue.
- Advisor/standard units show a spear-thrust cue.
- Chariots show a heavier crash shock and wheel-spark cue.
- War elephants show a larger stomp-impact dust ring.
- Royal commanders show a sword-arc cue.

Movement also varies by role:

- Knights/horse archers use a higher leap arc.
- Chariots move slower with a low heavy roll.
- Elephants move slowest with a low grounded stomp lift.
- Foot units keep a smaller march motion.

## Boundary

This is still not final PUBG/GTA/film-grade realism. The current improvement is
runtime choreography and whole-model Blender clip playback. Final realism still
requires approved rigged/PBR GLB models with skeletal or per-limb animation
authored by an artist or a licensed generation pipeline.

## Verification

`Product/scripts/run-3d-reference-implementation-check.mjs` now checks for the
combat cue implementation terms so the scene cannot regress to generic sliding
units without failing the 3D gate.
