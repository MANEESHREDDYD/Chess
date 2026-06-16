# Realistic asset sourcing guide (Mixamo + CC0)

Procedural code generation cannot reach photoreal quality. To get genuinely
realistic warriors and animals, we drop **real rigged 3D model files** into this
folder, then run one command that converts them into the 12 runtime slot GLBs
with the correct animation clip names, scale, facing, and ground origin.

You do the downloads (the one step that needs your Adobe/Mixamo login). I built
the pipeline that does everything after that.

---

## 1. Folder layout to create under `asset-sources/`

```
asset-sources/
  mixamo/
    characters/
      pandava-foot-archer.fbx
      kaurava-foot-archer.fbx
      pandava-advisor.fbx
      kaurava-advisor.fbx
      pandava-commander.fbx
      kaurava-commander.fbx
    anims/
      idle.fbx
      walk_in_place.fbx
      bow_attack.fbx
      spear_attack.fbx
      melee_attack.fbx
      hit.fbx
      check.fbx
  cc0/
      pandava-horse-archer.glb
      kaurava-horse-archer.glb
      pandava-war-chariot.glb
      kaurava-war-chariot.glb
      pandava-war-elephant.glb
      kaurava-war-elephant.glb
```

Exact filenames matter — they're referenced by `asset-config.json`.

---

## 2. Mixamo (humans) — https://www.mixamo.com  (free, Adobe login, commercial OK)

### Characters (6 files → `mixamo/characters/`)
Mixamo has no Mahabharata-specific warriors, so pick the closest realistic
characters and we differentiate sides by which you choose:

- **Foot archers** — e.g. `Warrior`, `Vanguard By T. Choonyung`, or `Ch24`.
  Download one for Pandava, a visually different one for Kaurava.
- **Advisors / standard bearers** — a robed/older look, e.g. `The Boss`, `Castle Guard`.
- **Commanders (kings)** — the most ornate/armored, e.g. `Paladin J Nordstrom`, `Knight`.

For each: open the character → **Download** → Format **FBX Binary (.fbx)**,
Pose **T-pose** → save under `mixamo/characters/` with the exact name above.

### Animations (7 files → `mixamo/anims/`)
Pick any character, search each animation, then **Download → FBX Binary,
Skin = "Without Skin", FPS 30, Keyframe Reduction none**. The same animation
file works for every character (shared Mixamo skeleton).

| Save as | Search on Mixamo | Notes |
|---|---|---|
| `idle.fbx` | "Idle" or "Breathing Idle" | |
| `walk_in_place.fbx` | "Walking" | tick **In Place** |
| `bow_attack.fbx` | "Standing Draw Arrow" / "Shoot Arrow" | for archers |
| `spear_attack.fbx` | "Spear Throw" / "Great Sword Slash" | for advisors |
| `melee_attack.fbx` | "Sword And Shield Slash" / "Standing Melee Attack" | for commanders |
| `hit.fbx` | "Standing React Small From Right" / "Hit Reaction" | |
| `check.fbx` | "Standing Taunt" / "Victory Idle" | king alert pose |

---

## 3. CC0 animals & mounted units (6 `.glb` files → `cc0/`)

Use CC0 / public-domain sources only (no copyrighted game rips):
- **Poly Pizza** — https://poly.pizza (filter License: CC0)
- **Sketchfab** — https://sketchfab.com (filter Downloadable + License: CC0)
- **Quaternius** — https://quaternius.com (CC0 animal/horse packs)

Suggested searches: "horse" (with rider if available, else horse alone),
"war elephant" / "elephant", "chariot". Download **glTF/GLB**. If a model is
animated, great; if not, the pipeline adds gentle fallback motion automatically.
Name the files exactly as in the layout above. (You can use the same horse/
elephant for both sides — just save two copies with the Pandava/Kaurava names.)

---

## 4. Build the realistic pack

From `Product/`:

```bash
# 1) Check what's present / missing (no Blender changes made):
blender --background --python scripts/ingest-realistic-units.py -- --dry-run

# 2) Build every slot whose source files are present:
blender --background --python scripts/ingest-realistic-units.py

# 3) Or build one slot:
blender --background --python scripts/ingest-realistic-units.py -- --only pandava-foot-archer
```

Output overwrites `public/assets/3d/kurukshetra-production-v1/<slot>.glb`. The
runtime auto-detects production-GLB mode when all 12 are present.

### After building
```bash
node scripts/inspect-glb.mjs public/assets/3d/kurukshetra-production-v1/*.glb
```
Each unit should report the required clips (`idle, move, attack, hit`; plus
`check` for royal-commander) and a skin/joints count for the rigged humans.

---

## 5. Tuning

- **Facing wrong way?** Set `"yaw_deg": 180` (or 90/-90) for that slot in
  `asset-config.json` and rebuild it.
- **Too big/small on the board?** Adjust `"target_height"` (world units; humans
  ~1.7, elephant ~2.4).
- **File too large?** Keep Mixamo character textures at 1K–2K; the exporter uses
  Draco mesh compression automatically.

## Licensing
Mixamo content is licensed by Adobe for commercial use. CC0 assets are public
domain. Do **not** place copyrighted/game-ripped models here. Keep this folder's
sources out of the shipped build (they are inputs, not runtime assets).
