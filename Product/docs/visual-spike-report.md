# Visual Direction Spike Report

**Date:** 2026-05-27

## Connection path used

- Headless Blender pipeline: yes
- BlenderMCP live path: deferred

## Blender version

- `Blender 4.5.10 LTS`

## What was built

- `art/kurukshetra/_palette.py` for shared Kurukshetra colors and Principled BSDF socket helpers.
- `art/kurukshetra/smoke.py` for a reproducible smoke-test render.
- `art/kurukshetra/render_all.py` for the full batch render.
- `Product/public/themes/kurukshetra/theme.json` for the asset manifest.

## Technique per piece

- Pawn: procedural primitives, foot-archer silhouette.
- Rook: procedural primitives, chariot/tower silhouette.
- Bishop: procedural primitives, gaja/elephant silhouette.
- Knight: procedural primitives, horse plus rider silhouette.
- Queen: procedural primitives, crowned warrior-queen silhouette.
- King: procedural primitives, enthroned figure silhouette.

No Rodin or Hunyuan3D mesh generation was used in this spike; the assets are fully procedural and reproducible from the committed Blender scripts.

## Outputs

- Smoke proof: `Product/public/themes/kurukshetra/_smoke.png`
- Piece renders: `Product/public/themes/kurukshetra/pieces/`
- Top-down comparison pieces: `Product/public/themes/kurukshetra/pieces/topdown/`
- Board background: `Product/public/themes/kurukshetra/board/earth.png`
- Full-set board render: `Product/public/themes/kurukshetra/board/fullset-isometric.png`
- Top-down board render: `Product/public/themes/kurukshetra/board/fullset-topdown.png`
- Board comparison sheet: `Product/public/themes/kurukshetra/board/comparison-sheet.png`
- Dissolve frames: `Product/public/themes/kurukshetra/fx/dissolve/frame-01.png` through `frame-16.png`
- Dissolve sprite sheet: `Product/public/themes/kurukshetra/fx/dissolve/dissolve-sheet.png`

## Honest quality note

- The procedural spike is usable as a theme prototype, but it is still clearly a spike.
- The isometric board reads best and is the strongest candidate for the default theme direction.
- The top-down pass is present, but it is too dark and small to be the final shipping look without a lighting/scale pass.
- The dissolve effect is readable as ash/light rather than blood/gore, but it should be refined if the theme is promoted beyond the spike stage.

## Stubbed or deferred

- BlenderMCP live round-trip was not completed.
- No AI mesh-generation pipeline was wired into the scripts.
- No app integration was made yet; the theme remains asset-level only.