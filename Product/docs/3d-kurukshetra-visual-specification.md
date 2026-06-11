# Kurukshetra Battlefield Mode - 3D Visual Specification

Milestone: M-3D-REFERENCE-ANALYSIS-AND-ASSET-BRIEF-1
Status: Reference-guided procedural prototype. Not final realistic 3D.

## Stack

- `three` + `@react-three/fiber` + `@react-three/drei`
- Current visuals: project-authored procedural geometry and materials only
- Future visuals: local, licensed, or project-authored glTF/GLB assets declared in the asset manifest
- Stable 2D board fallback for no-WebGL, reduced-motion, and scene errors
- Lazy-loaded: three never enters the main bundle for 2D users

## Target Quality Bar

The user-provided references show stylized-realistic Mahabharata/Kurukshetra battlefield units: archers with leather armor and dhoti cloth, horse archers, war elephants with caparisons/howdahs, ornate chariots, bows, quivers, spears, shields, swords, mace/gada forms, dusty terrain, and cinematic lighting.

The current milestone moves toward that direction with procedural silhouettes. It does not satisfy final realism. Final quality requires approved models, rigs, textures, and animations.

## Honesty Rule

The 3D battlefield may be described as:

- reference-guided,
- procedural,
- prototype,
- battlefield-inspired,
- playable 3D preview.

It must not be described as:

- final realistic 3D,
- AAA-quality asset work,
- licensed cinematic models,
- completed soldier/horse/elephant/chariot art.

## Environment

- Sand battlefield disc with muted dust tones
- Darker neutral haze and fog so units stand out
- Distant fort/boundary silhouette
- Camp tents and banners outside the board
- Sparse dry trees, rocks, and off-board battle-line figures
- Edge war elephants, horse archers, and chariots as atmosphere only
- Scenery never occludes playable squares or owns chess interaction

## Board

- 8x8 grid embedded in the battlefield
- Restrained sand/clay squares with a bronze in-scene rail
- Selected square: blue halo
- Legal moves: blue ring
- Capture moves: stronger blue ring
- Last move: soft blue tint
- Check: red pulse
- The board must remain instantly readable at the default camera

## Piece Identity

| Chess role | Battlefield identity | Procedural implementation |
| --- | --- | --- |
| Pawn | Foot archer / soldier | Human warrior, dhoti cloth, leather armor, bow, arrow, quiver |
| Knight | Horse archer | Horse body/head/legs, saddle, rider, bow/quiver |
| Bishop | Advisor / standard bearer | Tall warrior, shield, spear, banner |
| Rook | War chariot | Hull, side panels, wheels, rail, rider, spear |
| Queen | War elephant commander | Elephant, trunk, tusks, caparison, howdah, rider, mace |
| King | Royal commander | Tall warrior, crown, shield, sword, royal standard |

White/Pandava side uses blue cloth accents and brighter metals. Black/Kaurava side uses red cloth accents and darker metals. Warm materials stay inside the 3D scene only.

## Movement

- Pawn/bishop/king: grounded glide
- Knight: parabolic horse leap arc
- Rook/chariot and queen/elephant: heavier glide
- Captures: impact ring, sparks, dust burst, dissolve
- No gore, no blood, no dismemberment
- Chess rules remain in chess.js/game store

## Asset Policy

Current implementation adds no binary assets and performs no external model or texture requests. Future production assets must be documented in both:

- `Product/assets/3d/asset-manifest.json`
- `Product/src/three/assetManifest.ts`

## Verification

Before tagging any 3D milestone:

- 3D scene loads on desktop and mobile
- move animation completes through the shared chess pipeline
- route switches do not crash the scene
- reduced-motion falls back to 2D
- WebGL-disabled browsers fall back to 2D
- no external CDN/model/texture requests occur
- screenshots are stored for desktop, mobile, reduced-motion, and WebGL fallback
