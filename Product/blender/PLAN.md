# Padati Archer — Blender Spike Plan

**Date:** 2026-05-27
**Workspace:** `C:\Users\md200\OneDrive\Desktop\Chess\Product\blender\`
**Stop point:** end of this file. No `.py` written until you approve.

This plan covers the 8 items the brief asks for, plus four pre-flight findings that change the budget assumptions and the directory layout. I'm flagging them up front so you can either accept the new numbers or redirect.

---

## 0 · Pre-flight findings that change scope

### 0.1 Blender 4.5 LTS, not 4.2

The brief specifies Blender 4.2 LTS. The machine has Blender 4.5.10 LTS (installed today, build date 2026-05-19). 4.2 was the previous LTS line; 4.5 is the current LTS line. Stable bpy API across both. Principled BSDF socket-naming convention is identical (since 4.0). I will write code against 4.5 with a `bpy.app.version` check that errors out below 4.2.

If you want strict 4.2, say so and I'll install 4.2 side-by-side and use that path explicitly.

### 0.2 GPU is Intel integrated, not RTX 3060

`Win32_VideoController` reports `Intel(R) Graphics` with 2GB shared adapter RAM. No CUDA, no OptiX, no discrete GPU. Cycles GPU rendering is unavailable here; renders will run on CPU only.

Practical impact on the brief's render-time budgets:

| Deliverable | Brief budget | Realistic estimate on this hardware |
| --- | --- | --- |
| Padati Archer 1024×1280, 256 samples Cycles | < 5 min | **20–60 min** |
| Kurukshetra battlefield 2560×1440 | < 15 min | **60–180 min** |

Three ways to handle this:
- **(a) Accept longer renders.** I run the final renders overnight; intermediate previews use lower samples (32–64). This is what I'd default to.
- **(b) Switch the final pass to Eevee.** Faster but materially worse for skin SSS and the dust-particle haze. Roughly 1–3 min for the character.
- **(c) Use Cycles with denoiser at 64 samples.** OpenImageDenoise on the CPU brings 64 samples to "looks like ~256." Render times closer to 8–15 min for character. Probably the right compromise.

I'd recommend (c) for final renders, (a) only for the battlefield where the haze depends on Cycles' volumetrics. Tell me if you want a different mix.

### 0.3 An existing `art/kurukshetra/` tree overlaps the new `blender/` scope

`Product/art/kurukshetra/` already exists (from earlier work) and contains:

```
art/kurukshetra/
├── _palette.py
├── animate_idle.py
├── build_all.py
├── build_soldier.py          ← already builds a foot-archer-like soldier
├── export_glb.py             ← out of scope per current brief
├── render_all.py
├── render_soldier.py
├── rig_soldier.py
├── scene_setup.py            ← overlaps with the new _render_setup.py
├── smoke.py
└── models/
    └── pandava-foot-archer.glb   ← already a built+exported model
```

The new brief's path is `Product/blender/` — a different directory. Options:
- **(a) Keep them separate.** `blender/` is the spike per the new brief; `art/kurukshetra/` is the older parallel work. Risk: two diverging codebases solving the same problem.
- **(b) Treat `art/kurukshetra/` as canon and adapt the new brief's structure on top.** Reuse `_palette.py` and `scene_setup.py`, rename to match.
- **(c) Archive `art/kurukshetra/` and start fresh in `blender/`.**

I'd default to (a) for the duration of this spike to honor the brief's exact paths and isolation rule, then we decide post-spike whether to merge. Flag if you want (b) or (c).

### 0.4 No reference images on disk

The brief refers to `Product/blender/references/padati_archer_*.jpg`. The `references/` folder does not exist; no JPGs anywhere. I'll work from the prose description in the brief (muscular Indian male warrior, mid-20s, brown skin, dark braided hair, fabric headband, leather chest armor with studs, saffron dhoti with indigo sash, leather wrist guards, ankle sandals, recurve bow left hand, quiver on back, heroic stance, dark moody studio lighting). If you have a reference image, drop it in `Product/blender/references/` before I start and I'll match proportions/silhouette against it.

---

## 1 · Blender 4.5 confirmation

```
$ "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" --version
Blender 4.5.10 LTS
	build date: 2026-05-19
	build time: 01:33:42
	build commit date: 2026-05-18
	build commit time: 13:28
```

Headless smoke test:

```
$ blender --background --python-expr "import bpy; print('BLENDER_PY_OK', bpy.app.version_string)"
BLENDER_PY_OK 4.5.10 LTS
Blender quit
```

Works. Will add `Product/blender/scripts/blender.cmd` with the absolute path so every script runs with a single command.

---

## 2 · Character body parts → primitive mapping

All primitives are low-poly with selective subdivision, not sculpted. Total target: under 5K verts before subsurf, under 50K after.

### Skeleton (no rig in this spike — pose is baked into the mesh)

| Part | Primitive | Modifiers | Notes |
| --- | --- | --- | --- |
| Head | UV sphere (16×16) | Subsurf 1 | Slightly oval (Z-scale 1.1) |
| Neck | Cylinder (8 sides) | Subsurf 1 | Short, 0.4 unit |
| Torso (chest) | Cube | Bevel (0.05, 4 segs), Subsurf 1 | Scale 1.0×0.5×1.4 to chest proportions |
| Pelvis | Cube | Bevel, Subsurf 1 | Connects torso to legs |
| Upper arm ×2 | Cylinder (12 sides) | Subsurf 1, slight taper via Lattice | Bent ~15° at elbow via vertex weight bend |
| Forearm ×2 | Cylinder (12 sides) | Subsurf 1, taper | Posed: left arm extended forward holding bow |
| Hand ×2 | Cube | Bevel heavy, Subsurf 1 | Abstracted mitt — no fingers (out of scope) |
| Upper leg ×2 | Cylinder (12 sides) | Subsurf 1, taper | Slight stance angle |
| Lower leg ×2 | Cylinder (12 sides) | Subsurf 1, taper | Foot planted |
| Foot ×2 | Cube | Bevel, Subsurf 1 | Flat sandal shape, no toes |
| Hair (cap) | Half UV-sphere | Subsurf 1 | Sits on top of head; braided look via Y-scale |
| Braid | Bezier curve | Curve→Mesh, bevel | Single braid down the back, helical twist via geometry nodes if time, else a tapered cylinder |
| Fabric headband | Torus (16×8) | — | Thin band around forehead |

### Face — deliberate abstraction (brief: "sphere with brow ridge + nose + mouth as subtle bumps; no eyes")

- Brow ridge: two small cube extrusions onto the sphere face, beveled, joined
- Nose: small wedge extrusion, smoothed
- Mouth: thin horizontal indent (vertex push)
- **No eyes.** Per brief.
- **No individual hair strands.** Hair is shaped mesh.

Stylization target: "stylized 3D NPC head at portrait distance." Not Genshin-level expressive. Closer to "Hades 2D portrait but in 3D."

### Armor & accessories

| Part | Primitive | Modifiers | Notes |
| --- | --- | --- | --- |
| Chest plate | Plane → extrude | Bevel, Solidify (0.04), Subsurf 1 | Wraps front torso; curved via Lattice or Shrinkwrap onto torso |
| Studs ×~20 | Cylinder (8 sides) tiny | Array along chest plate edges | Brass/gold |
| Belt | Torus (24×4), squashed | — | Around waist |
| Wrist guard ×2 | Short cylinder (12 sides) | Subsurf 1 | Around forearms |
| Quiver | Cylinder (16 sides) | Subsurf 1 | On back, angled |
| Quiver strap | Plane curved with Curve modifier | — | Diagonal across torso |
| Arrows ×5 | Cylinders (6 sides) tiny | — | Sticking out of quiver, fletching = 3 cones at top |

### Clothing — the dhoti is the hard part (see §7)

| Part | Approach |
| --- | --- |
| Dhoti (saffron, waist-to-shin) | Manually shaped: cylinder cone-tapered from waist, vertical loop cuts at 8 positions, alternating push/pull verts to create static "folds." NOT a cloth sim. Add subdiv 2 + smooth shading. |
| Indigo sash | Plane shaped diagonally across chest, attached at shoulder + opposite hip. Slight wave via lattice. |
| Sandals | Already covered (feet = beveled cubes — sandals are textured into the foot mesh) |

### Bow & arrow

| Part | Approach |
| --- | --- |
| Recurve bow body | Bezier curve, 5 control points forming the recurve S-shape. Curve bevel: rectangular profile, taller than wide (~0.05 × 0.03 unit cross-section). Two-tone material along curve length using vertex color or attribute interpolation. |
| Bow string | Bezier curve, straight from tip to tip, narrow circular bevel. Slight tension curve mid-string via 1 control point. |
| Held arrow (drawn position) | Cylinder horizontal across bow, nocked at string |

---

## 3 · Materials — PBR plan

All materials are Principled BSDF with the same node-graph template (Base Color → ColorRamp/Mix → BSDF; Roughness from texture or noise; Normal from texture or Bump node). One material per logical surface; reused across body parts.

| Material | Approach | ambientCG texture (CC0) |
| --- | --- | --- |
| `skin_brown` | Base #8a5530 + Subsurface 0.08 (warm red SSS color #c47a4a, radius 1mm) + Roughness 0.6 with Voronoi noise variation 0.1 + subtle bump from noise texture. **No ambientCG texture** — procedural skin is more controllable than a photo skin texture for stylized characters. |
| `leather_dark` | Base #3a2a1c + leather PBR set | `Leather011_2K-PNG` (color, roughness, normal, displacement) |
| `leather_warm` (wrist guards, belt) | Base #5a3a22 + same texture set retinted | `Leather011_2K-PNG` (tinted) |
| `cloth_saffron` (dhoti) | Base #d67428 + fabric weave | `Fabric048_2K-PNG` (color, roughness, normal) |
| `cloth_indigo` (sash, headband) | Base #1e3a5f + same fabric base | `Fabric048_2K-PNG` (tinted indigo) |
| `metal_gold` (studs) | Metallic 1.0, Base #c9a747, Roughness 0.35 with slight noise. Procedural — no texture needed at this size. | (none) |
| `wood_bow` | Base #4a2818 + wood grain | `Wood050_2K-PNG` (color, roughness, normal) |
| `metal_arrow_tip` | Metallic 1.0, Base #6a6a70, Roughness 0.25. | (none) |
| `feather_fletching` | Base #a08060, Roughness 0.7, slight anisotropy. | (none) |

`fetch_textures.py` will pull `Leather011`, `Fabric048`, `Wood050` 2K PNG sets from `https://ambientcg.com/get?file=<asset>_2K-PNG.zip`. ~30MB total. Cached under `blender/textures/`. CC0 — no attribution required but I'll list them in the spike report.

---

## 4 · Lighting — hero studio scheme

Three-point setup, dark moody background, slight Pandava-indigo rim accent.

| Light | Type | Color (K) | Strength | Position | Notes |
| --- | --- | --- | --- | --- | --- |
| Key | Area light 2×2 | 4500 K (warm) | 500 W | (4, -3, 4) world units, aimed at character chest | 45° azimuth, 60° elevation. Soft shadows. |
| Fill | Area light 1.5×1.5 | 6500 K (cool) | 80 W | (-3, -2, 1.5) | Opposite side, low elevation, 20% of key intensity. |
| Rim / hair | Spot, 30° cone | 5500 K (neutral) | 200 W | (-2, 3, 4) | Behind-left, defines silhouette. |
| Accent (Pandava indigo) | Area light 0.5×0.5 | tint #1e3a5f via emission RGB | 60 W | (3, 2, 2) | Subtle indigo rim on quiver-side. |
| World background | Solid emission | #0a0806 (near-black) | 0.1 | — | Dark moody studio. |

Camera-space coordinates assume the character is at world origin, facing -Y, with +Z up.

Color management:
- View transform: AgX (Blender 4.5 default; more natural than Filmic for character skin)
- Look: AgX Punchy
- Exposure: 0.0 baseline; adjust ±0.3 if final preview is dark/blown

Brief says `filmic_high_contrast` — I'll provide that as a fallback in `_render_setup.py` and let the caller pick `agx_punchy` (default) or `filmic_high_contrast`.

---

## 5 · Camera

| Parameter | Value | Why |
| --- | --- | --- |
| Lens | 85mm | Portrait-friendly, mild compression, flattens face shape |
| Focus distance | 5.5 units | Hits subject |
| Sensor | 36mm full-frame | Standard |
| Position | (0, -5.5, 1.4) | Eye-level on a 1.8m character |
| Aim | (0, 0, 1.2) | Chest height |
| F-stop | 2.8 | Shallow DOF, mild background blur (though background is dark) |
| Resolution | 1024 × 1280 (portrait, 4:5) | Brief spec |

Character will be turned ~15° toward camera (3/4 view) so bow profile is partially visible without obscuring the chest plate.

---

## 6 · Render-time estimates (CPU only)

Calibrated for Intel integrated GPU → CPU-only Cycles. Numbers below assume 256 samples + OpenImageDenoise unless noted.

| Pass | Resolution | Samples | Estimated time |
| --- | --- | --- | --- |
| Padati Archer final | 1024×1280 | 256 + denoise | **15–30 min** (Cycles CPU + OIDN) |
| Padati Archer preview | 512×640 | 64 + denoise | ~3 min |
| Padati Archer Eevee fallback | 1024×1280 | 64 (Eevee Next) | ~1 min |
| Kurukshetra battlefield final | 2560×1440 | 256 + denoise | **60–120 min** |
| Kurukshetra preview | 1280×720 | 64 + denoise | ~15 min |

The battlefield render is the schedule risk. I'd run that overnight rather than during the day. The character render fits in a coffee break.

If you want renders under the brief's budgets (5 min / 15 min), I'd need to switch to Eevee Next as the final renderer for the character (loses SSS quality on skin) and accept lower particle/grass density on the battlefield. Tell me which trade you want.

---

## 7 · Specific risks

### 7.1 Dhoti drape (highest risk)

The reference shows a draped saffron dhoti with multiple vertical folds tapering toward the knee, plus an asymmetric front pleat. Cloth sim is out of scope per brief. Plan:

1. Start with a cylinder, 16 sides, height 0.9 unit (waist to mid-shin).
2. Cone-taper bottom slightly wider than top.
3. Add 8 vertical loop cuts.
4. Manually move alternate verts inward/outward to fake fold geometry.
5. Add subsurf 2 + smooth shading.
6. Use a `displacement` modifier with a vertical-stripe noise texture for micro-folds.

Expected output: looks like static draped cloth from 5 meters. At close zoom, you'll see it's not a sim. Honest grade: a 5/10 dhoti.

Backup plan: if the static mesh approach reads wrong, fall back to a single 30-frame cloth sim, bake one frame, freeze that as a static mesh. Costs ~30 min of one-time setup. I'll only do this if (a) you ask for it or (b) the static approach looks worse than expected.

### 7.2 Face

Cannot match reference. Brief permits abstraction. Commitment: a clearly humanoid head with brow + nose + mouth subtly suggested, no eyes, deliberately stylized. Comparable to a Genshin Impact NPC's silhouette but without facial features. At portrait crop, this looks intentional. At close-up, it looks abstract.

If you want eyes added, that's a half-day of additional iteration (sphere whites + iris disc + pupil dot per eye, plus shaped eyelid extrusions). Out of current scope unless you flip the brief.

### 7.3 Recurve bow shape

Three risks:
- Getting the S-curve symmetric: I'll mirror about the grip point so top and bottom are guaranteed to match.
- Getting the bow to actually fit in the character's left hand (which is just a beveled cube): the grip will pass through the hand mesh; that's intentional and reads correctly at portrait distance.
- String tension: a true bow string is straight from tip to tip. With a drawn arrow it curves slightly. I'll model the relaxed-not-drawn state — straight string. If you want the drawn-string look (with arrow nocked), I'll add a single control point pulled back toward the character's right shoulder.

### 7.4 The four pre-flight risks from §0

Already documented above. Repeating because they affect schedule:
- 4.5 vs 4.2 LTS — likely fine
- Intel GPU only — render times 5–20× brief estimates
- `art/kurukshetra/` already exists — directory collision to resolve
- No reference image on disk — working from prose description

---

## 8 · Honest 1–10 vs the ZBrush reference

**My honest estimate: 3.5–4.5 out of 10.**

What that means concretely:
- The figure will be **recognizably humanoid** in warrior stance with bow.
- Materials will read **leather/fabric/skin/wood** by texture cue but not by detail (no pores, no fabric thread, no leather grain micrometer-level detail).
- Proportions will be **roughly Indian male warrior, mid-20s** silhouette — broad shoulders, tapered waist, defined thighs, but without anatomical muscle definition.
- The dhoti will **drape acceptably** at distance, look static up close.
- The face will be **clearly abstract** — no facial likeness possible.
- Lighting and rim accents will **feel cinematic** at portrait distance.

What it won't be:
- Anything that survives next to the reference image at full zoom.
- Anatomical accuracy (no muscle striation, no veins, no skin micro-detail).
- Sculpted folds in the dhoti (it'll be a manually-creased static mesh).
- A face you'd recognize as a specific person.

If we put this side-by-side with the ZBrush reference and ask "is this the same character?" — no. If we put it next to a Hades portrait or a Genshin NPC silhouette and ask "does this fit visually?" — yes, with the caveat that 2D illustration sets a different bar than 3D.

If the rendered output lands at 4/10 and the use case is **character portraits inside the PWA at 256×320 thumbnail size**, that's probably acceptable. If the use case is **hero marketing art at 4K**, it's not. I'd recommend judging the rendered output against thumbnail-scale use first.

---

## Decisions you need to make before I write code

1. **Blender version** — accept 4.5.10 LTS, or install 4.2 LTS side-by-side?
2. **GPU constraint** — accept (a) longer Cycles renders / (b) Eevee fallback / (c) Cycles + denoiser compromise? Default: (c).
3. **`art/kurukshetra/` reconciliation** — (a) keep both separate / (b) reuse the existing palette and scene_setup / (c) archive the old tree? Default: (a) for this spike.
4. **Reference image** — drop one in `blender/references/` before I start, or proceed from prose only?
5. **Color-management view** — AgX Punchy (default in 4.5, recommended for skin) or Filmic High Contrast (brief spec)?
6. **Dhoti backup plan** — pre-authorize the one-frame-cloth-bake fallback if static mesh looks wrong, or require a checkpoint before that?

Reply with answers (or "defaults" if you accept all defaults) and I'll write the five `.py` files plus the texture-fetch utility.

---

## STOP

This is the end of the plan. No `.py` files written. No renders attempted. Awaiting your call.
