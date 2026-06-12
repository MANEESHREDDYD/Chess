# Kurukshetra Production GLB Pack

This folder contains the first project-authored Blender GLB pack for the
Kurukshetra battlefield.

These files replace the previous procedural fallback at runtime when every slot
is present. They are original generated geometry authored by the MIRROR project
with Blender 5.1 from the user's approved visual direction. They are not copied
from copyrighted reference images, games, films, or third-party model libraries.

Quality note: this is a Blender-generated production pack, not a final
artist-sculpted/rigged AAA asset pack. It is allowed to ship as the current
runtime 3D model pack, but future realism work should replace these files with
approved higher-fidelity PBR/rigged models using the same filenames.

Animation note: every file in this pack includes named Blender clips for
`idle`, `move`, `attack`, `hit`, and `check`. The current runtime plays those
clips with a Three.js `AnimationMixer`; future asset replacements must preserve
those clip names or update the slot contract and verification script together.

The runtime looks for these exact GLB files:

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

Minimum asset requirements:

- Original, commissioned, internally authored, CC0, or repo-compatible licensed.
- No copied copyrighted characters, costumes, model files, or game assets.
- Realistic or stylized-realistic Mahabharata/Kurukshetra direction based on the
  user's references.
- Units must face forward in local +Z before app yaw correction.
- Origin/pivot at ground contact, centered on the chess square.
- Reasonable scale: one unit must fit inside a 1x1 board square footprint.
- PBR materials for skin, leather, fabric, bronze, steel, wood, horse, elephant,
  ivory, dust-worn cloth, and ornamentation.
- Prefer embedded or colocated textures; no external network texture references.
- Rigged/skinned models are preferred for the next fidelity pass.
- Animation clips must include: `idle`, `move`, `attack`, `hit`, and `check`.
  Optional role-specific clips such as `horse_leap`, `chariot_roll`,
  `elephant_step`, and `defeat` may be added after the runtime slot contract is
  expanded.

If any file is missing, the app renders the procedural mesh fallback and must not
claim production GLB mode.
