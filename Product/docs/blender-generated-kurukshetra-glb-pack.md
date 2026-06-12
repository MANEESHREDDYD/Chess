# Blender-Generated Kurukshetra GLB Pack

Date: 2026-06-12

## What Changed

The project now includes a complete 12-file GLB pack for Kurukshetra 3D mode:

- `pandava-foot-archer.glb`
- `kaurava-foot-archer.glb`
- `pandava-horse-archer.glb`
- `kaurava-horse-archer.glb`
- `pandava-advisor-standard-bearer.glb`
- `kaurava-advisor-standard-bearer.glb`
- `pandava-war-chariot.glb`
- `kaurava-war-chariot.glb`
- `pandava-war-elephant-commander.glb`
- `kaurava-war-elephant-commander.glb`
- `pandava-royal-commander.glb`
- `kaurava-royal-commander.glb`

The files live in:

`Product/public/assets/3d/kurukshetra-production-v1/`

The generator script is:

`Product/scripts/generate-kurukshetra-production-glbs.py`

## Source And License

The pack is project-authored Blender geometry generated with Blender 5.1. It is
not copied from the user's reference images, copyrighted films, games, trailers,
or third-party model libraries.

The user's references guided art direction: Kurukshetra warriors, archers,
horse units, elephants, chariots, leather, bronze, cloth, shields, bows, and
ornamented battlefield equipment.

## Runtime Behavior

The app checks for all 12 GLB files before entering production GLB mode. If any
file is missing or fails the asset probe, the battlefield falls back to the older
procedural mesh units.

The visual check `Product/scripts/run-3d-reference-implementation-check.mjs`
now fails unless production GLB mode loads.

## Quality Boundary

This is a major upgrade over low-poly procedural placeholders, but it is still
not final AAA/film/game-quality realism. The generated pack does not include:

- high-resolution sculpted anatomy
- scanned or hand-painted PBR texture sets
- realistic cloth simulation
- skeletal rigs
- authored idle, move, attack, hit, or defeat animation clips
- cinematic Harry-Potter-style combat choreography

## Next 3D Milestone

The next realism pass should replace these files with approved, higher-fidelity
models using the same filenames and slot contract. That work should add PBR
materials, rigs, animation clips, and stronger combat motion while preserving
non-gory capture effects.
