# 3D Asset Licensing — Kurukshetra Battlefield

Milestone: M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1
Registry: `Product/assets/3d/asset-manifest.json` (+ in-code mirror `src/three/assetManifest.ts`)
Rules: `Product/assets/3d/README.md`

## Current inventory (2026-06-11)

**Zero binary assets.** Every battlefield visual — foot soldiers, horse cavalry, advisors,
war chariots, commanders, royal commanders, war elephants, horses, rocks, trees, banners,
camp tents, dust — is procedural geometry generated in project code
(AGPL-3.0-or-later, not AI-generated, no attribution requirements, no external requests).

## Enforcement

- `run-3d-battlefield-performance-check.mjs` fails the build if ANY non-localhost request
  is observed while the battlefield runs (no CDN models/textures/fonts can sneak in).
- Manifest-first policy: an asset that is not declared in `asset-manifest.json` with
  name/source/author/license/date/use/modifications/attribution/AI-flag may not ship.

## Forbidden categories

Copyrighted game/movie assets · unlicensed marketplace (incl. Sketchfab) downloads ·
paid assets without explicit approval · sacred/religious imagery as decoration or parody ·
gore assets · AI-generated assets without documented prompt/tool/date/license assumption.

## Path to the realistic target bar

The user's reference imagery (realistic Mahabharata-era archer, horse archer, war-elephant
archer, war chariots) requires licensed or commissioned rigged GLB models with PBR
textures. When acquired: place under `Product/public/assets/3d/`, declare in the manifest,
mirror in `assetManifest.ts`, update this document, and re-run the performance check.
