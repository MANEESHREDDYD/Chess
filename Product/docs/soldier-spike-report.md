# Soldier Spike Report

**Date:** 2026-05-27

## What was built

- A single procedural Pandava foot-archer built entirely in Blender with `bpy`.
- A headless render pipeline for preview, turntable, idle loop, hero stills, and angle checks.
- A rigged and animated GLB export.

## Technique

- Body: Skin modifier on a joint edge skeleton, then Subdivision Surface at 2 levels.
- Garments and armor: primitive geometry with low-poly stylization.
- Props: primitive/curve-based bow, quiver, arrows, and dagger.
- Rigging: procedural armature with automatic weights for deforming parts, bone parenting for rigid props.

## Final stats

- Final mesh size: 2,143 polygons / 2,150 vertices.
- Headless regeneration time: about 5 minutes from the full `build_all.py` run, based on the Blender logs.

## Outputs

- Turntable frames: `Product/public/themes/kurukshetra/preview/turntable/`
- Idle loop frames: `Product/public/themes/kurukshetra/preview/idle/`
- Hero stills: `Product/public/themes/kurukshetra/preview/hero-three-quarter.png`, `hero-profile.png`, `hero-front.png`
- Top-down and isometric stills: `Product/public/themes/kurukshetra/preview/topdown.png`, `isometric.png`
- Rigged GLB: `art/kurukshetra/models/pandava-foot-archer.glb`

## Honest assessment

- The figure now reads as a stylized low-poly archer, but the weapon silhouette is still the weakest part of the spike.
- The proportions are intentionally heroic and readable, with a simple hand-built visual language rather than realism.
- The idle loop and export completed successfully; a second pass should tighten the bow/hand connection and sharpen the silhouette.

## Question for the human

Does this stylized soldier meet your bar? Go / no-go before building the rest of the army.