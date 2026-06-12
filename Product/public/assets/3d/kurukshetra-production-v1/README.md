# Kurukshetra Production GLB Pack

This folder is intentionally empty until approved, licensed, production-quality
3D assets are available.

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
- Rigged/skinned models are preferred.
- Animation clips should include: `idle`, `move`, `attack`, `hit`, and optional
  role-specific clips such as `horse_leap`, `chariot_roll`, `elephant_step`,
  `check`, and `defeat`.

Until these files exist, the app renders the procedural mesh fallback and must
not claim final realistic 3D.
