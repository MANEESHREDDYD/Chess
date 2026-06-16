"""
Realistic Kurukshetra unit generator (procedural, Blender-authored).

This is the high-fidelity successor to generate-kurukshetra-production-glbs.py.
It builds continuous anatomical bodies with a Skin modifier (real torso, limbs,
fingers, toes, and joints), binds them to a dense armature with gripping and
fighting animation, applies synthesized PBR textures (skin/leather/metal/cloth/
wood/hide), and exports the same 12 runtime GLB slots.

Procedural ceiling note: this is stylized-realistic, original, code-authored
geometry. It is not a sculpted/scanned photoreal asset pack.
"""

from __future__ import annotations

import math
import os
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "assets" / "3d" / "kurukshetra-production-v1"
TEX_DIR = Path(os.environ.get("KURU_TEX_DIR", str(ROOT / ".cache" / "kurukshetra-textures")))
PREVIEW = os.environ.get("KURU_PREVIEW", "")
ONLY = os.environ.get("KURU_ONLY", "")  # "side:role" to build a single unit
TEX_RES = int(os.environ.get("KURU_TEX_RES", "512"))


# ---------------------------------------------------------------------------
# Procedural PBR texture synthesis (numpy -> PNG -> embedded in glTF)
# ---------------------------------------------------------------------------

_NOISE_CACHE: dict[tuple, np.ndarray] = {}
_MAT_CACHE: dict[str, bpy.types.Material] = {}


def _value_noise(res: int, cells: int, seed: int) -> np.ndarray:
    """Tileable smooth value noise in [0,1] at resolution res."""
    rng = np.random.default_rng(seed)
    lattice = rng.random((cells, cells))
    # bilinear upsample with wraparound
    xs = np.linspace(0, cells, res, endpoint=False)
    x0 = np.floor(xs).astype(int) % cells
    x1 = (x0 + 1) % cells
    fx = xs - np.floor(xs)
    fx = fx * fx * (3 - 2 * fx)  # smoothstep
    g = lattice[np.ix_(x0, x0)]
    gx1 = lattice[np.ix_(x1, x0)]
    top = g * (1 - fx)[:, None] + gx1 * fx[:, None]
    g2 = lattice[np.ix_(x0, x1)]
    gx2 = lattice[np.ix_(x1, x1)]
    bot = g2 * (1 - fx)[:, None] + gx2 * fx[:, None]
    out = top * (1 - fx)[None, :] + bot * fx[None, :]
    return out


def _fractal(res: int, seed: int, base_cells: int = 4, octaves: int = 5) -> np.ndarray:
    key = (res, seed, base_cells, octaves)
    if key in _NOISE_CACHE:
        return _NOISE_CACHE[key]
    total = np.zeros((res, res))
    amp = 1.0
    norm = 0.0
    cells = base_cells
    for o in range(octaves):
        total += amp * _value_noise(res, cells, seed + o * 17)
        norm += amp
        amp *= 0.5
        cells *= 2
    out = total / norm
    _NOISE_CACHE[key] = out
    return out


def _normal_from_height(height: np.ndarray, strength: float) -> np.ndarray:
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    nz = np.ones_like(height)
    length = np.sqrt(dx * dx + dy * dy + nz * nz)
    nrm = np.stack([-dx / length, -dy / length, nz / length], axis=-1)
    return nrm * 0.5 + 0.5


def _save_png(arr: np.ndarray, name: str) -> str:
    """arr: HxWx(3|4) floats in [0,1]. Returns saved filepath."""
    TEX_DIR.mkdir(parents=True, exist_ok=True)
    h, w = arr.shape[:2]
    if arr.shape[-1] == 3:
        arr = np.concatenate([arr, np.ones((h, w, 1))], axis=-1)
    img = bpy.data.images.new(name, w, h, alpha=True, float_buffer=False)
    img.colorspace_settings.name = "sRGB"
    flat = arr[::-1].reshape(-1).astype(np.float32)  # flip vertical for image space
    img.pixels.foreach_set(flat)
    path = str(TEX_DIR / f"{name}.png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    return path


def synth_material_set(name: str, base_rgb, *, grain: str, rough_lo: float, rough_hi: float,
                       bump: float, metallic: float, seed: int) -> dict:
    """Generate color/normal/roughness PNGs for one surface. Returns paths + params."""
    res = TEX_RES
    base = np.array(base_rgb, dtype=float)
    if grain == "skin":
        mottle = _fractal(res, seed, 3, 5)
        fine = _fractal(res, seed + 99, 16, 4)
        tone = 0.82 + 0.36 * mottle
        red = 0.04 * (fine - 0.5)
        color = np.stack([
            np.clip(base[0] * tone + red, 0, 1),
            np.clip(base[1] * tone, 0, 1),
            np.clip(base[2] * tone - red * 0.5, 0, 1),
        ], axis=-1)
        height = 0.6 * fine + 0.4 * mottle
    elif grain == "leather":
        cells = _fractal(res, seed, 24, 3)
        crack = np.abs(_fractal(res, seed + 5, 10, 4) - 0.5)
        tone = 0.78 + 0.4 * cells
        color = (base[None, None, :] * tone[..., None])
        color = np.clip(color - crack[..., None] * 0.25, 0, 1)
        height = 0.5 * cells + 0.5 * (1 - crack)
    elif grain == "cloth":
        warp = 0.5 + 0.5 * np.sin(np.linspace(0, res, res) * math.pi)
        weave = np.outer(warp, np.ones(res)) * np.outer(np.ones(res), warp)
        fade = _fractal(res, seed, 6, 4)
        tone = 0.8 + 0.3 * fade
        color = np.clip(base[None, None, :] * tone[..., None] * (0.85 + 0.15 * weave[..., None]), 0, 1)
        height = 0.5 * weave + 0.5 * fade
    elif grain == "metal":
        brush = _fractal(res, seed, 64, 2)
        scratch = _fractal(res, seed + 3, 40, 3)
        tone = 0.85 + 0.25 * brush
        color = np.clip(base[None, None, :] * tone[..., None], 0, 1)
        height = 0.7 * brush + 0.3 * scratch
    elif grain == "wood":
        rings = 0.5 + 0.5 * np.sin(np.linspace(0, 24 * math.pi, res))
        rings2 = np.outer(np.ones(res), rings)
        grain_n = _fractal(res, seed, 8, 4)
        warpv = rings2 * 0.7 + grain_n * 0.3
        tone = 0.7 + 0.45 * warpv
        color = np.clip(base[None, None, :] * tone[..., None], 0, 1)
        height = warpv
    elif grain == "hide":
        wrinkle = _fractal(res, seed, 18, 4)
        pores = _fractal(res, seed + 7, 48, 2)
        tone = 0.82 + 0.32 * wrinkle
        color = np.clip(base[None, None, :] * tone[..., None], 0, 1)
        height = 0.6 * wrinkle + 0.4 * pores
    else:  # smooth (ivory)
        n = _fractal(res, seed, 6, 3)
        tone = 0.92 + 0.12 * n
        color = np.clip(base[None, None, :] * tone[..., None], 0, 1)
        height = n
    rough = rough_lo + (rough_hi - rough_lo) * _fractal(res, seed + 31, 12, 3)
    rough3 = np.stack([rough, rough, rough], axis=-1)
    normal = _normal_from_height(height, bump)
    return {
        "color": _save_png(color, f"{name}_color"),
        "normal": _save_png(normal, f"{name}_normal"),
        "rough": _save_png(rough3, f"{name}_rough"),
        "metallic": metallic,
    }


def pbr_material(name: str, texset: dict) -> bpy.types.Material:
    if name in _MAT_CACHE:
        return _MAT_CACHE[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Metallic"].default_value = texset["metallic"]

    def tex(path, colorspace, x, y):
        node = nt.nodes.new("ShaderNodeTexImage")
        img = bpy.data.images.load(path, check_existing=True)
        img.colorspace_settings.name = colorspace
        node.image = img
        node.location = (x, y)
        return node

    col = tex(texset["color"], "sRGB", -700, 300)
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    rgh = tex(texset["rough"], "Non-Color", -700, 0)
    nt.links.new(rgh.outputs["Color"], bsdf.inputs["Roughness"])
    nrm_tex = tex(texset["normal"], "Non-Color", -700, -300)
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nmap.location = (-400, -300)
    nmap.inputs["Strength"].default_value = 0.8
    nt.links.new(nrm_tex.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    _MAT_CACHE[name] = mat
    return mat


def build_all_materials() -> dict:
    """Synthesize every surface once; return name -> Material."""
    if _MAT_CACHE:
        return _MAT_CACHE
    specs = [
        ("skin_pandava", (0.86, 0.59, 0.40), dict(grain="skin", rough_lo=0.45, rough_hi=0.68, bump=1.8, metallic=0, seed=11)),
        ("skin_kaurava", (0.78, 0.52, 0.35), dict(grain="skin", rough_lo=0.45, rough_hi=0.68, bump=1.8, metallic=0, seed=12)),
        ("skin_shadow_pandava", (0.62, 0.42, 0.29), dict(grain="skin", rough_lo=0.5, rough_hi=0.74, bump=2.1, metallic=0, seed=13)),
        ("skin_shadow_kaurava", (0.56, 0.36, 0.25), dict(grain="skin", rough_lo=0.5, rough_hi=0.74, bump=2.1, metallic=0, seed=14)),
        ("hair", (0.035, 0.026, 0.02), dict(grain="hide", rough_lo=0.55, rough_hi=0.8, bump=3.0, metallic=0, seed=21)),
        ("leather_dark", (0.36, 0.23, 0.14), dict(grain="leather", rough_lo=0.5, rough_hi=0.78, bump=3.0, metallic=0, seed=31)),
        ("leather_warm", (0.60, 0.38, 0.21), dict(grain="leather", rough_lo=0.5, rough_hi=0.78, bump=3.0, metallic=0, seed=32)),
        ("cloth_saffron", (0.80, 0.40, 0.11), dict(grain="cloth", rough_lo=0.6, rough_hi=0.85, bump=2.5, metallic=0, seed=41)),
        ("cloth_indigo", (0.05, 0.13, 0.36), dict(grain="cloth", rough_lo=0.6, rough_hi=0.85, bump=2.5, metallic=0, seed=42)),
        ("cloth_wine", (0.34, 0.06, 0.05), dict(grain="cloth", rough_lo=0.6, rough_hi=0.85, bump=2.5, metallic=0, seed=43)),
        ("cloth_black", (0.04, 0.04, 0.05), dict(grain="cloth", rough_lo=0.6, rough_hi=0.85, bump=2.5, metallic=0, seed=44)),
        ("bronze", (0.62, 0.42, 0.20), dict(grain="metal", rough_lo=0.28, rough_hi=0.5, bump=1.6, metallic=1.0, seed=51)),
        ("brass", (0.86, 0.62, 0.26), dict(grain="metal", rough_lo=0.22, rough_hi=0.42, bump=1.4, metallic=1.0, seed=52)),
        ("steel", (0.62, 0.63, 0.66), dict(grain="metal", rough_lo=0.18, rough_hi=0.38, bump=1.4, metallic=1.0, seed=53)),
        ("iron_dark", (0.14, 0.14, 0.16), dict(grain="metal", rough_lo=0.32, rough_hi=0.55, bump=1.8, metallic=1.0, seed=54)),
        ("wood", (0.36, 0.21, 0.10), dict(grain="wood", rough_lo=0.4, rough_hi=0.65, bump=2.2, metallic=0, seed=61)),
        ("hide_chestnut", (0.30, 0.17, 0.09), dict(grain="hide", rough_lo=0.5, rough_hi=0.74, bump=2.6, metallic=0, seed=71)),
        ("hide_black", (0.08, 0.06, 0.05), dict(grain="hide", rough_lo=0.5, rough_hi=0.74, bump=2.6, metallic=0, seed=72)),
        ("hide_elephant", (0.30, 0.30, 0.29), dict(grain="hide", rough_lo=0.62, rough_hi=0.86, bump=3.2, metallic=0, seed=73)),
        ("hide_shadow", (0.16, 0.16, 0.15), dict(grain="hide", rough_lo=0.68, rough_hi=0.9, bump=3.4, metallic=0, seed=74)),
        ("ivory", (0.86, 0.80, 0.66), dict(grain="smooth", rough_lo=0.35, rough_hi=0.5, bump=1.0, metallic=0, seed=81)),
        ("war_paint_white", (0.82, 0.76, 0.62), dict(grain="smooth", rough_lo=0.62, rough_hi=0.88, bump=1.4, metallic=0, seed=91)),
        ("war_paint_blue", (0.02, 0.22, 0.62), dict(grain="cloth", rough_lo=0.62, rough_hi=0.9, bump=1.2, metallic=0, seed=92)),
        ("war_paint_red", (0.50, 0.04, 0.03), dict(grain="cloth", rough_lo=0.62, rough_hi=0.9, bump=1.2, metallic=0, seed=93)),
    ]
    for nm, rgb, kw in specs:
        pbr_material(nm, synth_material_set(nm, rgb, **kw))
    # plain eye material (no texture)
    eye = bpy.data.materials.new("eye")
    eye.use_nodes = True
    eb = eye.node_tree.nodes["Principled BSDF"]
    eb.inputs["Base Color"].default_value = (0.04, 0.025, 0.015, 1)
    eb.inputs["Roughness"].default_value = 0.25
    _MAT_CACHE["eye"] = eye
    return _MAT_CACHE


# ---------------------------------------------------------------------------
# Skin-modifier body construction
# ---------------------------------------------------------------------------

class SkinBuilder:
    """Accumulates a joint graph and produces one continuous skinned mesh."""

    def __init__(self) -> None:
        self.coords: list[tuple[float, float, float]] = []
        self.radii: list[tuple[float, float]] = []
        self.index: dict[str, int] = {}
        self.edges: list[tuple[int, int]] = []
        self.root: int | None = None

    def joint(self, name: str, co, radius: float, ry: float | None = None) -> str:
        self.index[name] = len(self.coords)
        self.coords.append((float(co[0]), float(co[1]), float(co[2])))
        self.radii.append((radius, radius if ry is None else ry))
        return name

    def bone(self, a: str, b: str) -> None:
        self.edges.append((self.index[a], self.index[b]))

    def set_root(self, name: str) -> None:
        self.root = self.index[name]

    def build(self, name: str, subsurf: int = 2) -> bpy.types.Object:
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.coords, self.edges, [])
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        skin = obj.modifiers.new("Skin", "SKIN")
        skin.use_smooth_shade = True
        layer = mesh.skin_vertices[0].data
        for i, (rx, ry) in enumerate(self.radii):
            layer[i].radius = (rx, ry)
        if self.root is not None:
            layer[self.root].use_root = True
        sub = obj.modifiers.new("Subsurf", "SUBSURF")
        sub.levels = subsurf
        sub.render_levels = subsurf
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier="Skin")
        bpy.ops.object.modifier_apply(modifier="Subsurf")
        bpy.ops.object.shade_smooth()
        return obj


def _finger_chain(sb: SkinBuilder, prefix: str, base, direction, lengths, radius, curl, side_sign):
    """Add a curled finger as a short joint chain; returns last joint name."""
    pos = Vector(base)
    d = Vector(direction).normalized()
    prev = sb.joint(f"{prefix}_0", pos, radius)
    names = [prev]
    # progressively rotate the segment direction around X to curl the finger
    for i, length in enumerate(lengths):
        ang = curl * (i + 1)
        rot = math.cos(ang), math.sin(ang)
        step = Vector((d.x, d.y * rot[0] - 0.0, d.z * rot[0] - length * rot[1] * 0.0))
        # curl mostly in the Y/Z plane: bend downward and inward
        seg = Vector((d.x, d.y * math.cos(ang), -abs(length) * math.sin(ang) - 0.0)) * 0
        # simpler explicit curl: advance forward (-Y) while dropping in Z
        adv = Vector((d.x * length * 0.25, -length * math.cos(ang), -length * math.sin(ang)))
        pos = pos + adv
        name = sb.joint(f"{prefix}_{i+1}", pos, radius * (0.85 ** (i + 1)))
        sb.bone(prev, name)
        prev = name
        names.append(name)
    return names[0]


def build_human_skeleton(sb: SkinBuilder, proportions: str = "archer", seated: bool = False) -> dict:
    """Define the full-body joint graph. Returns key joint coords for rigging."""
    broad = 1.12 if proportions == "commander" else 1.0

    # ---- spine / head ----  (waist taper + broad chest for a warrior build)
    sb.joint("pelvis", (0, 0, 0.90), 0.118 * broad)
    sb.joint("waist", (0, -0.012, 1.0), 0.105 * broad)
    sb.joint("spine1", (0, -0.012, 1.12), 0.128 * broad)
    sb.joint("chest", (0, -0.02, 1.31), 0.168 * broad)
    sb.joint("neck", (0, -0.005, 1.45), 0.05)
    sb.joint("head", (0, -0.012, 1.55), 0.098)
    sb.joint("jaw", (0, -0.045, 1.50), 0.07)
    sb.joint("headtop", (0, 0.01, 1.69), 0.066)
    sb.set_root("pelvis")
    for a, b in [("pelvis", "waist"), ("waist", "spine1"), ("spine1", "chest"), ("chest", "neck"),
                 ("neck", "head"), ("head", "headtop"), ("head", "jaw")]:
        sb.bone(a, b)

    keyjoints = {
        "pelvis": (0, 0, 0.92), "spine1": (0, 0, 1.06), "chest": (0, 0, 1.26),
        "neck": (0, 0, 1.45), "head": (0, 0, 1.57),
    }

    for s in (-1, 1):  # left = -1, right = +1
        tag = "L" if s < 0 else "R"
        x = s
        # ---- arm ----
        sb.joint(f"clav_{tag}", (x * 0.055, -0.01, 1.40), 0.05)
        sb.joint(f"shoulder_{tag}", (x * 0.185, -0.01, 1.345), 0.062)
        sb.joint(f"elbow_{tag}", (x * 0.300, -0.055, 1.12), 0.046)
        sb.joint(f"wrist_{tag}", (x * 0.395, -0.135, 0.92), 0.034)
        sb.joint(f"palm_{tag}", (x * 0.425, -0.175, 0.85), 0.044)
        sb.bone("chest", f"clav_{tag}")
        sb.bone(f"clav_{tag}", f"shoulder_{tag}")
        sb.bone(f"shoulder_{tag}", f"elbow_{tag}")
        sb.bone(f"elbow_{tag}", f"wrist_{tag}")
        sb.bone(f"wrist_{tag}", f"palm_{tag}")
        keyjoints[f"shoulder_{tag}"] = (x * 0.185, 0, 1.345)
        keyjoints[f"elbow_{tag}"] = (x * 0.300, -0.055, 1.12)
        keyjoints[f"wrist_{tag}"] = (x * 0.395, -0.135, 0.92)
        keyjoints[f"palm_{tag}"] = (x * 0.425, -0.175, 0.85)

        # ---- fingers (4) + thumb, curled into a grip ----
        palm = (x * 0.425, -0.175, 0.85)
        for fi, across in enumerate([-0.022, -0.007, 0.008, 0.024]):
            base = (palm[0] + x * 0.018, palm[1] - 0.03, palm[2] + across * 0.0 + 0.02 - fi * 0.006)
            start = (palm[0] + across * 0.6 * 0 + x * 0.02, palm[1] - 0.035, palm[2] + 0.018 - fi * 0.004)
            sb.joint(f"f{fi}a_{tag}", (palm[0] + (across) * 1.0 + x * 0.01, palm[1] - 0.03, palm[2] + 0.005),
                     0.013)
            sb.joint(f"f{fi}b_{tag}", (palm[0] + across * 1.0 + x * 0.02, palm[1] - 0.075, palm[2] - 0.01),
                     0.011)
            sb.joint(f"f{fi}c_{tag}", (palm[0] + across * 1.0 + x * 0.025, palm[1] - 0.09, palm[2] - 0.06),
                     0.009)
            sb.bone(f"palm_{tag}", f"f{fi}a_{tag}")
            sb.bone(f"f{fi}a_{tag}", f"f{fi}b_{tag}")
            sb.bone(f"f{fi}b_{tag}", f"f{fi}c_{tag}")
        # thumb (opposed, to the inner side)
        sb.joint(f"thumba_{tag}", (palm[0] - x * 0.03, palm[1] - 0.02, palm[2] + 0.02), 0.014)
        sb.joint(f"thumbb_{tag}", (palm[0] - x * 0.05, palm[1] - 0.055, palm[2] + 0.0), 0.011)
        sb.bone(f"palm_{tag}", f"thumba_{tag}")
        sb.bone(f"thumba_{tag}", f"thumbb_{tag}")

        # ---- leg ----  (wider stance + lower crotch so legs read separately)
        if seated:
            # straddle: thighs out and forward, shins drop down the mount's sides
            sb.joint(f"hip_{tag}", (x * 0.11, 0, 0.83), 0.082)
            sb.joint(f"thighmid_{tag}", (x * 0.2, -0.16, 0.78), 0.072)
            sb.joint(f"knee_{tag}", (x * 0.26, -0.26, 0.7), 0.057)
            sb.joint(f"ankle_{tag}", (x * 0.24, -0.18, 0.4), 0.045)
        else:
            sb.joint(f"hip_{tag}", (x * 0.105, 0, 0.83), 0.082)
            sb.joint(f"thighmid_{tag}", (x * 0.10, 0.006, 0.62), 0.072)
            sb.joint(f"knee_{tag}", (x * 0.092, 0.012, 0.46), 0.057)
            sb.joint(f"ankle_{tag}", (x * 0.085, 0.0, 0.085), 0.045)
        ank = sb.coords[sb.index[f"ankle_{tag}"]]
        az = ank[2]
        heel = (ank[0], ank[1] + 0.07, max(0.03, az - 0.055))
        ball = (ank[0], ank[1] - 0.12, max(0.03, az - 0.055))
        sb.joint(f"heel_{tag}", heel, 0.05)
        sb.joint(f"ball_{tag}", ball, 0.05)
        sb.bone("pelvis", f"hip_{tag}")
        sb.bone(f"hip_{tag}", f"thighmid_{tag}")
        sb.bone(f"thighmid_{tag}", f"knee_{tag}")
        sb.bone(f"knee_{tag}", f"ankle_{tag}")
        sb.bone(f"ankle_{tag}", f"heel_{tag}")
        sb.bone(f"ankle_{tag}", f"ball_{tag}")
        keyjoints[f"hip_{tag}"] = sb.coords[sb.index[f"hip_{tag}"]]
        keyjoints[f"knee_{tag}"] = sb.coords[sb.index[f"knee_{tag}"]]
        keyjoints[f"ankle_{tag}"] = ank
        # ---- toes (5) ----
        for ti, across in enumerate([-0.03, -0.015, 0.0, 0.015, 0.03]):
            sb.joint(f"toe{ti}_{tag}", (ball[0] + across, ball[1] - 0.05, ball[2] - 0.002), 0.013)
            sb.bone(f"ball_{tag}", f"toe{ti}_{tag}")

    return keyjoints


# ---------------------------------------------------------------------------
# Small primitives + face / hair detailing
# ---------------------------------------------------------------------------

def _prim_sphere(name, loc, scale, segs=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=max(8, segs // 2), location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    return o


def _prim_cone(name, loc, r1, r2, depth, verts=14):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc)
    o = bpy.context.object
    o.name = name
    return o


def _prim_cube(name, loc, scale):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    return o


def _prim_torus(name, loc, major, minor, segs=36):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=segs,
        minor_segments=8,
        location=loc,
    )
    o = bpy.context.object
    o.name = name
    return o


def _smooth(o, sub=1):
    if sub:
        m = o.modifiers.new("s", "SUBSURF")
        m.levels = sub
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    if sub:
        bpy.ops.object.modifier_apply(modifier="s")
    bpy.ops.object.shade_smooth()
    return o


def add_face_and_hair(body, mats: dict, hair_style: str = "warrior"):
    """Build face features + hair as small meshes, assign slots, join into body."""
    parts: list[tuple[bpy.types.Object, str]] = []

    # face features (head center ~ (0,-0.012,1.57); face looks toward -Y)
    nose = _prim_cone("nose", (0, -0.088, 1.53), 0.026, 0.008, 0.062, 12)
    nose.rotation_euler = (math.radians(104), 0, 0)
    parts.append((_smooth(nose, 1), "skin"))
    brow = _prim_cube("brow", (0, -0.078, 1.57), (0.075, 0.016, 0.012))
    brow.rotation_euler = (math.radians(6), 0, 0)
    parts.append((_smooth(brow, 1), "skin"))
    for sx in (-1, 1):
        # recessed eye set into a shallow socket, just under the brow
        eye = _prim_sphere(f"eye{sx}", (sx * 0.03, -0.07, 1.555), (0.013, 0.009, 0.012), 14)
        parts.append((_smooth(eye, 0), "eye"))
        upperlid = _prim_cube(f"lid{sx}", (sx * 0.03, -0.073, 1.563), (0.03, 0.012, 0.006))
        parts.append((_smooth(upperlid, 1), "skin"))
        ear = _prim_sphere(f"ear{sx}", (sx * 0.097, 0.005, 1.54), (0.014, 0.024, 0.032), 14)
        parts.append((_smooth(ear, 1), "skin"))

    # hair: scalp cap covering crown + back, leaving the face open
    cap = _prim_sphere("scalp", (0, 0.026, 1.615), (0.092, 0.098, 0.082), 24)
    parts.append((_smooth(cap, 1), "hair"))
    nape = _prim_sphere("nape", (0, 0.05, 1.525), (0.07, 0.055, 0.07), 18)
    parts.append((_smooth(nape, 1), "hair"))
    if hair_style == "warrior":
        bun = _prim_sphere("topknot", (0, 0.055, 1.715), (0.036, 0.04, 0.045), 18)
        parts.append((_smooth(bun, 1), "hair"))
    # short beard along the jaw
    beard = _prim_sphere("beard", (0, -0.03, 1.485), (0.072, 0.055, 0.05), 18)
    parts.append((_smooth(beard, 1), "hair"))
    moustache = _prim_cube("moustache", (0, -0.085, 1.512), (0.042, 0.01, 0.008))
    parts.append((_smooth(moustache, 1), "hair"))

    # assign material slots
    slot_for = {}
    for _, matname in parts:
        if matname not in slot_for:
            slot_for[matname] = True
    for o, matname in parts:
        if o.data.materials:
            o.data.materials[0] = mats[matname]
        else:
            o.data.materials.append(mats[matname])

    # join everything into the body (body keeps slot 0 = skin)
    bpy.ops.object.select_all(action="DESELECT")
    for o, _ in parts:
        o.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    return body


# ---------------------------------------------------------------------------
# Palette, clothing/armor, weapons
# ---------------------------------------------------------------------------

def palette_for(side: str) -> dict:
    if side == "pandava":
        return {"skin": "skin_pandava", "sash": "cloth_indigo", "dhoti": "cloth_saffron",
                "banner": "cloth_indigo", "leather": "leather_warm"}
    return {"skin": "skin_kaurava", "sash": "cloth_wine", "dhoti": "cloth_saffron",
            "banner": "cloth_wine", "leather": "leather_warm"}


def _curve_mesh(name, pts, bevel, mat_name, mats):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 10
    cu.bevel_depth = bevel
    cu.bevel_resolution = 3
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (co[0], co[1], co[2], 1)
    obj = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.data.materials.append(mats[mat_name])
    return obj


def build_clothing(side: str, role: str, mats: dict) -> list:
    p = palette_for(side)
    out = []

    # dhoti: pleated wrap from waist to mid-shin
    dhoti = _prim_cone("dhoti", (0, 0, 0.66), 0.165, 0.235, 0.46, 28)
    out.append((_smooth(dhoti, 1), p["dhoti"]))
    for sx in (-1, 1):
        thigh_cloth = _prim_cone(f"dhoti trouser thigh{sx}", (sx * 0.09, -0.008, 0.55), 0.064, 0.082, 0.38, 18)
        out.append((_smooth(thigh_cloth, 1), p["dhoti"]))
        shin_cloth = _prim_cone(f"dhoti trouser shin{sx}", (sx * 0.086, -0.002, 0.27), 0.046, 0.064, 0.32, 16)
        out.append((_smooth(shin_cloth, 1), p["dhoti"]))
        crease = _curve_mesh(f"dhoti leg crease{sx}", [(sx * 0.09, -0.075, 0.68), (sx * 0.092, -0.08, 0.47), (sx * 0.088, -0.066, 0.18)], 0.004, "cloth_wine" if side == "kaurava" else "cloth_indigo", mats)
        out.append((crease, "cloth_wine" if side == "kaurava" else "cloth_indigo"))
    for i, ang in enumerate(np.linspace(-2.7, 2.7, 11)):
        fold = _prim_cube(f"fold{i}", (math.sin(ang) * 0.2, -math.cos(ang) * 0.2, 0.6),
                          (0.02, 0.02, 0.22))
        fold.rotation_euler = (0, 0, ang)
        out.append((_smooth(fold, 0), p["dhoti"]))

    # leather cuirass over the chest
    cuirass = _prim_sphere("cuirass", (0, -0.025, 1.27), (0.19, 0.13, 0.2), 24)
    out.append((_smooth(cuirass, 1), p["leather"]))
    backplate = _prim_sphere("backplate", (0, 0.046, 1.27), (0.15, 0.062, 0.16), 20)
    out.append((_smooth(backplate, 1), p["leather"]))
    for sx in (-1, 1):
        backstrap = _curve_mesh(f"cross back leather strap{sx}", [(sx * -0.13, 0.13, 1.39), (0, 0.15, 1.25), (sx * 0.13, 0.13, 1.08)], 0.012, p["leather"], mats)
        out.append((backstrap, p["leather"]))
    # bronze studs on the cuirass
    for r, z in enumerate([1.34, 1.24, 1.14]):
        for c, ax in enumerate(np.linspace(-0.12, 0.12, 5)):
            stud = _prim_sphere(f"stud{r}{c}", (ax, -0.14 + abs(ax) * 0.3, z), (0.012, 0.008, 0.012), 10)
            out.append((_smooth(stud, 0), "brass"))
    # shoulder pauldrons
    for sx in (-1, 1):
        pa = _prim_sphere(f"pauldron{sx}", (sx * 0.19, -0.01, 1.36), (0.07, 0.07, 0.05), 18)
        out.append((_smooth(pa, 1), "bronze"))

    # waist belt + sash
    belt = _prim_cube("belt", (0, -0.01, 1.0), (0.34, 0.26, 0.05))
    belt = _bevel_join_safe(belt)
    out.append((belt, "leather_dark"))
    buckle = _prim_cube("buckle", (0, -0.16, 1.0), (0.05, 0.02, 0.05))
    out.append((_smooth(buckle, 1), "brass"))
    sash = _prim_cube("sash", (0, -0.02, 1.18), (0.42, 0.05, 0.05))
    sash.rotation_euler = (0, math.radians(-22), 0)
    out.append((_smooth(sash, 1), p["sash"]))

    # headband: thin ring, not a blocky helmet.
    band = _prim_torus("cloth headband ring", (0, -0.002, 1.6), 0.098, 0.01, 42)
    out.append((_smooth(band, 0), p["sash"]))
    knot = _prim_sphere("headband rear knot", (0, 0.104, 1.6), (0.026, 0.018, 0.018), 10)
    out.append((_smooth(knot, 0), p["sash"]))
    # sacred thread
    thread = _curve_mesh("thread", [(-0.13, -0.13, 1.36), (0.0, -0.16, 1.2), (0.12, -0.12, 1.02)],
                         0.006, "brass", mats)
    out.append((thread, "brass"))

    # wrist + ankle guards
    for sx in (-1, 1):
        wg = _prim_sphere(f"wristguard{sx}", (sx * 0.39, -0.13, 0.95), (0.05, 0.05, 0.06), 16)
        out.append((_smooth(wg, 1), "bronze"))
        ag = _prim_sphere(f"ankleguard{sx}", (sx * 0.085, 0.0, 0.13), (0.06, 0.06, 0.05), 14)
        out.append((_smooth(ag, 1), p["leather"]))
    return out


def _bevel_join_safe(o):
    m = o.modifiers.new("b", "BEVEL")
    m.width = 0.01
    m.segments = 2
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier="b")
    bpy.ops.object.shade_smooth()
    return o


def build_weapons(side: str, role: str, mats: dict) -> list:
    p = palette_for(side)
    out = []
    if role == "foot-archer":
        # recurve bow gripped in the left hand (rest position)
        bow = _curve_mesh("bow", [(-0.46, -0.2, 0.5), (-0.52, -0.26, 0.7), (-0.5, -0.24, 0.85),
                                  (-0.52, -0.26, 1.0), (-0.46, -0.2, 1.2)], 0.014, "wood", mats)
        out.append((bow, "wood"))
        string = _curve_mesh("bowstring", [(-0.46, -0.2, 0.5), (-0.44, -0.18, 0.85), (-0.46, -0.2, 1.2)],
                             0.004, "steel", mats)
        out.append((string, "steel"))
        grip = _prim_cube("wrapped bow grip", (-0.5, -0.24, 0.85), (0.026, 0.018, 0.095))
        out.append((_smooth(grip, 1), p["leather"]))
        hand_wrap = _prim_torus("left hand wrapped around bow", (-0.43, -0.19, 0.85), 0.038, 0.006, 26)
        hand_wrap.rotation_euler = (math.radians(90), 0, math.radians(12))
        out.append((_smooth(hand_wrap, 0), "war_paint_white"))
        draw_wrap = _prim_torus("right draw fingers on arrow", (0.42, -0.185, 0.86), 0.03, 0.005, 24)
        draw_wrap.rotation_euler = (math.radians(90), 0, math.radians(-8))
        out.append((_smooth(draw_wrap, 0), "war_paint_white"))
        arrow = _prim_cube("arrow", (-0.1, -0.19, 0.86), (0.34, 0.006, 0.006))
        out.append((_smooth(arrow, 0), "wood"))
        tip = _prim_cone("arrowtip", (-0.45, -0.19, 0.86), 0.014, 0.0, 0.05, 10)
        tip.rotation_euler = (0, math.radians(-90), 0)
        out.append((_smooth(tip, 0), "steel"))
        for i, dz in enumerate([-0.018, 0.0, 0.018]):
            feather = _prim_cone(f"drawn-arrow-feather{i}", (0.24, -0.19, 0.86 + dz), 0.014, 0.0, 0.045, 8)
            feather.rotation_euler = (0, math.radians(90), math.radians(90 + i * 120))
            out.append((_smooth(feather, 0), p["banner"]))
        # quiver on the back + arrows
        quiver = _prim_cone("quiver", (0.1, 0.16, 1.2), 0.05, 0.04, 0.34, 14)
        quiver.rotation_euler = (math.radians(18), 0, 0)
        out.append((_smooth(quiver, 1), p["leather"]))
        for i in range(5):
            qa = _prim_cube(f"qarrow{i}", (0.08 + i * 0.015, 0.14, 1.42), (0.005, 0.005, 0.18))
            qa.rotation_euler = (math.radians(18), 0, 0)
            out.append((_smooth(qa, 0), "wood"))
            fl = _prim_cone(f"fletch{i}", (0.08 + i * 0.015, 0.18, 1.52), 0.018, 0.0, 0.04, 8)
            out.append((_smooth(fl, 0), p["banner"]))
    elif role == "advisor-standard-bearer":
        grip_y = -0.165
        pole = _prim_cube("pole", (0.4, grip_y, 1.1), (0.012, 0.012, 1.2))
        out.append((_smooth(pole, 0), "wood"))
        spear = _prim_cone("spearhead", (0.4, grip_y, 1.78), 0.04, 0.0, 0.16, 12)
        out.append((_smooth(spear, 0), "steel"))
        banner = _prim_cube("banner", (0.48, grip_y, 1.45), (0.14, 0.008, 0.26))
        out.append((_smooth(banner, 0), p["banner"]))
        grip_wrap = _prim_cube("spear leather grip wrap", (0.4, grip_y, 0.96), (0.024, 0.024, 0.16))
        out.append((_smooth(grip_wrap, 1), p["leather"]))
        hand_wrap = _prim_torus("right hand gripping pole", (0.405, -0.18, 0.9), 0.035, 0.006, 26)
        hand_wrap.rotation_euler = (math.radians(90), 0, 0)
        out.append((_smooth(hand_wrap, 0), "war_paint_white"))
        for i, z in enumerate([1.34, 1.45, 1.56]):
            trim = _prim_cube(f"bannertrim{i}", (0.48, grip_y - 0.002, z), (0.14, 0.01, 0.012))
            out.append((_smooth(trim, 0), "brass"))
    else:  # royal-commander
        crown = _prim_cone("crown", (0, 0.0, 1.72), 0.09, 0.05, 0.12, 20)
        out.append((_smooth(crown, 1), "brass"))
        for i, ang in enumerate(np.linspace(0, 2 * math.pi, 8, endpoint=False)):
            jewel = _prim_sphere(f"jewel{i}", (math.sin(ang) * 0.085, math.cos(ang) * 0.085, 1.72),
                                 (0.012, 0.012, 0.018), 8)
            out.append((_smooth(jewel, 0), "bronze"))
        # sword in the right hand
        blade = _prim_cube("blade", (0.46, -0.2, 1.05), (0.03, 0.012, 0.34))
        out.append((_smooth(blade, 0), "steel"))
        fuller = _prim_cube("sword central fuller", (0.46, -0.214, 1.05), (0.006, 0.004, 0.26))
        out.append((_smooth(fuller, 0), "iron_dark"))
        guard = _prim_cube("guard", (0.46, -0.2, 0.87), (0.1, 0.03, 0.02))
        out.append((_smooth(guard, 1), "brass"))
        grip = _prim_cube("grip", (0.46, -0.2, 0.81), (0.018, 0.018, 0.08))
        out.append((_smooth(grip, 1), p["leather"]))
        hand_wrap = _prim_torus("right hand gripping sword", (0.43, -0.185, 0.84), 0.035, 0.006, 26)
        hand_wrap.rotation_euler = (math.radians(90), 0, math.radians(-16))
        out.append((_smooth(hand_wrap, 0), "war_paint_white"))
        pommel = _prim_sphere("pommel", (0.46, -0.2, 0.76), (0.025, 0.025, 0.025), 12)
        out.append((_smooth(pommel, 0), "brass"))
        # round shield on the left forearm
        shield = _prim_cone("shield", (-0.42, -0.22, 1.0), 0.16, 0.16, 0.04, 28)
        shield.rotation_euler = (math.radians(90), 0, 0)
        out.append((_smooth(shield, 1), "bronze"))
        rim = _prim_torus("shield raised rim", (-0.42, -0.245, 1.0), 0.155, 0.009, 42)
        rim.rotation_euler = (math.radians(90), 0, 0)
        out.append((_smooth(rim, 0), "brass"))
        boss = _prim_sphere("shieldboss", (-0.42, -0.26, 1.0), (0.04, 0.03, 0.04), 14)
        out.append((_smooth(boss, 1), "brass"))
    return out


def build_body_micro_details(side: str, mats: dict, seated: bool = False) -> list:
    """Small visible anatomical details: nails, knuckles, joints, tendons, paint."""
    p = palette_for(side)
    skin = p["skin"]
    shadow = "skin_shadow_pandava" if side == "pandava" else "skin_shadow_kaurava"
    paint = "war_paint_blue" if side == "pandava" else "war_paint_red"
    out = []

    # Face marks and lips/cheek planes survive board-camera distance better than
    # pure texture marks on this procedural mesh.
    out.append((_smooth(_prim_cube("vertical forehead tilak", (0, -0.096, 1.632), (0.012, 0.005, 0.048)), 0), "war_paint_white"))
    out.append((_smooth(_prim_cube("left cheek paint stripe", (-0.052, -0.094, 1.545), (0.035, 0.005, 0.007)), 0), paint))
    out.append((_smooth(_prim_cube("right cheek paint stripe", (0.052, -0.094, 1.545), (0.035, 0.005, 0.007)), 0), paint))
    out.append((_smooth(_prim_cube("lower lip shadow", (0, -0.096, 1.49), (0.038, 0.005, 0.007)), 0), shadow))

    # Collarbones, sternum, abdomen planes, elbows, knees, ankles, and wrist
    # tendons add the anatomical read the user asked for without licensed scans.
    for sx in (-1, 1):
        out.append((_curve_mesh(f"collarbone{sx}", [(sx * 0.02, -0.115, 1.35), (sx * 0.09, -0.12, 1.335), (sx * 0.16, -0.09, 1.32)], 0.005, shadow, mats), shadow))
        out.append((_curve_mesh(f"forearm tendon{sx}", [(sx * 0.31, -0.14, 1.08), (sx * 0.36, -0.17, 0.98), (sx * 0.40, -0.19, 0.88)], 0.004, shadow, mats), shadow))
        out.append((_smooth(_prim_sphere(f"elbow cap{sx}", (sx * 0.302, -0.064, 1.12), (0.033, 0.025, 0.032), 12), 1), skin))
        out.append((_smooth(_prim_sphere(f"knee cap{sx}", (sx * 0.092, -0.034, 0.47), (0.04, 0.026, 0.033), 12), 1), skin))
        out.append((_smooth(_prim_sphere(f"ankle bone outer{sx}", (sx * 0.106, -0.006, 0.1), (0.018, 0.014, 0.022), 10), 0), skin))

    out.append((_curve_mesh("sternum groove", [(0, -0.13, 1.32), (0, -0.14, 1.22), (0, -0.13, 1.1)], 0.004, shadow, mats), shadow))
    for i, z in enumerate([1.18, 1.105, 1.03]):
        out.append((_curve_mesh(f"abdominal plane left{i}", [(-0.04, -0.13, z), (-0.09, -0.128, z - 0.02)], 0.0035, shadow, mats), shadow))
        out.append((_curve_mesh(f"abdominal plane right{i}", [(0.04, -0.13, z), (0.09, -0.128, z - 0.02)], 0.0035, shadow, mats), shadow))

    # Fingers and toes are already part of the Skin mesh; these nail and knuckle
    # shells make them visible after export and compression.
    for sx in (-1, 1):
        palm_x = sx * 0.425
        for fi, across in enumerate([-0.022, -0.007, 0.008, 0.024]):
            x = palm_x + across + sx * 0.025
            y = -0.266
            z = 0.787 - fi * 0.004
            out.append((_smooth(_prim_sphere(f"finger knuckle {sx}-{fi}", (x - sx * 0.018, -0.222, z + 0.035), (0.012, 0.008, 0.009), 8), 0), skin))
            out.append((_smooth(_prim_cube(f"fingernail {sx}-{fi}", (x, y, z), (0.011, 0.003, 0.008)), 0), "ivory"))
        out.append((_smooth(_prim_cube(f"thumbnail {sx}", (palm_x - sx * 0.055, -0.228, 0.852), (0.011, 0.003, 0.008)), 0), "ivory"))

        ankle_x = sx * (0.24 if seated else 0.085)
        for ti, across in enumerate([-0.03, -0.015, 0.0, 0.015, 0.03]):
            out.append((_smooth(_prim_cube(f"toenail {sx}-{ti}", (ankle_x + across, -0.178, 0.028), (0.011, 0.006, 0.004)), 0), "ivory"))

    return out


# ---------------------------------------------------------------------------
# Rig + skinning + animation
# ---------------------------------------------------------------------------

def _seg_dist(p, a, b):
    ab = b - a
    d = ab.length_squared
    if d < 1e-9:
        return (p - a).length
    t = max(0.0, min(1.0, (p - a).dot(ab) / d))
    return (p - (a + ab * t)).length


def build_unit_armature(side: str, role: str, kj: dict) -> bpy.types.Object:
    data = bpy.data.armatures.new(f"{side}-{role}-skeleton")
    arm = bpy.data.objects.new(f"{side}-{role}-runtime-root", data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = data.edit_bones

    def mk(name, head, tail, parent):
        b = eb.new(name)
        b.head = head
        b.tail = tail
        b.use_connect = False
        if parent:
            b.parent = eb[parent]
        return b

    mk("pelvis", kj["pelvis"], kj["spine1"], None)
    mk("spine", kj["spine1"], kj["chest"], "pelvis")
    mk("chest", kj["chest"], kj["neck"], "spine")
    mk("neck", kj["neck"], kj["head"], "chest")
    mk("head", kj["head"], (0, 0, 1.69), "neck")
    for tag in ("L", "R"):
        mk(f"clav_{tag}", kj["chest"], kj[f"shoulder_{tag}"], "chest")
        mk(f"upperarm_{tag}", kj[f"shoulder_{tag}"], kj[f"elbow_{tag}"], f"clav_{tag}")
        mk(f"forearm_{tag}", kj[f"elbow_{tag}"], kj[f"wrist_{tag}"], f"upperarm_{tag}")
        mk(f"hand_{tag}", kj[f"wrist_{tag}"], kj[f"palm_{tag}"], f"forearm_{tag}")
        mk(f"thigh_{tag}", kj[f"hip_{tag}"], kj[f"knee_{tag}"], "pelvis")
        mk(f"shin_{tag}", kj[f"knee_{tag}"], kj[f"ankle_{tag}"], f"thigh_{tag}")
        foot_tail = (kj[f"ankle_{tag}"][0], -0.18, 0.0)
        mk(f"foot_{tag}", kj[f"ankle_{tag}"], foot_tail, f"shin_{tag}")
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def soft_bind(mesh, arm):
    bones = [(b.name, Vector(b.head_local), Vector(b.tail_local)) for b in arm.data.bones]
    groups = {n: mesh.vertex_groups.new(name=n) for n, _, _ in bones}
    for v in mesh.data.vertices:
        co = v.co
        ranked = sorted(((_seg_dist(co, h, t), n) for n, h, t in bones), key=lambda r: r[0])
        d0, n0 = ranked[0]
        d1, n1 = ranked[1]
        if d1 < d0 * 1.6 + 1e-5:
            w0 = 1.0 / (d0 + 1e-4)
            w1 = 1.0 / (d1 + 1e-4)
            s = w0 + w1
            groups[n0].add([v.index], w0 / s, "REPLACE")
            groups[n1].add([v.index], w1 / s, "REPLACE")
        else:
            groups[n0].add([v.index], 1.0, "REPLACE")
    mesh.parent = arm
    mod = mesh.modifiers.new("Armature", "ARMATURE")
    mod.object = arm


def _clip(arm, name, entries):
    action = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = action
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
    for frame, rot, loc in entries:
        for bn, r in rot.items():
            if bn in arm.pose.bones:
                pb = arm.pose.bones[bn]
                pb.rotation_euler = r
                pb.keyframe_insert("rotation_euler", frame=frame)
        if loc is not None:
            arm.location = loc
            arm.keyframe_insert("location", frame=frame)
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(action.frame_range[0]), action)
    strip.name = name
    arm.animation_data.action = None
    arm.location = (0, 0, 0)


def animate_unit(arm, role):
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end, sc.render.fps = 1, 72, 24
    r = math.radians
    z = (0, 0, 0)
    # Idle: breathing + weight shift; bow/standard arm slightly raised for a ready stance.
    ready_L = (r(-18), 0, 0)
    _clip(arm, "idle", [
        (1, {"chest": z, "head": z, "upperarm_L": ready_L, "upperarm_R": z}, (0, 0, 0)),
        (24, {"chest": (r(1.5), 0, r(1)), "head": (r(-1), 0, r(1.2)), "upperarm_L": (r(-19), 0, 0)}, (0, 0, 0.006)),
        (48, {"chest": (r(-1), 0, r(-1)), "head": (r(1), 0, r(-1.2)), "upperarm_L": (r(-17), 0, 0)}, (0, 0, 0)),
        (72, {"chest": z, "head": z, "upperarm_L": ready_L, "upperarm_R": z}, (0, 0, 0)),
    ])
    # March: alternating legs, counter-swinging arms, torso bob.
    _clip(arm, "move", [
        (1, {"thigh_L": z, "thigh_R": z, "shin_L": z, "shin_R": z, "upperarm_L": ready_L, "upperarm_R": z, "spine": z}, (0, 0, 0)),
        (7, {"thigh_L": (r(26), 0, 0), "thigh_R": (r(-24), 0, 0), "shin_L": (r(-26), 0, 0), "shin_R": (r(14), 0, 0), "upperarm_L": (r(-26), 0, 0), "upperarm_R": (r(22), 0, 0), "spine": (r(2.5), 0, 0)}, (0, 0, 0.022)),
        (13, {"thigh_L": z, "thigh_R": z, "shin_L": z, "shin_R": z, "upperarm_L": ready_L, "upperarm_R": z, "spine": z}, (0, 0, 0)),
        (19, {"thigh_L": (r(-24), 0, 0), "thigh_R": (r(26), 0, 0), "shin_L": (r(14), 0, 0), "shin_R": (r(-26), 0, 0), "upperarm_L": (r(-6), 0, 0), "upperarm_R": (r(-22), 0, 0), "spine": (r(2.5), 0, 0)}, (0, 0, 0.022)),
        (25, {"thigh_L": z, "thigh_R": z, "shin_L": z, "shin_R": z, "upperarm_L": ready_L, "upperarm_R": z, "spine": z}, (0, 0, 0)),
    ])
    # Attack: role-specific fighting motion.
    if role == "foot-archer":
        attack = [
            (1, {"chest": z, "upperarm_L": ready_L, "forearm_R": z, "upperarm_R": z}, None),
            (10, {"chest": (0, 0, r(12)), "upperarm_L": (r(-34), 0, r(6)), "upperarm_R": (r(-30), 0, r(-10)), "forearm_R": (r(-40), 0, 0)}, None),
            (16, {"chest": (0, 0, r(-6)), "upperarm_L": (r(-30), 0, 0), "upperarm_R": (r(-6), 0, 0), "forearm_R": (r(-6), 0, 0)}, None),
            (28, {"chest": z, "upperarm_L": ready_L, "forearm_R": z, "upperarm_R": z}, None),
        ]
    elif role == "advisor-standard-bearer":
        attack = [
            (1, {"chest": z, "upperarm_R": z, "forearm_R": z, "spine": z}, None),
            (9, {"chest": (0, 0, r(-14)), "upperarm_R": (r(-46), 0, 0), "forearm_R": (r(-20), 0, 0), "spine": (r(-4), 0, 0)}, None),
            (15, {"chest": (0, 0, r(10)), "upperarm_R": (r(40), 0, 0), "forearm_R": (r(18), 0, 0), "spine": (r(6), 0, 0)}, None),
            (26, {"chest": z, "upperarm_R": z, "forearm_R": z, "spine": z}, None),
        ]
    else:
        attack = [
            (1, {"chest": z, "upperarm_R": z, "forearm_R": z, "spine": z}, None),
            (9, {"chest": (0, 0, r(-10)), "upperarm_R": (r(-80), 0, 0), "forearm_R": (r(-30), 0, 0), "spine": (r(-3), 0, 0)}, None),
            (15, {"chest": (0, 0, r(14)), "upperarm_R": (r(30), 0, 0), "forearm_R": (r(10), 0, 0), "spine": (r(7), 0, 0)}, None),
            (26, {"chest": z, "upperarm_R": z, "forearm_R": z, "spine": z}, None),
        ]
    _clip(arm, "attack", attack)
    # Hit: recoil back.
    _clip(arm, "hit", [
        (1, {"spine": z, "chest": z, "head": z, "upperarm_L": ready_L, "upperarm_R": z}, (0, 0, 0)),
        (9, {"spine": (r(16), 0, 0), "chest": (r(8), 0, 0), "head": (r(14), 0, 0), "upperarm_L": (r(8), 0, 0), "upperarm_R": (r(-22), 0, 0)}, (0, 0.02, -0.01)),
        (18, {"spine": (r(-5), 0, 0), "chest": (r(-3), 0, 0), "head": (r(-5), 0, 0), "upperarm_L": ready_L, "upperarm_R": (r(6), 0, 0)}, (0, 0, 0)),
        (34, {"spine": z, "chest": z, "head": z, "upperarm_L": ready_L, "upperarm_R": z}, (0, 0, 0)),
    ])
    # Check (king): raise weapon and chest.
    _clip(arm, "check", [
        (1, {"chest": z, "head": z, "upperarm_R": z, "forearm_R": z}, (0, 0, 0)),
        (10, {"chest": (r(-7), 0, 0), "head": (r(-9), 0, 0), "upperarm_R": (r(-95), 0, 0), "forearm_R": (r(-26), 0, 0)}, (0, 0, 0.02)),
        (20, {"chest": (r(-5), 0, 0), "head": (r(-7), 0, 0), "upperarm_R": (r(-88), 0, 0), "forearm_R": (r(-30), 0, 0)}, (0, 0, 0.01)),
        (30, {"chest": (r(-7), 0, 0), "head": (r(-9), 0, 0), "upperarm_R": (r(-98), 0, 0), "forearm_R": (r(-22), 0, 0)}, (0, 0, 0.02)),
        (48, {"chest": z, "head": z, "upperarm_R": z, "forearm_R": z}, (0, 0, 0)),
    ])
    arm["animation_clips"] = "idle,move,attack,hit,check"


def assemble_meshes(parts: list, mats: dict | None = None) -> bpy.types.Object:
    """parts: list of (obj, mat_name); assign missing materials, then join."""
    if mats is not None:
        for obj, mat_name in parts:
            if obj.type != "MESH":
                continue
            if obj.data.materials:
                obj.data.materials[0] = mats[mat_name]
            else:
                obj.data.materials.append(mats[mat_name])
    bpy.ops.object.select_all(action="DESELECT")
    objs = [o for o, _ in parts]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


def build_human_mesh(side: str, role: str, prop: str = "archer", seated: bool = False):
    """Build the full human (body+face+hair+clothing+weapons) joined into one mesh.
    Returns (mesh_obj, keyjoints). Not UV-unwrapped, not rigged."""
    mats = build_all_materials()
    p = palette_for(side)
    sb = SkinBuilder()
    kj = build_human_skeleton(sb, prop, seated=seated)
    body = sb.build("body", subsurf=2)
    body.data.materials.append(mats[p["skin"]])
    add_face_and_hair(body, {"skin": mats[p["skin"]], "hair": mats["hair"], "eye": mats["eye"]}, "warrior")

    extras = (
        build_body_micro_details(side, mats, seated=seated)
        + build_clothing(side, role, mats)
        + build_weapons(side, role, mats)
    )
    for o, mn in extras:
        if o.data.materials:
            o.data.materials[0] = mats[mn]
        else:
            o.data.materials.append(mats[mn])

    mesh = assemble_meshes([(body, p["skin"])] + extras, mats)
    mesh.name = f"{side}-{role}-mesh"
    return mesh, kj


def build_human_unit(side: str, role: str) -> bpy.types.Object:
    prop = "commander" if role == "royal-commander" else "archer"
    unit, kj = build_human_mesh(side, role, prop)
    uv_unwrap(unit)
    arm = build_unit_armature(side, role, kj)
    soft_bind(unit, arm)
    animate_unit(arm, role)
    return arm


# ---------------------------------------------------------------------------
# Animals (skin-modifier anatomy), chariot, mounted assembly
# ---------------------------------------------------------------------------

def build_horse(side: str, mats: dict, dark: bool = False, scale: float = 1.0,
                loc=(0, 0, 0)) -> list:
    hide = "hide_black" if dark else "hide_chestnut"
    sb = SkinBuilder()
    # spine (faces -Y), z up
    sb.joint("croup", (0, 0.62, 0.86), 0.2)
    sb.joint("back", (0, 0.28, 0.92), 0.23)
    sb.joint("withers", (0, -0.18, 0.92), 0.22)
    sb.joint("neckbase", (0, -0.42, 0.96), 0.16)
    sb.joint("neck", (0, -0.62, 1.12), 0.12)
    sb.joint("poll", (0, -0.78, 1.22), 0.1)
    sb.joint("muzzle", (0, -0.98, 1.08), 0.07)
    sb.set_root("withers")
    for a, b in [("croup", "back"), ("back", "withers"), ("withers", "neckbase"),
                 ("neckbase", "neck"), ("neck", "poll"), ("poll", "muzzle")]:
        sb.bone(a, b)
    for sx in (-1, 1):
        t = "L" if sx < 0 else "R"
        # front legs from withers, hind from croup
        sb.joint(f"fsh_{t}", (sx * 0.16, -0.2, 0.78), 0.085)
        sb.joint(f"fknee_{t}", (sx * 0.17, -0.18, 0.42), 0.05)
        sb.joint(f"fhoof_{t}", (sx * 0.17, -0.16, 0.02), 0.05)
        sb.bone("withers", f"fsh_{t}")
        sb.bone(f"fsh_{t}", f"fknee_{t}")
        sb.bone(f"fknee_{t}", f"fhoof_{t}")
        sb.joint(f"hhip_{t}", (sx * 0.17, 0.5, 0.78), 0.1)
        sb.joint(f"hknee_{t}", (sx * 0.18, 0.46, 0.42), 0.055)
        sb.joint(f"hhoof_{t}", (sx * 0.18, 0.5, 0.02), 0.05)
        sb.bone("croup", f"hhip_{t}")
        sb.bone(f"hhip_{t}", f"hknee_{t}")
        sb.bone(f"hknee_{t}", f"hhoof_{t}")
    horse = sb.build(f"{side}-horse", subsurf=2)
    horse.data.materials.append(mats[hide])
    out = [(horse, hide)]
    # mane, tail, ears, eyes
    mane = _curve_mesh("mane", [(0, -0.74, 1.28), (0, -0.5, 1.12), (0, -0.24, 1.0)], 0.04, "hair", mats)
    out.append((mane, "hair"))
    tail = _curve_mesh("tail", [(0, 0.66, 0.86), (0.0, 0.82, 0.6), (0.0, 0.86, 0.34)], 0.05, "hair", mats)
    out.append((tail, "hair"))
    for sx in (-1, 1):
        ear = _prim_cone(f"hear{sx}", (sx * 0.06, -0.74, 1.32), 0.03, 0.0, 0.1, 8)
        out.append((_smooth(ear, 1), hide))
        eye = _prim_sphere(f"heye{sx}", (sx * 0.075, -0.86, 1.18), (0.018, 0.012, 0.016), 10)
        out.append((_smooth(eye, 0), "eye"))
        nostril = _prim_sphere(f"hnostril{sx}", (sx * 0.034, -1.045, 1.08), (0.012, 0.006, 0.008), 8)
        out.append((_smooth(nostril, 0), "hide_shadow"))
    # Hooves, fetlock hair, bridle, reins, stirrups, and flank muscle marks.
    for sx in (-1, 1):
        for yi, y in enumerate([-0.16, 0.5]):
            hoof = _prim_cube(f"hhoof-detail{sx}-{yi}", (sx * (0.17 if y < 0 else 0.18), y, 0.0), (0.055, 0.07, 0.028))
            out.append((_bevel_join_safe(hoof), "iron_dark"))
            fetlock = _prim_sphere(f"fetlock{sx}-{yi}", (sx * (0.17 if y < 0 else 0.18), y, 0.105), (0.04, 0.035, 0.034), 10)
            out.append((_smooth(fetlock, 0), "hair"))
        cheek_ring = _prim_torus(f"horse cheek ring{sx}", (sx * 0.095, -0.88, 1.15), 0.025, 0.004, 24)
        cheek_ring.rotation_euler = (math.radians(90), 0, 0)
        out.append((_smooth(cheek_ring, 0), "brass"))
    out.append((_curve_mesh("bridle noseband", [(-0.09, -0.94, 1.1), (0, -0.985, 1.08), (0.09, -0.94, 1.1)], 0.009, "leather_dark", mats), "leather_dark"))
    out.append((_curve_mesh("left rein", [(-0.07, -0.9, 1.1), (-0.24, -0.48, 1.08), (-0.18, -0.02, 1.04)], 0.006, "leather_dark", mats), "leather_dark"))
    out.append((_curve_mesh("right rein", [(0.07, -0.9, 1.1), (0.24, -0.48, 1.08), (0.18, -0.02, 1.04)], 0.006, "leather_dark", mats), "leather_dark"))
    out.append((_curve_mesh("horse shoulder muscle left", [(-0.16, -0.22, 0.83), (-0.2, 0.02, 0.78), (-0.18, 0.2, 0.78)], 0.005, "hide_shadow", mats), "hide_shadow"))
    out.append((_curve_mesh("horse shoulder muscle right", [(0.16, -0.22, 0.83), (0.2, 0.02, 0.78), (0.18, 0.2, 0.78)], 0.005, "hide_shadow", mats), "hide_shadow"))
    # saddle blanket
    blanket = _prim_cube("blanket", (0, 0.05, 1.02), (0.34, 0.42, 0.05))
    out.append((_smooth(blanket, 1), palette_for(side)["sash"]))
    for sx in (-1, 1):
        stirrup = _prim_torus(f"stirrup{sx}", (sx * 0.27, -0.02, 0.7), 0.045, 0.006, 24)
        stirrup.rotation_euler = (math.radians(90), 0, 0)
        out.append((_smooth(stirrup, 0), "steel"))
        strap = _curve_mesh(f"stirrup strap{sx}", [(sx * 0.24, 0.0, 1.04), (sx * 0.27, -0.02, 0.72)], 0.006, "leather_dark", mats)
        out.append((strap, "leather_dark"))
    # scale/translate all
    for o, _ in out:
        o.location = (o.location[0] * scale + loc[0], o.location[1] * scale + loc[1], o.location[2] * scale + loc[2])
        o.scale = (o.scale[0] * scale, o.scale[1] * scale, o.scale[2] * scale)
    return out


def build_elephant(side: str, mats: dict, scale: float = 1.0, loc=(0, 0, 0)) -> list:
    sb = SkinBuilder()
    sb.joint("rump", (0, 0.6, 1.0), 0.42)
    sb.joint("back", (0, 0.1, 1.08), 0.46)
    sb.joint("shoulders", (0, -0.4, 1.04), 0.42)
    sb.joint("browhead", (0, -0.72, 1.05), 0.34)
    sb.joint("trunktop", (0, -0.88, 0.92), 0.16)
    sb.joint("trunkmid", (0, -1.0, 0.6), 0.12)
    sb.joint("trunktip", (0, -0.96, 0.28), 0.08)
    sb.set_root("back")
    for a, b in [("rump", "back"), ("back", "shoulders"), ("shoulders", "browhead"),
                 ("browhead", "trunktop"), ("trunktop", "trunkmid"), ("trunkmid", "trunktip")]:
        sb.bone(a, b)
    for sx in (-1, 1):
        t = "L" if sx < 0 else "R"
        sb.joint(f"efsh_{t}", (sx * 0.28, -0.32, 0.9), 0.16)
        sb.joint(f"efft_{t}", (sx * 0.28, -0.3, 0.06), 0.14)
        sb.bone("shoulders", f"efsh_{t}")
        sb.bone(f"efsh_{t}", f"efft_{t}")
        sb.joint(f"ehip_{t}", (sx * 0.3, 0.5, 0.92), 0.18)
        sb.joint(f"ehft_{t}", (sx * 0.3, 0.5, 0.06), 0.15)
        sb.bone("rump", f"ehip_{t}")
        sb.bone(f"ehip_{t}", f"ehft_{t}")
    eleph = sb.build(f"{side}-elephant", subsurf=2)
    eleph.data.materials.append(mats["hide_elephant"])
    out = [(eleph, "hide_elephant")]
    for sx in (-1, 1):
        ear = _prim_sphere(f"eear{sx}", (sx * 0.42, -0.5, 1.08), (0.2, 0.06, 0.28), 18)
        out.append((_smooth(ear, 1), "hide_elephant"))
        ear_fold = _curve_mesh(f"eear fold{sx}", [(sx * 0.39, -0.56, 1.22), (sx * 0.5, -0.55, 1.08), (sx * 0.39, -0.56, 0.94)], 0.008, "hide_shadow", mats)
        out.append((ear_fold, "hide_shadow"))
        tusk = _curve_mesh(f"tusk{sx}", [(sx * 0.14, -0.86, 0.92), (sx * 0.2, -1.05, 0.8), (sx * 0.18, -1.18, 0.66)], 0.03, "ivory", mats)
        out.append((tusk, "ivory"))
        eye = _prim_sphere(f"eeye{sx}", (sx * 0.16, -0.88, 1.14), (0.022, 0.016, 0.02), 10)
        out.append((_smooth(eye, 0), "eye"))
        brow = _prim_sphere(f"elephant brow ridge{sx}", (sx * 0.15, -0.86, 1.18), (0.052, 0.018, 0.018), 10)
        out.append((_smooth(brow, 0), "hide_shadow"))
    # Trunk rings, toenails, anklets, painted forehead, and howdah hardware.
    for i, (y, z, radius) in enumerate([(-0.89, 0.85, 0.12), (-0.94, 0.72, 0.105), (-0.99, 0.58, 0.085), (-0.98, 0.43, 0.065), (-0.95, 0.3, 0.045)]):
        ring = _prim_torus(f"trunk wrinkle ring{i}", (0, y, z), radius, 0.006, 36)
        ring.rotation_euler = (math.radians(90), 0, 0)
        out.append((_smooth(ring, 0), "hide_shadow"))
    out.append((_smooth(_prim_cube("elephant forehead paint", (0, -0.9, 1.23), (0.045, 0.008, 0.07)), 0), "war_paint_white"))
    for sx in (-1, 1):
        for yi, y in enumerate([-0.3, 0.5]):
            x = sx * (0.28 if y < 0 else 0.3)
            for ti, dx in enumerate([-0.045, 0, 0.045]):
                nail = _prim_cone(f"elephant toenail{sx}-{yi}-{ti}", (x + dx, y - 0.055, 0.045), 0.032, 0.0, 0.045, 10)
                nail.rotation_euler = (math.radians(90), 0, 0)
                out.append((_smooth(nail, 0), "ivory"))
            anklet = _prim_torus(f"elephant anklet{sx}-{yi}", (x, y, 0.18), 0.12, 0.008, 28)
            anklet.rotation_euler = (math.radians(90), 0, 0)
            out.append((_smooth(anklet, 0), "brass"))
    # caparison + howdah platform
    capar = _prim_cube("caparison", (0, 0.05, 1.42), (0.62, 0.78, 0.05))
    out.append((_smooth(capar, 1), palette_for(side)["sash"]))
    howdah = _prim_cube("howdah", (0, 0.12, 1.6), (0.36, 0.4, 0.12))
    out.append((_bevel_join_safe(howdah), "wood"))
    for sx in (-1, 1):
        rail = _curve_mesh(f"howdah brass rail{sx}", [(sx * 0.2, -0.08, 1.72), (sx * 0.2, 0.12, 1.78), (sx * 0.2, 0.32, 1.72)], 0.01, "brass", mats)
        out.append((rail, "brass"))
    for o, _ in out:
        o.location = (o.location[0] * scale + loc[0], o.location[1] * scale + loc[1], o.location[2] * scale + loc[2])
        o.scale = (o.scale[0] * scale, o.scale[1] * scale, o.scale[2] * scale)
    return out


def build_chariot(side: str, mats: dict) -> list:
    p = palette_for(side)
    out = []
    cab = _prim_cube("cab", (0, 0.25, 0.7), (0.5, 0.42, 0.4))
    out.append((_bevel_join_safe(cab), "wood"))
    front = _prim_cube("chfront", (0, 0.02, 0.78), (0.5, 0.04, 0.4))
    out.append((_smooth(front, 0), p["sash"]))
    for sx in (-1, 1):
        wheel = _prim_cone(f"wheel{sx}", (sx * 0.54, 0.28, 0.34), 0.34, 0.34, 0.06, 24)
        wheel.rotation_euler = (0, math.radians(90), 0)
        out.append((_smooth(wheel, 1), "wood"))
        rim = _prim_torus(f"iron wheel rim{sx}", (sx * 0.54, 0.28, 0.34), 0.34, 0.012, 48)
        rim.rotation_euler = (0, math.radians(90), 0)
        out.append((_smooth(rim, 0), "iron_dark"))
        inner_rim = _prim_torus(f"brass inner wheel rim{sx}", (sx * 0.54, 0.28, 0.34), 0.14, 0.007, 36)
        inner_rim.rotation_euler = (0, math.radians(90), 0)
        out.append((_smooth(inner_rim, 0), "brass"))
        hub = _prim_sphere(f"hub{sx}", (sx * 0.54, 0.28, 0.34), (0.06, 0.06, 0.06), 12)
        out.append((_smooth(hub, 0), "brass"))
        for ang in range(0, 360, 45):
            a = math.radians(ang)
            spoke = _prim_cube(f"spoke{sx}{ang}", (sx * 0.54, 0.28 + math.cos(a) * 0.16, 0.34 + math.sin(a) * 0.16), (0.012, 0.012, 0.3))
            spoke.rotation_euler = (a, math.radians(90), 0)
            out.append((_smooth(spoke, 0), "wood"))
    pole = _prim_cube("pole", (0, -0.55, 0.5), (0.03, 0.7, 0.03))
    out.append((_smooth(pole, 0), "wood"))
    rail = _prim_cube("rail", (0, 0.25, 0.92), (0.5, 0.42, 0.03))
    out.append((_bevel_join_safe(rail), "brass"))
    for sx in (-1, 1):
        side_trim = _curve_mesh(f"chariot engraved side rail{sx}", [(sx * 0.28, 0.02, 0.82), (sx * 0.31, 0.25, 0.92), (sx * 0.28, 0.48, 0.82)], 0.008, "brass", mats)
        out.append((side_trim, "brass"))
        rein = _curve_mesh(f"chariot rein{sx}", [(sx * 0.08, 0.06, 0.86), (sx * 0.18, -0.46, 0.76), (sx * 0.28, -0.98, 0.72)], 0.006, "leather_dark", mats)
        out.append((rein, "leather_dark"))
    for i, x in enumerate([-0.19, 0, 0.19]):
        javelin = _prim_cube(f"chariot spare javelin{i}", (x, 0.48, 1.05), (0.008, 0.008, 0.44))
        javelin.rotation_euler = (math.radians(8), 0, 0)
        out.append((_smooth(javelin, 0), "wood"))
        head = _prim_cone(f"chariot spare javelin head{i}", (x, 0.5, 1.29), 0.022, 0.0, 0.07, 10)
        out.append((_smooth(head, 0), "steel"))
    return out


def animate_root_clips(root, role: str = "", king=False):
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end, sc.render.fps = 1, 72, 24
    r = math.radians
    root.rotation_mode = "XYZ"

    def clip(name, frames):
        act = bpy.data.actions.new(name)
        root.animation_data_create()
        root.animation_data.action = act
        for f, loc, rot in frames:
            root.location = loc
            root.rotation_euler = rot
            root.keyframe_insert("location", frame=f)
            root.keyframe_insert("rotation_euler", frame=f)
        trk = root.animation_data.nla_tracks.new()
        trk.name = name
        trk.strips.new(name, int(act.frame_range[0]), act)
        root.animation_data.action = None
        root.location = (0, 0, 0)
        root.rotation_euler = (0, 0, 0)

    clip("idle", [(1, (0, 0, 0), (0, 0, 0)), (24, (0, 0, 0.012), (r(0.6), 0, r(0.5))), (48, (0, 0, 0), (r(-0.5), 0, r(-0.5))), (72, (0, 0, 0), (0, 0, 0))])
    if role == "horse-archer":
        clip("move", [(1, (0, 0, 0), (0, 0, 0)), (6, (0, -0.05, 0.055), (r(-5.5), 0, r(1.6))), (12, (0, -0.1, 0.0), (r(1.5), 0, r(-1.2))), (18, (0, -0.05, 0.055), (r(4.5), 0, r(-1.6))), (24, (0, 0, 0), (0, 0, 0))])
        clip("attack", [(1, (0, 0, 0), (0, 0, 0)), (8, (0, -0.12, 0.04), (r(-9), 0, r(2))), (14, (0, 0.02, 0.02), (r(7), 0, r(-2))), (28, (0, 0, 0), (0, 0, 0))])
    elif role == "war-chariot":
        clip("move", [(1, (0, 0, 0), (0, 0, 0)), (6, (0, -0.055, 0.022), (r(-1.3), 0, r(2.2))), (12, (0, -0.11, 0), (0, 0, r(-1.8))), (18, (0, -0.055, 0.022), (r(1.2), 0, r(2.0))), (24, (0, 0, 0), (0, 0, 0))])
        clip("attack", [(1, (0, 0, 0), (0, 0, 0)), (9, (0, -0.2, 0.028), (r(-4), 0, r(3.5))), (15, (0, 0.045, 0), (r(2.6), 0, r(-2.5))), (30, (0, 0, 0), (0, 0, 0))])
    elif role == "war-elephant-commander":
        clip("move", [(1, (0, 0, 0), (0, 0, 0)), (10, (0, -0.035, 0.018), (r(-1.0), 0, r(0.8))), (20, (0, -0.07, 0), (r(0.8), 0, r(-0.8))), (30, (0, -0.035, 0.018), (r(-0.7), 0, r(0.8))), (40, (0, 0, 0), (0, 0, 0))])
        clip("attack", [(1, (0, 0, 0), (0, 0, 0)), (12, (0, -0.08, 0.045), (r(-5.5), 0, 0)), (18, (0, -0.04, -0.006), (r(7.5), 0, 0)), (32, (0, 0, 0), (0, 0, 0))])
    else:
        clip("move", [(1, (0, 0, 0), (0, 0, 0)), (7, (0, -0.03, 0.02), (r(-2.4), 0, 0)), (13, (0, -0.06, 0), (0, 0, 0)), (19, (0, -0.03, 0.02), (r(2), 0, 0)), (25, (0, 0, 0), (0, 0, 0))])
        clip("attack", [(1, (0, 0, 0), (0, 0, 0)), (10, (0, -0.16, 0.02), (r(-7), 0, 0)), (16, (0, 0.04, 0), (r(4), 0, 0)), (26, (0, 0, 0), (0, 0, 0))])
    clip("hit", [(1, (0, 0, 0), (0, 0, 0)), (9, (0, 0.1, 0.0), (r(8), 0, r(-3))), (18, (0, 0.03, 0), (r(-3), 0, r(2))), (34, (0, 0, 0), (0, 0, 0))])
    if king:
        clip("check", [(1, (0, 0, 0), (0, 0, 0)), (12, (0, 0, 0.03), (r(-4), 0, 0)), (30, (0, 0, 0), (0, 0, 0))])
    root["animation_clips"] = "idle,move,attack,hit" + (",check" if king else "")
    root["role_motion_profile"] = role or "generic"


def build_mounted_unit(side: str, role: str) -> bpy.types.Object:
    mats = build_all_materials()
    p = palette_for(side)
    parts = []
    if role == "horse-archer":
        parts += build_horse(side, mats, dark=(side == "kaurava"), scale=1.0)
        rider, _ = build_human_mesh(side, "foot-archer", "archer", seated=True)
        rider.scale = (0.62, 0.62, 0.62)
        rider.location = (0, 0.1, 0.62)
        parts.append((rider, p["skin"]))
    elif role == "war-chariot":
        parts += build_chariot(side, mats)
        parts += build_horse(side, mats, dark=False, scale=0.6, loc=(-0.22, -1.05, 0))
        parts += build_horse(side, mats, dark=True, scale=0.6, loc=(0.22, -1.05, 0))
        driver, _ = build_human_mesh(side, "advisor-standard-bearer", "archer")
        driver.scale = (0.6, 0.6, 0.6)
        driver.location = (0, 0.28, 0.9)
        parts.append((driver, p["skin"]))
    else:  # war-elephant-commander
        parts += build_elephant(side, mats, scale=1.0)
        rider, _ = build_human_mesh(side, "royal-commander", "commander")
        rider.scale = (0.5, 0.5, 0.5)
        rider.location = (0, 0.12, 1.66)
        parts.append((rider, p["skin"]))

    mesh = assemble_meshes(parts, mats)
    mesh.name = f"{side}-{role}-mesh"
    uv_unwrap(mesh)
    root = bpy.data.objects.new(f"{side}-{role}-runtime-root", None)
    bpy.context.collection.objects.link(root)
    mesh.parent = root
    animate_root_clips(root, role=role, king=False)
    root["required_animations"] = "idle,move,attack,hit"
    root["forward_axis"] = "+Z local before app yaw correction"
    root["origin_policy"] = "ground centered"
    return root


HUMANOID_ROLES = {"foot-archer", "advisor-standard-bearer", "royal-commander"}


def build_any_unit(side: str, role: str) -> bpy.types.Object:
    reset_scene()
    if role in HUMANOID_ROLES:
        return build_human_unit(side, role)
    return build_mounted_unit(side, role)


# ---------------------------------------------------------------------------
# Preview render
# ---------------------------------------------------------------------------

def setup_preview_scene() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 900
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.04, 0.04, 0.05, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    scene.world = world
    bpy.ops.object.light_add(type="AREA", location=(2.4, -2.6, 3.2))
    key = bpy.context.object
    key.data.energy = 900
    key.data.size = 3
    bpy.ops.object.light_add(type="AREA", location=(-2.6, -1.6, 1.4))
    fill = bpy.context.object
    fill.data.energy = 200
    fill.data.size = 3
    bpy.ops.object.camera_add(location=(0, -3.4, 1.1), rotation=(math.radians(86), 0, 0))
    cam = bpy.context.object
    cam.data.lens = 70
    scene.camera = cam


def render_preview(path: str) -> None:
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"PREVIEW_WRITTEN {path}")


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    # Purge ALL actions each unit so the glTF exporter does not pick up prior
    # units' clips (Blender renames duplicates idle.001/.002 -> leaked anims).
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act)
    # Purge orphan meshes/armatures only; keep cached materials + their images
    # alive so the synthesized texture set is reused across all 12 units.
    for block in (bpy.data.meshes, bpy.data.armatures):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def uv_unwrap(obj) -> None:
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def export_unit(arm, side, role):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    arm["required_animations"] = "idle,move,attack,hit,check"
    arm["forward_axis"] = "+Y in Blender, converted by glTF import"
    arm["origin_policy"] = "ground centered"
    filepath = OUT_DIR / f"{side}-{role}.glb"
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format="GLB",
        export_copyright="MIRROR project-authored procedural Blender asset, AGPL-3.0-or-later",
        export_apply=False,
        export_animations=True,
        export_nla_strips=True,
        export_skins=True,
        export_yup=True,
        use_selection=True,
        export_image_format="WEBP",
        export_image_quality=72,
    )
    size_kb = filepath.stat().st_size // 1024
    print(f"WROTE {filepath} ({size_kb}KB)")


ROLES = ["foot-archer", "horse-archer", "advisor-standard-bearer",
         "war-chariot", "war-elephant-commander", "royal-commander"]


def main() -> None:
    if os.environ.get("KURU_ALL"):
        for side in ("pandava", "kaurava"):
            for role in ROLES:
                root = build_any_unit(side, role)
                export_unit(root, side, role)
        return

    role = ONLY.split(":")[1] if ":" in ONLY else "foot-archer"
    side = ONLY.split(":")[0] if ":" in ONLY else "pandava"
    root = build_any_unit(side, role)
    if PREVIEW:
        setup_preview_scene()
        render_preview(PREVIEW)
    if os.environ.get("KURU_EXPORT"):
        export_unit(root, side, role)


if __name__ == "__main__":
    main()
