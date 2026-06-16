"""
Generate higher-fidelity humanoid Kurukshetra GLBs from CharMorph/MB-Lab data.

This replaces the six standalone human slots (foot archer, advisor standard
bearer, royal commander; Pandava and Kaurava) with real human base meshes and
159-bone CharMorph rigs. It deliberately leaves mounted/vehicle units to the
existing procedural generator until legally usable horse/elephant/chariot assets
are available.

License note: CharMorph's MB-Lab male character data is AGPL3. This repository
is AGPL-compatible, and the output GLBs are documented as AGPL-derived assets in
the asset manifest. The local CharMorph checkout lives under Product/tools and
is ignored by git; clone it with:

  git clone --recursive https://github.com/Upliner/CharMorph Product/tools/CharMorph
"""

from __future__ import annotations

import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "assets" / "3d" / "kurukshetra-production-v1"
CHARMORPH_DIR = Path(os.environ.get("CHARMORPH_DIR", ROOT / "tools" / "CharMorph"))
ONLY = os.environ.get("KURU_ONLY", "")

SIDES = ("pandava", "kaurava")
ROLES = ("foot-archer", "advisor-standard-bearer", "royal-commander")


MATS: dict[str, bpy.types.Material] = {}


def require_charmorph():
    if not (CHARMORPH_DIR / "__init__.py").exists():
        raise SystemExit(
            f"CharMorph is missing at {CHARMORPH_DIR}. "
            "Run: git clone --recursive https://github.com/Upliner/CharMorph Product/tools/CharMorph"
        )
    sys.path.insert(0, str(CHARMORPH_DIR.parent))
    import CharMorph  # type: ignore
    from CharMorph.lib.charlib import library  # type: ignore

    CharMorph.register()
    library.load()
    if "mb_male" not in library.chars:
        raise SystemExit("CharMorph mb_male character is unavailable")
    return library


def reset_scene() -> None:
    MATS.clear()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.actions, bpy.data.meshes, bpy.data.armatures, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)
    bpy.context.scene.render.fps = 24


def mat(name: str, color, roughness: float = 0.75, metallic: float = 0.0) -> bpy.types.Material:
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    MATS[name] = m
    return m


def ensure_mats() -> None:
    mat("real warm skin", (0.62, 0.39, 0.25, 1), 0.66)
    mat("skin shadow", (0.38, 0.22, 0.14, 1), 0.74)
    mat("natural nails", (0.74, 0.57, 0.43, 1), 0.6)
    mat("cloth saffron", (0.82, 0.38, 0.12, 1), 0.86)
    mat("cloth indigo", (0.025, 0.14, 0.42, 1), 0.84)
    mat("cloth wine", (0.34, 0.05, 0.045, 1), 0.86)
    mat("warm leather", (0.45, 0.25, 0.12, 1), 0.72)
    mat("dark leather", (0.18, 0.10, 0.055, 1), 0.78)
    mat("bronze", (0.70, 0.45, 0.20, 1), 0.42, 0.55)
    mat("brass", (0.95, 0.68, 0.28, 1), 0.35, 0.65)
    mat("steel", (0.72, 0.70, 0.66, 1), 0.3, 0.78)
    mat("wood", (0.38, 0.22, 0.10, 1), 0.8)
    mat("hair black", (0.025, 0.018, 0.014, 1), 0.9)
    mat("paint white", (0.85, 0.78, 0.62, 1), 0.82)
    mat("paint blue", (0.02, 0.25, 0.70, 1), 0.82)
    mat("paint red", (0.55, 0.035, 0.03, 1), 0.82)
    mat("eye white", (0.82, 0.75, 0.62, 1), 0.5)
    mat("eye dark iris", (0.035, 0.022, 0.014, 1), 0.32)
    mat("mouth shadow", (0.18, 0.055, 0.04, 1), 0.68)


def assign(obj: bpy.types.Object, material_name: str) -> bpy.types.Object:
    material = MATS[material_name]
    if obj.type == "MESH":
        if obj.data.materials:
            obj.data.materials[0] = material
        else:
            obj.data.materials.append(material)
    return obj


def shade(obj: bpy.types.Object, bevel: float = 0.0) -> bpy.types.Object:
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth()
    except RuntimeError:
        pass
    if bevel > 0:
        mod = obj.modifiers.new("soft bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
    return obj


def cube(name: str, loc, scale, material: str, bevel: float = 0.0) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign(obj, material)
    return shade(obj, bevel)


def sphere(name: str, loc, scale, material: str, segs: int = 20) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=max(8, segs // 2), location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign(obj, material)
    return shade(obj)


def cone(name: str, loc, r1: float, r2: float, depth: float, material: str, verts: int = 24) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    assign(obj, material)
    return shade(obj)


def cyl_between(name: str, start, end, radius: float, material: str, verts: int = 12) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    mid = (start_v + end_v) * 0.5
    direction = end_v - start_v
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=direction.length, location=mid)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    assign(obj, material)
    return shade(obj)


def torus(name: str, loc, major: float, minor: float, material: str, segs: int = 36) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=segs,
        minor_segments=8,
        location=loc,
    )
    obj = bpy.context.object
    obj.name = name
    assign(obj, material)
    return shade(obj)


def curve(name: str, pts, bevel: float, material: str) -> bpy.types.Object:
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 14
    cu.bevel_depth = bevel
    cu.bevel_resolution = 3
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (co[0], co[1], co[2], 1)
    obj = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(obj)
    assign(obj, material)
    return obj


def parent_to_bone(
    obj: bpy.types.Object,
    arm: bpy.types.Object,
    bone_name: str,
    *,
    loc=(0, 0, 0),
    rot=(0, 0, 0),
    scale=(1, 1, 1),
) -> bpy.types.Object:
    """Attach decorative/weapon geometry to a rig bone in local bone space."""
    obj.parent = arm
    if bone_name in arm.pose.bones:
        obj.parent_type = "BONE"
        obj.parent_bone = bone_name
    obj.location = loc
    obj.rotation_euler = rot
    obj.scale = scale
    return obj


def parent_to_bone_keep_world(
    obj: bpy.types.Object,
    arm: bpy.types.Object,
    bone_name: str,
) -> bpy.types.Object:
    """Bone-parent an already placed object without moving it at bind time."""
    matrix_world = obj.matrix_world.copy()
    obj.parent = arm
    if bone_name in arm.pose.bones:
        obj.parent_type = "BONE"
        obj.parent_bone = bone_name
    obj.matrix_world = matrix_world
    obj["bone_locked_to"] = bone_name
    return obj


def make_bone_cylinder(
    name: str,
    arm: bpy.types.Object,
    bone_name: str,
    *,
    length: float,
    radius: float,
    material: str,
    loc=(0, 0, 0),
    rot=(0, 0, 0),
    verts: int = 12,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=length)
    obj = bpy.context.object
    obj.name = name
    assign(obj, material)
    shade(obj)
    return parent_to_bone(obj, arm, bone_name, loc=loc, rot=rot)


def make_bone_cube(
    name: str,
    arm: bpy.types.Object,
    bone_name: str,
    *,
    material: str,
    loc=(0, 0, 0),
    rot=(0, 0, 0),
    scale=(1, 1, 1),
    bevel: float = 0.0,
) -> bpy.types.Object:
    obj = cube(name, (0, 0, 0), scale, material, bevel)
    return parent_to_bone(obj, arm, bone_name, loc=loc, rot=rot)


def make_bone_sphere(
    name: str,
    arm: bpy.types.Object,
    bone_name: str,
    *,
    material: str,
    loc=(0, 0, 0),
    scale=(1, 1, 1),
    segs: int = 16,
) -> bpy.types.Object:
    obj = sphere(name, (0, 0, 0), scale, material, segs)
    return parent_to_bone(obj, arm, bone_name, loc=loc)


def make_bone_torus(
    name: str,
    arm: bpy.types.Object,
    bone_name: str,
    *,
    material: str,
    major: float,
    minor: float,
    loc=(0, 0, 0),
    rot=(0, 0, 0),
) -> bpy.types.Object:
    obj = torus(name, (0, 0, 0), major, minor, material, 32)
    return parent_to_bone(obj, arm, bone_name, loc=loc, rot=rot)


def bounds(objects):
    minv = Vector((1e9, 1e9, 1e9))
    maxv = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            w = obj.matrix_world @ Vector(corner)
            minv = Vector((min(minv.x, w.x), min(minv.y, w.y), min(minv.z, w.z)))
            maxv = Vector((max(maxv.x, w.x), max(maxv.y, w.y), max(maxv.z, w.z)))
    return minv, maxv


def normalize_unit(root: bpy.types.Object, meshes: list[bpy.types.Object], target_h: float = 1.68) -> None:
    minv, maxv = bounds(meshes)
    height = max(0.001, maxv.z - minv.z)
    scale = target_h / height
    root.scale = (scale, scale, scale)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    minv, maxv = bounds(meshes)
    cx = (minv.x + maxv.x) * 0.5
    cy = (minv.y + maxv.y) * 0.5
    root.location.x -= cx
    root.location.y -= cy
    root.location.z -= minv.z
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)


def import_charmorph_body(side: str, role: str):
    ui = bpy.context.window_manager.charmorph_ui
    ui.base_model = "mb_male"
    ui.import_morphs = False
    ui.import_expressions = False
    ui.use_sk = False
    ui.material_mode = "MS"
    ui.material_local = True
    bpy.ops.charmorph.import_char()
    body = bpy.context.object
    body.name = f"{side}-{role}-real-human-body"
    fitted_assets = fit_charmorph_assets(body, side)
    try:
        ui.rig = "gaming"
    except TypeError:
        pass
    bpy.ops.charmorph.rig()
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    arm = armatures[-1]
    arm.name = f"{side}-{role}-runtime-root"
    body = next(obj for obj in bpy.context.scene.objects if obj.name.startswith(f"{side}-{role}-real-human-body"))
    normalize_unit(arm, [body, *fitted_assets], 1.68 if role != "royal-commander" else 1.75)
    replace_body_materials(body)
    arm.rotation_mode = "XYZ"
    arm["source"] = "CharMorph mb_male AGPL3 real human mesh"
    return arm, body, fitted_assets


def fit_charmorph_assets(body: bpy.types.Object, side: str) -> list[bpy.types.Object]:
    ui = bpy.context.window_manager.charmorph_ui
    ui.fitting_char = body
    ui.fitting_binder = "HARD"
    ui.fitting_mask = "COMB"
    ui.fitting_weights = "ORIG"
    ui.fitting_transforms = True
    before = set(bpy.context.scene.objects)
    fitted: list[bpy.types.Object] = []
    for asset in ("tactical_btm", "mesh_hair01"):
        ui.fitting_library_asset = "char_" + asset
        try:
            bpy.ops.charmorph.fit_library()
        except RuntimeError:
            continue
        for obj in bpy.context.scene.objects:
            if obj not in before and obj.type == "MESH":
                fitted.append(obj)
                before.add(obj)
    restyle_fitted_assets(fitted, side)
    return fitted


def restyle_fitted_assets(assets: list[bpy.types.Object], side: str) -> None:
    cloth = "cloth indigo" if side == "pandava" else "cloth wine"
    for obj in assets:
        low = obj.name.lower()
        if "hair" in low:
            material_name = "hair black"
        else:
            material_name = "cloth saffron"
        if obj.type == "MESH":
            obj.data.materials.clear()
            obj.data.materials.append(MATS[material_name if "btm" in low or "bottom" in low else material_name])
            if "btm" in low or "bottom" in low:
                obj["kurukshetra_restyle"] = f"fitted lower cloth with {cloth} sash overlay"


def replace_body_materials(body: bpy.types.Object) -> None:
    """CharMorph skin node graphs do not import reliably in Three.js/Blender GLB.

    Keep the real body topology and rig, but replace unsupported skin/mask slots
    with stable warm-skin materials so exported warriors do not render black.
    """
    for slot in body.material_slots:
        if not slot.material:
            continue
        name = slot.material.name.lower()
        if "skin" in name or "censor" in name:
            slot.material = MATS["real warm skin"]
        elif "nail" in name:
            slot.material = MATS["natural nails"]
        elif "eyelash" in name or "pupil" in name:
            slot.material = MATS["hair black"]


def add_body_overlays(side: str, role: str, arm: bpy.types.Object) -> list[bpy.types.Object]:
    cloth = "cloth indigo" if side == "pandava" else "cloth wine"
    paint = "paint blue" if side == "pandava" else "paint red"
    out: list[bpy.types.Object] = []

    # Mahabharata-inspired clothing and armor fitted close to the real body.
    out.append(cube("front dhoti drape over fitted cloth", (0, -0.135, 0.58), (0.11, 0.014, 0.24), "cloth saffron", 0.012))
    for sx in (-1, 1):
        out.append(cube(f"side waist cloth fold {sx}", (sx * 0.16, -0.025, 0.7), (0.026, 0.022, 0.18), "cloth saffron", 0.008))
    out.append(cube("waist sash", (0, -0.132, 0.94), (0.28, 0.02, 0.045), cloth, 0.006))
    out.append(cube("fitted leather cuirass", (0, -0.105, 1.22), (0.19, 0.022, 0.205), "warm leather", 0.018))
    out.append(cube("small rear leather plate", (0, 0.085, 1.22), (0.15, 0.018, 0.165), "warm leather", 0.014))
    for sx in (-1, 1):
        out.append(cyl_between(f"cross chest strap {sx} upper", (sx * -0.145, -0.13, 1.405), (0, -0.142, 1.25), 0.009, "dark leather", 8))
        out.append(cyl_between(f"cross chest strap {sx} lower", (0, -0.142, 1.25), (sx * 0.145, -0.125, 1.075), 0.009, "dark leather", 8))
        out.append(sphere(f"small shoulder bronze cap {sx}", (sx * 0.18, -0.025, 1.36), (0.042, 0.03, 0.025), "bronze", 16))
        out.append(torus(f"wrist guard {sx}", (sx * 0.35, -0.09, 0.86), 0.03, 0.006, "bronze", 24))
    out.append(torus("thin cloth headband", (0, -0.015, 1.58), 0.105, 0.009, cloth, 42))
    out.append(sphere("top hair knot", (0, 0.04, 1.74), (0.045, 0.045, 0.052), "hair black", 18))
    out.append(cube("forehead tilak", (0, -0.105, 1.62), (0.012, 0.005, 0.05), "paint white", 0.001))
    out.append(cube("left cheek paint", (-0.055, -0.105, 1.54), (0.035, 0.004, 0.008), paint, 0.001))
    out.append(cube("right cheek paint", (0.055, -0.105, 1.54), (0.035, 0.004, 0.008), paint, 0.001))

    if role == "royal-commander":
        out.append(cone("royal crown", (0, -0.005, 1.78), 0.09, 0.045, 0.15, "brass", 32))
    lock_body_overlays_to_rig(out, arm)
    out += add_face_and_armor_microdetails(side, role, arm)
    return out


def lock_body_overlays_to_rig(out: list[bpy.types.Object], arm: bpy.types.Object) -> None:
    for obj in out:
        name = obj.name.lower()
        if any(k in name for k in ("headband", "hair", "tilak", "cheek", "crown")):
            parent_to_bone_keep_world(obj, arm, "head")
        elif "wrist" in name:
            parent_to_bone_keep_world(obj, arm, "hand.L" if "-1" in name else "hand.R")
        elif "shoulder" in name:
            parent_to_bone_keep_world(obj, arm, "upper_arm.L" if "-1" in name else "upper_arm.R")
        elif any(k in name for k in ("dhoti", "waist", "cloth fold")):
            parent_to_bone_keep_world(obj, arm, "pelvis")
        else:
            parent_to_bone_keep_world(obj, arm, "spine.004")


def add_face_and_armor_microdetails(side: str, role: str, arm: bpy.types.Object) -> list[bpy.types.Object]:
    paint = "paint blue" if side == "pandava" else "paint red"
    out: list[bpy.types.Object] = []
    # Facial anchors are placed in model space, then bone-parented to the head.
    for sx in (-1, 1):
        eye = sphere(f"actual eye white {sx}", (sx * 0.036, -0.105, 1.585), (0.015, 0.006, 0.010), "eye white", 14)
        iris = sphere(f"actual dark iris {sx}", (sx * 0.036, -0.111, 1.585), (0.007, 0.003, 0.006), "eye dark iris", 10)
        brow = cube(f"angled eyebrow {sx}", (sx * 0.038, -0.108, 1.606), (0.030, 0.004, 0.004), "hair black", 0.001)
        brow.rotation_euler = (0, 0, math.radians(-8 * sx))
        cheek = cube(f"thin cheek war paint {sx}", (sx * 0.058, -0.111, 1.545), (0.035, 0.003, 0.005), paint, 0.001)
        for obj in (eye, iris, brow, cheek):
            out.append(parent_to_bone_keep_world(obj, arm, "head"))
    nose_bridge = cube("defined nose bridge", (0, -0.113, 1.565), (0.010, 0.006, 0.030), "skin shadow", 0.002)
    mouth = cube("mouth shadow line", (0, -0.113, 1.505), (0.042, 0.003, 0.004), "mouth shadow", 0.001)
    moustache = cube("dark moustache", (0, -0.116, 1.522), (0.058, 0.004, 0.006), "hair black", 0.001)
    beard = sphere("short jaw beard", (0, -0.095, 1.485), (0.060, 0.020, 0.022), "hair black", 16)
    for obj in (nose_bridge, mouth, moustache, beard):
        out.append(parent_to_bone_keep_world(obj, arm, "head"))

    # Armor rivets and strap anchors are bone-locked to torso/limbs, not left
    # floating in board space.
    for i, x in enumerate((-0.12, -0.06, 0.0, 0.06, 0.12)):
        rivet = sphere(f"cuirass rivet row upper {i}", (x, -0.132, 1.36), (0.010, 0.006, 0.010), "brass", 10)
        out.append(parent_to_bone_keep_world(rivet, arm, "spine.004"))
    for sx in (-1, 1):
        cuff = torus(f"bone locked wrist cuff {sx}", (sx * 0.34, -0.115, 0.86), 0.035, 0.006, "brass", 28)
        cuff.rotation_euler = (math.radians(88), 0, math.radians(12 * sx))
        out.append(parent_to_bone_keep_world(cuff, arm, "hand.L" if sx < 0 else "hand.R"))
        anklet = torus(f"bone locked ankle cuff {sx}", (sx * 0.10, -0.012, 0.12), 0.035, 0.006, "brass", 28)
        anklet.rotation_euler = (math.radians(90), 0, 0)
        out.append(parent_to_bone_keep_world(anklet, arm, "foot.L" if sx < 0 else "foot.R"))
    return out


def add_role_weapon(side: str, role: str, arm: bpy.types.Object) -> list[bpy.types.Object]:
    cloth = "cloth indigo" if side == "pandava" else "cloth wine"
    out: list[bpy.types.Object] = []
    if role == "foot-archer":
        bow = curve("bone locked recurve bow", [(-0.37, -0.11, 0.55), (-0.49, -0.14, 0.88), (-0.37, -0.11, 1.22)], 0.012, "wood")
        string = curve("bone locked bow string", [(-0.37, -0.11, 0.55), (-0.31, -0.10, 0.88), (-0.37, -0.11, 1.22)], 0.003, "steel")
        grip = torus("left hand wrapped around bow grip", (-0.36, -0.12, 0.88), 0.030, 0.005, "skin shadow", 24)
        grip.rotation_euler = (math.radians(90), 0, 0)
        for obj in (bow, string, grip):
            out.append(parent_to_bone_keep_world(obj, arm, "hand.L"))
        shaft = cyl_between("right hand arrow shaft", (0.16, -0.115, 0.86), (0.52, -0.13, 1.04), 0.005, "wood", 8)
        head = cone("right hand arrow head", (0.54, -0.132, 1.055), 0.016, 0, 0.052, "steel", 10)
        head.rotation_euler = (math.radians(36), 0, math.radians(-38))
        out.append(parent_to_bone_keep_world(shaft, arm, "hand.R"))
        out.append(parent_to_bone_keep_world(head, arm, "hand.R"))
        quiver = cone("bone locked back quiver", (0.12, 0.11, 1.2), 0.045, 0.04, 0.34, "dark leather", 16)
        quiver.rotation_euler = (math.radians(16), 0, math.radians(-12))
        out.append(parent_to_bone_keep_world(quiver, arm, "spine.004"))
        for i in range(6):
            arrow = cyl_between(f"bone locked quiver arrow {i}", (0.08 + i * 0.012, 0.12, 1.35), (0.1 + i * 0.012, 0.16, 1.58), 0.004, "wood", 6)
            out.append(parent_to_bone_keep_world(arrow, arm, "spine.004"))
    elif role == "advisor-standard-bearer":
        pole = cyl_between("bone locked standard pole", (0.40, -0.16, 0.58), (0.40, -0.16, 1.82), 0.012, "wood", 12)
        head = cone("bone locked standard spear head", (0.40, -0.16, 1.92), 0.04, 0, 0.16, "steel", 14)
        banner = cube("battle standard cloth", (0.52, -0.16, 1.48), (0.14, 0.009, 0.28), cloth, 0.003)
        grip = torus("right hand closed on standard pole", (0.40, -0.16, 0.92), 0.035, 0.006, "skin shadow", 24)
        grip.rotation_euler = (math.radians(90), 0, 0)
        for obj in (pole, head, banner, grip):
            out.append(parent_to_bone_keep_world(obj, arm, "hand.R"))
    else:
        blade = cyl_between("bone locked sword blade", (0.39, -0.18, 0.88), (0.52, -0.2, 1.36), 0.018, "steel", 8)
        grip = cyl_between("bone locked sword grip", (0.35, -0.17, 0.74), (0.40, -0.18, 0.90), 0.014, "wood", 8)
        guard = cube("bone locked sword guard", (0.40, -0.18, 0.91), (0.09, 0.018, 0.018), "brass", 0.006)
        closed_hand = torus("right hand closed on sword grip", (0.38, -0.18, 0.83), 0.033, 0.006, "skin shadow", 24)
        closed_hand.rotation_euler = (math.radians(90), 0, 0)
        for obj in (blade, grip, guard, closed_hand):
            out.append(parent_to_bone_keep_world(obj, arm, "hand.R"))
        shield = cone("round shield", (-0.42, -0.2, 1.04), 0.16, 0.16, 0.035, "bronze", 36)
        shield.rotation_euler = (math.radians(90), 0, 0)
        rim = torus("shield rim", (-0.42, -0.222, 1.04), 0.16, 0.009, "brass", 42)
        rim.rotation_euler = (math.radians(90), 0, 0)
        shield_grip = torus("left hand shield handle grip", (-0.39, -0.205, 1.04), 0.030, 0.006, "skin shadow", 24)
        shield_grip.rotation_euler = (math.radians(90), 0, 0)
        for obj in (shield, rim, shield_grip):
            out.append(parent_to_bone_keep_world(obj, arm, "hand.L"))
    return out


def create_clips(arm: bpy.types.Object, role: str) -> None:
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 72
    r = math.radians
    zero = (0, 0, 0)
    base_pose = {
        "upper_arm.L": (r(0), r(-45), r(-45)),
        "upper_arm.R": (r(0), r(45), r(45)),
        "forearm.L": (r(0), r(0), r(0)),
        "forearm.R": (r(0), r(0), r(0)),
        "hand.L": (r(0), r(0), r(0)),
        "hand.R": (r(0), r(0), r(0)),
        "spine.003": (r(1.5), 0, 0),
        "spine.004": (r(-1), 0, 0),
    }
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"

    def clip(name: str, frames) -> None:
        action = bpy.data.actions.new(name)
        arm.animation_data_create()
        arm.animation_data.action = action
        for frame, rotations, loc in frames:
            keyed_rotations = dict(base_pose)
            keyed_rotations.update(rotations)
            for bone, rot in keyed_rotations.items():
                if bone in arm.pose.bones:
                    pb = arm.pose.bones[bone]
                    pb.rotation_euler = rot
                    pb.keyframe_insert(data_path="rotation_euler", frame=frame)
            if loc is not None:
                arm.location = loc
                arm.keyframe_insert(data_path="location", frame=frame)
        trk = arm.animation_data.nla_tracks.new()
        trk.name = name
        strip = trk.strips.new(name, int(action.frame_range[0]), action)
        strip.name = name
        arm.animation_data.action = None
        arm.location = (0, 0, 0)

    clip("idle", [
        (1, {}, (0, 0, 0)),
        (24, {"spine.003": (r(2.2), 0, 0), "spine.004": (r(-1.4), 0, r(0.8))}, (0, 0, 0.006)),
        (48, {"spine.003": (r(0.6), 0, 0), "spine.004": (r(0.2), 0, r(-0.8))}, (0, 0, 0)),
        (72, {}, (0, 0, 0)),
    ])
    clip("move", [
        (1, {"thigh.L": zero, "thigh.R": zero, "shin.L": zero, "shin.R": zero}, (0, 0, 0)),
        (7, {"thigh.L": (r(24), 0, 0), "thigh.R": (r(-22), 0, 0), "shin.L": (r(-20), 0, 0), "shin.R": (r(12), 0, 0)}, (0, 0, 0.024)),
        (13, {"thigh.L": zero, "thigh.R": zero, "shin.L": zero, "shin.R": zero}, (0, 0, 0)),
        (19, {"thigh.L": (r(-22), 0, 0), "thigh.R": (r(24), 0, 0), "shin.L": (r(12), 0, 0), "shin.R": (r(-20), 0, 0)}, (0, 0, 0.024)),
        (25, {"thigh.L": zero, "thigh.R": zero, "shin.L": zero, "shin.R": zero}, (0, 0, 0)),
    ])
    if role == "foot-archer":
        attack = [
            (1, {}, None),
            (9, {"upper_arm.L": (r(-14), r(0), r(58)), "forearm.L": (r(-8), 0, r(18)), "upper_arm.R": (r(-24), 0, r(-42)), "forearm.R": (r(-32), 0, 0), "spine.004": (0, 0, r(10))}, None),
            (15, {"upper_arm.L": (r(0), 0, r(76)), "forearm.L": (0, 0, r(-8)), "upper_arm.R": (r(4), 0, r(-70)), "forearm.R": (0, 0, r(10)), "spine.004": (0, 0, r(-4))}, None),
            (28, {}, None),
        ]
    else:
        attack = [
            (1, {}, None),
            (9, {"upper_arm.R": (r(-58), 0, r(-8)), "forearm.R": (r(-22), 0, 0), "spine.003": (r(-3), 0, 0), "spine.004": (0, 0, r(-12))}, None),
            (15, {"upper_arm.R": (r(42), 0, r(8)), "forearm.R": (r(20), 0, 0), "spine.003": (r(6), 0, 0), "spine.004": (0, 0, r(10))}, None),
            (28, {}, None),
        ]
    clip("attack", attack)
    clip("hit", [
        (1, {}, (0, 0, 0)),
        (9, {"spine.003": (r(12), 0, 0), "spine.004": (r(8), 0, 0)}, (0, 0.025, -0.012)),
        (20, {"spine.003": (r(-4), 0, 0), "spine.004": (r(-3), 0, 0)}, (0, 0, 0)),
        (34, {}, (0, 0, 0)),
    ])
    clip("check", [
        (1, {}, (0, 0, 0)),
        (12, {"spine.004": (r(-8), 0, 0), "upper_arm.R": (r(-92), 0, r(-8)), "forearm.R": (r(-22), 0, 0)}, (0, 0, 0.018)),
        (30, {"spine.004": (r(-6), 0, 0), "upper_arm.R": (r(-82), 0, r(-8)), "forearm.R": (r(-26), 0, 0)}, (0, 0, 0.012)),
        (48, {}, (0, 0, 0)),
    ])
    arm["animation_clips"] = "idle,move,attack,hit,check"


def export_unit(side: str, role: str) -> None:
    reset_scene()
    ensure_mats()
    arm, body, fitted_assets = import_charmorph_body(side, role)
    # Do not export loose weapon overlays in this corrective pass. The previous
    # bow/arrow/sword meshes were bone-parented but still read as floating at
    # close camera zoom. Keep body/armor/face overlays; weapon visuals return
    # only when they are authored as proper constrained rig assets.
    extras = add_body_overlays(side, role, arm)
    for obj in extras:
        if obj.parent is None:
            obj.parent = arm
    create_clips(arm, role)

    arm["required_animations"] = "idle,move,attack,hit,check"
    arm["forward_axis"] = "+Y in Blender, converted by glTF import"
    arm["origin_policy"] = "ground centered"
    arm["license"] = "AGPL3 derived from CharMorph MB-Lab mb_male"

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    filepath = OUT_DIR / f"{side}-{role}.glb"
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [arm, body, *fitted_assets, *extras]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format="GLB",
        export_copyright="AGPL3 derived from CharMorph MB-Lab mb_male plus MIRROR-authored equipment",
        export_apply=False,
        export_animations=True,
        export_nla_strips=True,
        export_skins=True,
        export_yup=True,
        export_image_format="AUTO",
        export_image_quality=72,
        use_selection=True,
    )
    print(f"WROTE {filepath} ({filepath.stat().st_size // 1024}KB)")


def main() -> None:
    require_charmorph()
    if ONLY:
        side, role = ONLY.split(":", 1)
        export_unit(side, role)
        return
    for side in SIDES:
        for role in ROLES:
            export_unit(side, role)


if __name__ == "__main__":
    main()
