# Kurukshetra Battlefield — 3D Asset Rules

Every 3D asset used by MIRROR must be declared in `asset-manifest.json` in this folder
**before** it ships, with: name, filename, source, author, license, date added, allowed use,
modifications, attribution requirement, AI-generated flag (and if AI-generated:
prompt/tool/date/license assumption).

## Forbidden

- Copyrighted game or movie assets
- Unlicensed Sketchfab (or any marketplace) downloads
- Paid marketplace assets without explicit approval
- Real religious/sacred imagery as decoration or parody
- Gore assets of any kind

## Current state (honest)

The battlefield currently ships **zero binary assets**. Every visual element (soldiers,
cavalry, advisors, chariots, commanders, elephants, horses, rocks, trees, banners, tents,
dust) is **procedural low-poly geometry generated in code**
(`Product/src/three/*.tsx`, registered in `Product/src/three/assetManifest.ts`).
They are documented placeholders — the UI and docs must not describe the battlefield as
realistic until licensed/authored models replace them and screenshots prove the quality bar.

## Adding a real asset later

1. Verify the license permits redistribution inside an AGPL-3.0 app, offline/local serving,
   and modification.
2. Add the file under `Product/public/assets/3d/` (local only — no CDN).
3. Add a complete entry to `asset-manifest.json`.
4. Mirror the entry in `Product/src/three/assetManifest.ts`.
5. Update `Product/docs/3d-asset-licensing.md` and re-run the battlefield performance check.
