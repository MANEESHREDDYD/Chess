# Kurukshetra Battlefield Mode - 3D Visual Specification

Milestone: M-VOLUMETRIC-3D-KURUKSHETRA-MESH-PIECES-1
Status: Volumetric Three.js mesh prototype. Not yet rigged GLB character modeling or AAA realism.

## Stack

- `three` + `@react-three/fiber` + `@react-three/drei`
- Current visible unit visuals: procedural volumetric Three.js meshes for soldiers, horses, elephants, chariots, weapons, armor, and contact shadows
- Current board visual: generated realistic board texture rendered inside Three.js
- Current environment/effects: project-authored procedural geometry and materials
- Future visuals: local, licensed, or project-authored glTF/GLB assets declared in the asset manifest
- Stable 2D board fallback for no-WebGL, reduced-motion, and scene errors
- Lazy-loaded: three never enters the main bundle for 2D users

## Target Quality Bar

The user-provided references show stylized-realistic Mahabharata/Kurukshetra battlefield units: archers with leather armor and dhoti cloth, horse archers, war elephants with caparisons/howdahs, ornate chariots, bows, quivers, spears, shields, swords, mace/gada forms, dusty terrain, and cinematic lighting.

The current milestone replaces the flat image-card/billboard pass with actual 3D mesh units that face each other, stay grounded, and animate through board-space movement. It improves the 3D truthfulness of the battlefield, while final Harry-Potter-chess/PUBG/GTA-like realism still requires approved rigged models, PBR textures, authored animation clips, and combat reactions.

## Honesty Rule

The 3D battlefield may be described as:

- reference-guided,
- volumetric mesh prototype,
- battlefield-inspired,
- playable 3D preview.

It must not be described as:

- AAA-quality asset work,
- licensed cinematic models,
- rigged GLB soldier/horse/elephant/chariot models.

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
- Realistic weathered board texture with carved wood/bronze border
- Invisible hit planes preserve exact square clicks
- Selected square: blue halo
- Legal moves: blue ring
- Capture moves: stronger blue ring
- Last move: soft blue tint
- Check: red pulse
- The board must remain instantly readable at the default camera

## Piece Identity

| Chess role | Battlefield identity | Procedural implementation |
| --- | --- | --- |
| Pawn | Foot archer / soldier | Mesh warrior with body, head, armor, dhoti cloth, bow, arrow, and quiver |
| Knight | Horse archer | Mesh horse with legs/head/saddle plus mounted archer |
| Bishop | Advisor / standard bearer | Mesh warrior with staff, spear head, and banner |
| Rook | War chariot | Mesh chariot with cabin, wheels, yoke, horses, and rider |
| Queen | War elephant commander | Mesh elephant with legs, head, trunk, tusks, caparison, howdah, and rider |
| King | Royal commander | Mesh commander with crown, shield, sword, armor, and cloth |

White/Pandava side uses blue cloth accents and brighter metals. Black/Kaurava side uses red cloth accents and darker metals. Warm materials stay inside the 3D scene only.

## Movement

- Pawn/bishop/king: grounded march with body bob/lean
- Knight: parabolic horse leap arc
- Rook/chariot and queen/elephant: heavier roll/step movement
- Captures: attacker lunge, impact ring, sparks, dust burst, fall/dissolve reaction
- No gore, no blood, no dismemberment
- Chess rules remain in chess.js/game store

## Asset Policy

Current playable unit implementation adds no external model requests. The board texture and archived generated reference PNGs are declared in the manifest. Future production assets must be documented in both:

- `Product/assets/3d/asset-manifest.json`
- `Product/src/three/assetManifest.ts`

## Verification

Before tagging any 3D milestone:

- 3D scene loads on desktop and mobile
- move animation completes through the shared chess pipeline
- capture animation completes through the shared chess pipeline
- source code contains no `sprite`, `spriteMaterial`, token base, or colored base-ring implementation for playable units
- route switches do not crash the scene
- reduced-motion falls back to 2D
- WebGL-disabled browsers fall back to 2D
- no external CDN/model/texture requests occur
- screenshots are stored for desktop, mobile, reduced-motion, and WebGL fallback
