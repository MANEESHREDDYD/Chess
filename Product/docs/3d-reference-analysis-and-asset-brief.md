# 3D Reference Analysis and Asset Brief

Milestone: M-3D-REFERENCE-ANALYSIS-AND-ASSET-BRIEF-1
Date: 2026-06-11
Status: Initial user-provided references analyzed; implementation pass limited to procedural reference-guided prototypes.

## Source Handling

The user provided in-chat visual references for Mahabharata/Kurukshetra-style warriors, archers, horse units, elephant units, camel units, chariots, armor, cloth, weapons, and battlefield atmosphere. The images are used only as visual direction. They are not stored in the repository because the user has not explicitly confirmed repo storage rights.

No character, model, image layout, costume plate, render, or copyrighted asset is copied directly. Similarity means direction: silhouette, material language, camera mood, battlefield identity, and animation feel.

## Extracted Visual Direction

- Fidelity target: stylized realistic, cinematic, high-detail game-art direction. Current code remains procedural and cannot be called final realistic art.
- Character read: human units should read as warriors or archers, not abstract chess tokens.
- Clothing: dhoti-style lower cloth, faction-colored sashes, headbands, layered fabric, leather armor, and shoulder/torso details.
- Materials: skin, leather, bronze, steel, wood, cloth, elephant hide, horse coat, ivory, and dusty terrain must separate clearly.
- Weapons: bows and quivers are the strongest signature; spear, sword, mace/gada, shield, arrows, and chariot wheels support role identity.
- Mounts: horse cavalry and elephant units need recognizable bodies, heads, legs, tack, saddle cloth, and rider silhouettes.
- Chariots: rook-like heavy movement should use wheel-forward chariot silhouettes with a rider/standard.
- Battlefield: dusty sand, haze, rocks, sparse trees, banners, camp/tent silhouettes, distant fort or boundary, and armies off-board.
- Camera: tilted strategy camera for playability, with a lower/cinematic bias so units read as figures.
- Capture: non-gory dust burst, impact ring, spark flash, dissolve/retreat; no blood and no gore.
- Color: warm battlefield colors stay inside the board/3D canvas. The app shell remains Apple-style black/white/graphite.

## Chess Role Mapping

| Chess role | Reference-based battlefield identity | Current implementation pass |
| --- | --- | --- |
| Pawn | Foot archer / soldier | Human warrior with dhoti cloth, leather armor, bow, arrow, quiver, headband |
| Knight | Horse archer | Horse body, legs, head, saddle, rider, bow/quiver |
| Bishop | Advisor / standard bearer | Tall warrior with shield, spear, standard/banner |
| Rook | War chariot | Hull, side panels, wheels, rail, rider, spear |
| Queen | War elephant commander | Elephant body/head/trunk/tusks, howdah, rider, mace |
| King | Royal commander | Tall armored warrior, crown, standard, shield, sword |

## Asset Policy

The current implementation uses only project-authored procedural geometry and materials in `Product/src/three/`. This is acceptable for a reference-guided prototype and keeps licensing clean.

Final production-quality 3D still requires one of:

- commissioned original GLB/texture/animation assets,
- internally authored assets with documented ownership,
- clearly licensed third-party assets with repo-compatible terms.

Every non-code asset must be declared in `Product/assets/3d/asset-manifest.json` before release.

## Implementation Boundaries

- Do not claim final realistic 3D.
- Do not import the user reference images into the repo without explicit permission.
- Do not use external model/CDN requests.
- Do not make 3D responsible for chess rules.
- Do not let props block board clicks or hide pieces.
- Keep 2D fallback, reduced-motion fallback, and WebGL fallback.

## Next Asset Brief

When production assets are approved, create or source:

- 6 white-side and 6 black-side readable unit models, sharing rigs where possible.
- Low-poly fallback or simplified LOD variants.
- Walk/march, horse leap, chariot roll, elephant step, commander move, idle, capture dissolve, and check pulse animations.
- One dust/spark impact VFX pack with no gore.
- Sand battlefield terrain, rocks, sparse trees, banners, tents, fort boundary, and off-board army silhouettes.
