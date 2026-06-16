# Kurukshetra Production GLB Pack

This folder contains the current runtime GLB pack for the Kurukshetra
battlefield. It is a licensed/declared asset pack, not a final claim of
photorealistic or AAA-quality 3D.

Current status:

- The six standalone humanoid slots (`foot-archer`,
  `advisor-standard-bearer`, and `royal-commander` for both sides) are now
  generated from CharMorph/MB-Lab `mb_male` real-human meshes with 159-joint
  skinned rigs. They replace the earlier 19-bone procedural mannequin humans.
- Humanoid lower-body cloth and hair use fitted CharMorph/MB-Lab asset meshes;
  armor, weapons, banners, shields, quivers, crowns, and faction accents are
  MIRROR-authored Blender overlay geometry.
- Horse archer, war chariot, and war elephant commander slots now include
  CharMorph/MB-Lab 159-joint skinned riders/drivers seated on the mount or
  vehicle. The horse, elephant, chariot shells, wheels, tack, and howdah remain
  MIRROR-authored procedural Blender geometry and still sit below the user's
  realistic reference target.
- The 2026-06-17 corrective pass assigns all generated mount/vehicle materials
  before export, bone-locks humanoid face/armor/clothing/weapon overlays to the
  relevant rig bones, corrects the mounted rider arm-pose convention, and
  softens the runtime contact-shadow marker so pieces read more grounded.
- A follow-up 2026-06-17 pass darkens the CharMorph runtime skin material toward
  the user's reference tone, lowers mounted rider placement, reshapes the
  elephant platform away from the obvious cube/howdah silhouette, and adds
  low rails, saddle cloth, belly straps, horse girths, and chariot lattice
  details. This improves the current pack but does not replace the need for
  true rigged/PBR animal and vehicle assets.
- Verification phrase: mounted/vehicle shells remain procedural; riders are CharMorph skinned rigs.

License status:

- CharMorph code is GPL-family; the MB-Lab `mb_male` character data used for
  the six humanoid outputs is AGPL3-derived. This repository is AGPL-compatible.
- The local CharMorph checkout belongs under `Product/tools/CharMorph` and is
  ignored by git. Recreate it with:
  `git clone --recursive https://github.com/Upliner/CharMorph Product/tools/CharMorph`
- The exported humanoid GLBs are documented in
  `Product/assets/3d/asset-manifest.json`.
- No user reference images are stored here. The references guide style only;
  no copyrighted models, costumes, characters, screenshots, or game assets are
  copied.

Generation scripts:

- Humanoid replacements:
  `Product/scripts/generate-kurukshetra-charmorph-humanoid-glbs.py`
- Mounted rider replacements:
  `Product/scripts/generate-kurukshetra-charmorph-mounted-glbs.py`
- Procedural animal/vehicle shell baseline:
  `Product/scripts/generate-kurukshetra-realistic-glbs.py`

Animation note: every file includes named Blender clips for `idle`, `move`,
`attack`, and `hit`; royal commanders also include `check`. The CharMorph
humanoid exports currently include `check` on all six humanoid files, which is
accepted by the runtime. Mounted/vehicle files also include `rider_idle`,
`rider_move`, `rider_attack`, and `rider_hit` clips; the runtime plays these
alongside the mount/vehicle root clip with a Three.js `AnimationMixer`.
Replacements must preserve the required clip names or update the slot contract
and verification script together.

Rig note: every playable file that contains a human now includes a skinned
CharMorph armature with 159 joints, fitted lower-body cloth and hair meshes, and
MIRROR-authored leather/weapon overlays. Clips can drive rider or standalone
limb/body motion instead of only moving a rigid figure. The runtime clones
rigged units with `SkeletonUtils.clone`; a plain `Object3D.clone` would make
instances share one skeleton.

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

Minimum replacement requirements:

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
- Rigged/skinned models are required for final human, horse, elephant, and rider
  quality.
- Animation clips must include: `idle`, `move`, `attack`, and `hit`; royal
  commanders must also include `check`.

If any file is missing, the app renders the procedural mesh fallback and must not
claim production GLB mode. Even with all files present, this pack must not be
called final realistic 3D until the animals, chariots, weapons, hand holds,
grounding, and combat motion match approved screenshots.
