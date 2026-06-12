# 3D Production GLB Asset Requirements

Milestone: M-RIGGED-GLB-KURUKSHETRA-COMBAT-ANIMATION-1
Status: Asset-gated. Implementation can load production GLBs, but final realism is blocked until approved model files exist.

## Why This Is Required

The current battlefield now uses true 3D mesh units, but those units are procedural prototype art. The user's references require realistic/stylized-realistic warriors, horses, elephants, chariots, armor, cloth, weapons, and combat motion. That cannot be reached by refining primitive geometry.

Final quality requires production models:

- realistic proportions and silhouettes
- PBR textures and material separation
- rigged/skinned characters where applicable
- authored idle, move, attack, hit, and defeat animations
- consistent Mahabharata/Kurukshetra art direction across all sides and roles

## Runtime Contract

The app now checks:

`Product/public/assets/3d/kurukshetra-production-v1/`

for these files:

| Chess role | Pandava file | Kaurava file |
| --- | --- | --- |
| Pawn | `pandava-foot-archer.glb` | `kaurava-foot-archer.glb` |
| Knight | `pandava-horse-archer.glb` | `kaurava-horse-archer.glb` |
| Bishop | `pandava-advisor-standard-bearer.glb` | `kaurava-advisor-standard-bearer.glb` |
| Rook | `pandava-war-chariot.glb` | `kaurava-war-chariot.glb` |
| Queen | `pandava-war-elephant-commander.glb` | `kaurava-war-elephant-commander.glb` |
| King | `pandava-royal-commander.glb` | `kaurava-royal-commander.glb` |

If all required files exist, the runtime can use production GLB units. If any are missing, the scene falls back to procedural prototype units and must not be called final realistic 3D.

## Model Requirements

- Local +Z is forward.
- Origin is ground contact at the center of the chess square.
- Unit fits inside a 1x1 square footprint at the configured scale.
- No floating geometry at rest.
- No camera-facing planes as primary unit bodies.
- PBR materials with texture maps for skin, fabric, leather, bronze, steel, wood, horse coat, elephant hide, ivory, and dust.
- Embedded or colocated textures only; no external URLs in GLB materials.
- Triangle budget should allow 32 units on desktop and mobile fallback without crashing.
- Each model must be declared in `Product/assets/3d/asset-manifest.json` before release.

## Animation Requirements

Minimum clips:

- `idle`
- `move`
- `attack`
- `hit`

Preferred role clips:

- pawn: `march`, `aim`, `release_arrow`
- knight: `horse_idle`, `horse_leap`, `rider_attack`
- bishop: `standard_idle`, `spear_attack`
- rook: `chariot_roll`, `wheel_turn`, `driver_attack`
- queen: `elephant_step`, `trunk_react`, `commander_attack`
- king: `command_idle`, `guarded_step`, `check_react`

Capture remains non-gory:

- shield impact
- dust burst
- spark flash
- stumble/fall/fade
- no blood
- no dismemberment

## Source And License Rules

Allowed:

- commissioned original models
- internally authored models
- CC0/public-domain models with documented source
- CC-BY or similarly permissive assets only if attribution and redistribution are compatible with the repo and product

Not allowed:

- ripped models from games, movies, trailers, marketplaces, or screenshots
- copyrighted character likenesses or costumes copied directly
- unclear "free download" models without explicit redistribution terms
- external CDN/model/texture requests at runtime

## Current Status

The code is ready for production GLB loading, but the required model pack is not present. The procedural mesh fallback remains a technical placeholder, not the final realistic style requested by the user.
