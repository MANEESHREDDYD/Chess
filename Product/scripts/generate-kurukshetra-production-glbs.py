"""
Generate the first production GLB pack for Kurukshetra Battlefield mode.

This is a Blender-only asset build script. It creates local, project-authored
GLB files for the runtime slots in:

  public/assets/3d/kurukshetra-production-v1/

The output is still procedural/stylized-realistic, not scanned AAA character art.
It gives the app real GLB/PBR units with richer silhouettes while preserving a
clean path for future artist-authored rigged assets.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "assets" / "3d" / "kurukshetra-production-v1"


@dataclass(frozen=True)
class Palette:
    cloth: str
    accent: str
    dark_cloth: str
    banner: str


PALETTES = {
    "pandava": Palette(cloth="deep indigo cloth", accent="saffron cloth", dark_cloth="navy cloth", banner="pandava banner blue"),
    "kaurava": Palette(cloth="wine red cloth", accent="blackened cloth", dark_cloth="black cloth", banner="kaurava banner red"),
}


MATS: dict[str, bpy.types.Material] = {}


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 64
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.unit_settings.system = "METRIC"


def mat(name: str, color: tuple[float, float, float, float], roughness: float = 0.7, metallic: float = 0.0) -> bpy.types.Material:
    if name in MATS:
        return MATS[name]
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    MATS[name] = material
    return material


def ensure_materials() -> None:
    mat("skin warm brown", (0.58, 0.34, 0.21, 1), 0.68)
    mat("skin darker brown", (0.42, 0.23, 0.15, 1), 0.72)
    mat("black hair", (0.018, 0.014, 0.012, 1), 0.92)
    mat("deep eye black", (0.006, 0.005, 0.004, 1), 0.96)
    mat("dust pigment", (0.62, 0.49, 0.34, 1), 0.94)
    mat("white war paint", (0.84, 0.79, 0.68, 1), 0.88)
    mat("blue war paint", (0.02, 0.36, 0.8, 1), 0.82)
    mat("red war paint", (0.62, 0.05, 0.04, 1), 0.84)
    mat("leather dark", (0.18, 0.11, 0.07, 1), 0.78)
    mat("leather warm", (0.36, 0.21, 0.12, 1), 0.74)
    mat("dark iron", (0.12, 0.12, 0.12, 1), 0.46, 0.64)
    mat("old bronze", (0.63, 0.43, 0.20, 1), 0.42, 0.55)
    mat("bright brass", (0.95, 0.68, 0.28, 1), 0.35, 0.62)
    mat("steel worn", (0.72, 0.69, 0.63, 1), 0.35, 0.7)
    mat("wood bow", (0.43, 0.25, 0.10, 1), 0.82)
    mat("horse chestnut", (0.33, 0.18, 0.09, 1), 0.82)
    mat("horse black", (0.08, 0.06, 0.045, 1), 0.86)
    mat("horse tan", (0.52, 0.32, 0.18, 1), 0.82)
    mat("elephant hide", (0.28, 0.28, 0.26, 1), 0.95)
    mat("elephant darker hide", (0.19, 0.19, 0.18, 1), 0.96)
    mat("ivory tusk", (0.86, 0.78, 0.63, 1), 0.55)
    mat("deep indigo cloth", (0.02, 0.14, 0.38, 1), 0.86)
    mat("navy cloth", (0.015, 0.055, 0.12, 1), 0.9)
    mat("pandava banner blue", (0.02, 0.22, 0.56, 1), 0.82)
    mat("wine red cloth", (0.36, 0.055, 0.045, 1), 0.88)
    mat("black cloth", (0.022, 0.021, 0.02, 1), 0.92)
    mat("kaurava banner red", (0.48, 0.07, 0.055, 1), 0.86)
    mat("saffron cloth", (0.82, 0.42, 0.12, 1), 0.86)
    mat("blackened cloth", (0.08, 0.08, 0.09, 1), 0.88)


def assign(obj: bpy.types.Object, material_name: str) -> bpy.types.Object:
    obj.data.materials.append(MATS[material_name])
    return obj


def shade(obj: bpy.types.Object, bevel: float = 0.0) -> bpy.types.Object:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth()
    except RuntimeError:
        pass
    obj.select_set(False)
    if bevel > 0:
        mod = obj.modifiers.new("soft bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
    return obj


def uv_sphere(name: str, loc: tuple[float, float, float], scale: tuple[float, float, float], material: str, segments: int = 32) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(8, segments // 2), location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign(obj, material)
    return shade(obj)


def cube(name: str, loc: tuple[float, float, float], scale: tuple[float, float, float], material: str, bevel: float = 0.0) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign(obj, material)
    return shade(obj, bevel)


def cylinder(name: str, loc: tuple[float, float, float], radius: float, depth: float, material: str, vertices: int = 24, bevel: float = 0.0) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    assign(obj, material)
    return shade(obj, bevel)


def cone(name: str, loc: tuple[float, float, float], radius1: float, radius2: float, depth: float, material: str, vertices: int = 24) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    assign(obj, material)
    return shade(obj)


def torus(name: str, loc: tuple[float, float, float], major: float, minor: float, material: str) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=48, minor_segments=10, location=loc)
    obj = bpy.context.object
    obj.name = name
    assign(obj, material)
    return shade(obj)


def cylinder_between(name: str, start: tuple[float, float, float], end: tuple[float, float, float], radius: float, material: str, vertices: int = 16) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    mid = (start_v + end_v) * 0.5
    direction = end_v - start_v
    obj = cylinder(name, tuple(mid), radius, direction.length, material, vertices)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return obj


def curve(name: str, points: Iterable[tuple[float, float, float]], material: str, bevel: float = 0.012) -> bpy.types.Object:
    curve_data = bpy.data.curves.new(name, "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 14
    curve_data.bevel_depth = bevel
    curve_data.bevel_resolution = 3
    poly = curve_data.splines.new("POLY")
    pts = list(points)
    poly.points.add(len(pts) - 1)
    for point, co in zip(poly.points, pts):
        point.co = (co[0], co[1], co[2], 1)
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    assign(obj, material)
    return obj


def add_dhoti(side: str, z: float = 0.57) -> None:
    palette = PALETTES[side]
    cone("layered dhoti cloth", (0, 0, z), 0.2, 0.1, 0.42, palette.accent, 28)
    for i, angle in enumerate([-0.82, -0.55, -0.28, 0.0, 0.28, 0.55, 0.82]):
        panel = cube(f"cloth fold {i}", (math.sin(angle) * 0.13, -0.064, z - 0.035), (0.014, 0.026, 0.25), palette.accent, 0.006)
        panel.rotation_euler[2] = angle * 0.2
    side_drape = cube("side shoulder-color cloth drape", (-0.14, -0.08, z + 0.02), (0.035, 0.026, 0.28), palette.dark_cloth, 0.006)
    side_drape.rotation_euler[2] = -0.18
    sash = cube("blue waist sash" if side == "pandava" else "red waist sash", (0, -0.12, z + 0.17), (0.24, 0.025, 0.035), palette.cloth, 0.004)
    sash.rotation_euler[2] = -0.25


def add_face_and_armor_details(side: str, root: bpy.types.Object, parent) -> None:
    skin = "skin warm brown" if side == "pandava" else "skin darker brown"
    paint = "blue war paint" if side == "pandava" else "red war paint"

    # Face, hair, and textile details visible even from the board camera.
    for x in [-0.065, 0.065]:
        parent(uv_sphere("ear", (x, 0.01, 1.58), (0.018, 0.012, 0.032), skin, 12))
    parent(cylinder_between("left moustache", (-0.012, -0.119, 1.545), (-0.072, -0.132, 1.535), 0.006, "black hair", 8))
    parent(cylinder_between("right moustache", (0.012, -0.119, 1.545), (0.072, -0.132, 1.535), 0.006, "black hair", 8))
    parent(cylinder_between("short beard", (-0.045, -0.112, 1.505), (0.045, -0.112, 1.505), 0.008, "black hair", 8))
    parent(cube("forehead paint", (0, -0.117, 1.646), (0.012, 0.006, 0.045), "white war paint", 0.002))
    parent(cube("cheek war paint", (-0.072, -0.108, 1.585), (0.035, 0.005, 0.01), paint, 0.002))
    parent(cube("cheek war paint mirror", (0.072, -0.108, 1.585), (0.035, 0.005, 0.01), paint, 0.002))
    parent(curve("loose hair strand left", [(-0.08, 0.02, 1.68), (-0.12, -0.01, 1.52), (-0.1, -0.02, 1.34)], "black hair", 0.012))
    parent(curve("loose hair strand right", [(0.08, 0.02, 1.68), (0.12, -0.01, 1.52), (0.1, -0.02, 1.34)], "black hair", 0.012))

    # Cross-body leather harness, bronze studs, and limb bands.
    parent(cylinder_between("front leather harness one", (-0.16, -0.119, 1.38), (0.14, -0.119, 0.98), 0.017, "leather dark", 10))
    parent(cylinder_between("front leather harness two", (0.16, -0.121, 1.38), (-0.12, -0.121, 1.0), 0.014, "leather dark", 10))
    for row, z in enumerate([1.28, 1.18, 1.08]):
        for col, x in enumerate([-0.105, -0.035, 0.035, 0.105]):
            parent(uv_sphere(f"bronze armor stud {row}-{col}", (x, -0.102, z), (0.011, 0.006, 0.011), "bright brass", 10))
    for x in [-0.255, 0.255]:
        parent(cylinder_between("upper arm bronze band", (x - math.copysign(0.018, x), -0.036, 1.115), (x + math.copysign(0.018, x), -0.036, 1.115), 0.014, "old bronze", 10))
        parent(cylinder_between("wrist bronze band", (x * 1.5 - math.copysign(0.016, x), -0.12, 0.925), (x * 1.5 + math.copysign(0.016, x), -0.12, 0.925), 0.012, "old bronze", 10))

    root["detail_pass"] = "face, armor straps, studs, war paint, hair strands"


def add_human(side: str, variant: str = "archer", scale: float = 1.0, loc: tuple[float, float, float] = (0, 0, 0)) -> bpy.types.Object:
    root = bpy.data.objects.new(f"{side} {variant} root", None)
    bpy.context.collection.objects.link(root)

    def parent(obj: bpy.types.Object) -> None:
        obj.parent = root

    skin = "skin warm brown" if side == "pandava" else "skin darker brown"
    palette = PALETTES[side]

    parts = [
        uv_sphere("torso muscle shape", (0, 0, 1.14), (0.16, 0.105, 0.31), skin),
        uv_sphere("chest leather armor", (0, -0.03, 1.2), (0.18, 0.055, 0.22), "leather warm" if side == "pandava" else "leather dark"),
        uv_sphere("head", (0, 0, 1.58), (0.12, 0.105, 0.13), skin),
        uv_sphere("hair bun", (0, 0.05, 1.71), (0.11, 0.08, 0.055), "black hair", 20),
        cylinder("headband", (0, -0.01, 1.63), 0.125, 0.03, palette.cloth, 28),
        uv_sphere("nose", (0, -0.107, 1.58), (0.025, 0.022, 0.04), skin, 16),
        uv_sphere("left eye", (-0.04, -0.095, 1.61), (0.012, 0.008, 0.008), "black hair", 12),
        uv_sphere("right eye", (0.04, -0.095, 1.61), (0.012, 0.008, 0.008), "black hair", 12),
        cube("armor belt", (0, -0.02, 0.88), (0.18, 0.065, 0.035), "old bronze", 0.008),
    ]
    for obj in parts:
        parent(obj)

    add_face_and_armor_details(side, root, parent)

    add_dhoti(side, 0.68)
    for obj in bpy.context.scene.objects:
        if obj.parent is None and obj.name.startswith(("layered", "cloth", "blue", "red")):
            parent(obj)

    for x in [-0.07, 0.07]:
        parent(cylinder_between("shin", (x, 0, 0.06), (x, 0, 0.42), 0.032, skin, 14))
        parent(cylinder_between("thigh", (x, 0, 0.42), (x * 0.85, 0, 0.78), 0.042, skin, 14))
        parent(uv_sphere("sandal", (x, -0.045, 0.035), (0.055, 0.09, 0.025), "leather dark", 16))

    parent(cylinder_between("left upper arm", (-0.14, 0, 1.28), (-0.31, -0.03, 1.06), 0.026, skin, 14))
    parent(cylinder_between("left forearm", (-0.31, -0.03, 1.06), (-0.38, -0.12, 0.89), 0.023, skin, 14))
    parent(cylinder_between("right upper arm", (0.14, 0, 1.28), (0.31, -0.03, 1.06), 0.026, skin, 14))
    parent(cylinder_between("right forearm", (0.31, -0.03, 1.06), (0.39, -0.13, 0.9), 0.023, skin, 14))

    parent(cylinder_between("sacred cord", (-0.12, -0.112, 1.36), (0.12, -0.113, 0.96), 0.007, "bright brass", 8))

    if variant == "archer":
        parent(curve("curved long bow", [(0.42, -0.18, 0.75), (0.54, -0.24, 1.1), (0.48, -0.2, 1.52)], "wood bow", 0.017))
        parent(cylinder_between("bow string", (0.42, -0.18, 0.75), (0.48, -0.2, 1.52), 0.004, "steel worn", 8))
        parent(cylinder_between("drawn arrow shaft", (-0.28, -0.18, 1.14), (0.56, -0.2, 1.14), 0.006, "wood bow", 8))
        parent(cone("arrow head", (0.58, -0.2, 1.12), 0.025, 0.0, 0.065, "steel worn", 10))
        parent(cylinder("quiver", (-0.17, 0.1, 1.18), 0.045, 0.42, "leather dark", 14))
        for i in range(5):
            parent(cylinder_between(f"quiver arrow {i}", (-0.2 + i * 0.015, 0.1, 1.31), (-0.22 + i * 0.015, 0.12, 1.63), 0.004, "wood bow", 8))
    elif variant == "standard":
        parent(cylinder_between("standard pole", (0.28, -0.08, 0.75), (0.28, -0.08, 1.95), 0.014, "wood bow", 10))
        parent(cone("standard spear head", (0.28, -0.08, 2.02), 0.045, 0.0, 0.12, "steel worn", 12))
        parent(cube("cloth standard", (0.42, -0.08, 1.72), (0.16, 0.012, 0.12), palette.banner, 0.004))
    else:
        parent(cone("royal crown", (0, 0, 1.76), 0.09, 0.025, 0.18, "bright brass", 18))
        parent(cylinder("round shield", (-0.33, -0.14, 1.08), 0.14, 0.035, "bright brass", 28))
        bpy.context.object.rotation_euler[0] = math.pi / 2
        parent(cylinder_between("sword blade", (0.25, -0.15, 0.95), (0.47, -0.22, 1.38), 0.018, "steel worn", 10))
        parent(cylinder_between("sword grip", (0.19, -0.13, 0.82), (0.25, -0.15, 0.95), 0.018, "wood bow", 10))

    root.location = loc
    root.scale = (scale, scale, scale)
    return root


def add_horse(side: str, loc: tuple[float, float, float] = (0, 0, 0), scale: float = 1.0, dark: bool = False) -> bpy.types.Object:
    root = bpy.data.objects.new(f"{side} horse root", None)
    bpy.context.collection.objects.link(root)
    body_mat = "horse black" if dark else "horse chestnut"

    def parent(obj: bpy.types.Object) -> None:
        obj.parent = root

    parent(uv_sphere("horse body", (0, 0, 0.72), (0.34, 0.68, 0.25), body_mat))
    parent(uv_sphere("horse chest", (0, -0.54, 0.82), (0.24, 0.22, 0.26), body_mat))
    parent(cylinder_between("horse neck", (0, -0.55, 0.95), (0, -0.82, 1.2), 0.12, body_mat, 18))
    parent(uv_sphere("horse head", (0, -0.92, 1.25), (0.14, 0.24, 0.14), body_mat))
    parent(uv_sphere("horse left eye", (-0.055, -1.075, 1.285), (0.013, 0.008, 0.012), "deep eye black", 10))
    parent(uv_sphere("horse right eye", (0.055, -1.075, 1.285), (0.013, 0.008, 0.012), "deep eye black", 10))
    parent(cone("left horse ear", (-0.055, -1.0, 1.42), 0.032, 0.0, 0.11, body_mat, 10))
    parent(cone("right horse ear", (0.055, -1.0, 1.42), 0.032, 0.0, 0.11, body_mat, 10))
    parent(curve("horse black mane", [(0, -0.78, 1.32), (0, -0.55, 1.1), (0, -0.3, 0.98)], "black hair", 0.03))
    parent(curve("horse tail", [(0, 0.6, 0.78), (0.02, 0.78, 0.55), (0.0, 0.86, 0.34)], "black hair", 0.035))
    for x in [-0.18, 0.18]:
        for y in [-0.38, 0.42]:
            parent(cylinder_between("horse upper leg", (x, y, 0.56), (x * 1.08, y + (0.05 if y > 0 else -0.03), 0.26), 0.04, body_mat, 14))
            parent(cylinder_between("horse lower leg", (x * 1.08, y + (0.05 if y > 0 else -0.03), 0.26), (x * 1.12, y + (0.08 if y > 0 else -0.05), 0.04), 0.032, body_mat, 14))
            parent(uv_sphere("horse hoof", (x * 1.12, y + (0.08 if y > 0 else -0.05), 0.02), (0.055, 0.075, 0.025), "black hair", 12))
    parent(cube("embroidered saddle cloth", (0, -0.02, 1.0), (0.32, 0.4, 0.035), PALETTES[side].cloth, 0.012))
    for x in [-0.18, 0.18]:
        parent(cylinder_between("saddle bronze trim", (x, -0.38, 1.045), (x, 0.34, 1.045), 0.007, "bright brass", 8))
    parent(cube("leather saddle", (0, -0.04, 1.07), (0.22, 0.24, 0.055), "leather dark", 0.012))
    parent(curve("bridle", [(-0.08, -1.04, 1.26), (-0.11, -0.92, 1.16), (-0.08, -0.72, 1.1)], "leather dark", 0.007))
    parent(curve("bridle mirror", [(0.08, -1.04, 1.26), (0.11, -0.92, 1.16), (0.08, -0.72, 1.1)], "leather dark", 0.007))
    root.location = loc
    root.scale = (scale, scale, scale)
    return root


def add_elephant(side: str) -> None:
    uv_sphere("elephant massive body", (0, 0.04, 0.92), (0.48, 0.78, 0.42), "elephant hide", 40)
    uv_sphere("elephant head", (0, -0.62, 1.03), (0.34, 0.32, 0.31), "elephant hide", 36)
    uv_sphere("elephant left eye", (-0.12, -0.85, 1.13), (0.022, 0.012, 0.018), "deep eye black", 12)
    uv_sphere("elephant right eye", (0.12, -0.85, 1.13), (0.022, 0.012, 0.018), "deep eye black", 12)
    cube("elephant forehead paint", (0, -0.93, 1.21), (0.035, 0.006, 0.12), "white war paint", 0.002)
    cube("elephant brow paint left", (-0.095, -0.92, 1.19), (0.055, 0.006, 0.018), PALETTES[side].cloth, 0.002)
    cube("elephant brow paint right", (0.095, -0.92, 1.19), (0.055, 0.006, 0.018), PALETTES[side].cloth, 0.002)
    curve("curved trunk", [(0, -0.85, 0.95), (0.02, -1.0, 0.62), (-0.02, -0.88, 0.28)], "elephant darker hide", 0.065)
    uv_sphere("left ear", (-0.32, -0.56, 1.06), (0.19, 0.055, 0.27), "elephant darker hide", 24)
    uv_sphere("right ear", (0.32, -0.56, 1.06), (0.19, 0.055, 0.27), "elephant darker hide", 24)
    curve("left tusk", [(-0.12, -0.82, 0.9), (-0.18, -1.05, 0.78), (-0.16, -1.2, 0.64)], "ivory tusk", 0.025)
    curve("right tusk", [(0.12, -0.82, 0.9), (0.18, -1.05, 0.78), (0.16, -1.2, 0.64)], "ivory tusk", 0.025)
    for x in [-0.27, 0.27]:
        for y in [-0.38, 0.42]:
            cylinder("elephant pillar leg", (x, y, 0.32), 0.09, 0.64, "elephant hide", 18)
            uv_sphere("elephant foot", (x, y, 0.05), (0.13, 0.14, 0.05), "elephant darker hide", 16)
    cube("royal caparison", (0, 0.03, 1.28), (0.52, 0.66, 0.035), PALETTES[side].cloth, 0.018)
    for x in [-0.2, 0, 0.2]:
        cylinder_between("caparison gold tassel", (x, -0.36, 1.24), (x, -0.36, 1.03), 0.009, "bright brass", 8)
    cube("gold howdah base", (0, 0.02, 1.55), (0.32, 0.28, 0.1), "old bronze", 0.018)
    cube("howdah back", (0, 0.18, 1.72), (0.32, 0.025, 0.19), "bright brass", 0.01)
    cube("howdah front", (0, -0.18, 1.7), (0.32, 0.025, 0.15), "bright brass", 0.01)
    add_human(side, "commander", 0.45, (0, 0.02, 1.55))


def add_chariot(side: str) -> None:
    add_horse(side, (-0.2, -0.72, 0), 0.55)
    add_horse(side, (0.2, -0.72, 0), 0.55, dark=True)
    cube("ornate chariot cabin", (0, 0.14, 0.55), (0.45, 0.28, 0.24), "leather warm", 0.02)
    cube("front chariot panel", (0, -0.13, 0.74), (0.46, 0.035, 0.24), PALETTES[side].cloth, 0.012)
    for x in [-0.16, 0, 0.16]:
        cube("front panel bronze medallion", (x, -0.17, 0.78), (0.035, 0.012, 0.035), "bright brass", 0.006)
    cube("rear chariot panel", (0, 0.4, 0.72), (0.46, 0.035, 0.2), "old bronze", 0.012)
    cylinder_between("left axle", (-0.5, 0.32, 0.38), (0.5, 0.32, 0.38), 0.025, "wood bow", 12)
    for x in [-0.55, 0.55]:
        w = torus("spoked wheel", (x, 0.32, 0.38), 0.18, 0.018, "bright brass")
        w.rotation_euler[1] = math.pi / 2
        for angle in range(0, 180, 30):
            a = math.radians(angle)
            cylinder_between("wheel spoke", (x, 0.32 + math.cos(a) * 0.02, 0.38 + math.sin(a) * 0.02), (x, 0.32 + math.cos(a) * 0.15, 0.38 + math.sin(a) * 0.15), 0.006, "bright brass", 8)
    cylinder_between("yoke", (-0.42, -0.28, 0.55), (0.42, -0.28, 0.55), 0.018, "wood bow", 10)
    cylinder_between("left rail", (-0.24, -0.28, 0.58), (-0.34, -0.58, 0.7), 0.014, "wood bow", 10)
    cylinder_between("right rail", (0.24, -0.28, 0.58), (0.34, -0.58, 0.7), 0.014, "wood bow", 10)
    add_human(side, "standard", 0.55, (0, 0.12, 0.68))


def add_animation_clip(
    root: bpy.types.Object,
    name: str,
    keyframes: Iterable[tuple[int, tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]],
) -> None:
    frames = list(keyframes)
    action = bpy.data.actions.new(name)
    root.animation_data_create()
    root.animation_data.action = action

    for frame, location, rotation, scale in frames:
        root.location = location
        root.rotation_euler = rotation
        root.scale = scale
        root.keyframe_insert(data_path="location", frame=frame)
        root.keyframe_insert(data_path="rotation_euler", frame=frame)
        root.keyframe_insert(data_path="scale", frame=frame)

    track = root.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, frames[0][0], action)
    strip.name = name
    strip.frame_start = frames[0][0]
    strip.frame_end = frames[-1][0]
    root.animation_data.action = None


def add_runtime_animation_clips(root: bpy.types.Object, role: str) -> None:
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 72
    bpy.context.scene.render.fps = 24

    heavy = role in {"war-chariot", "war-elephant-commander"}
    royal = role == "royal-commander"
    move_lift = 0.025 if not heavy else 0.014
    move_sway = math.radians(2.4 if not heavy else 1.2)
    attack_reach = 0.22 if not heavy else 0.14
    recoil = 0.12 if not heavy else 0.075

    add_animation_clip(
        root,
        "idle",
        [
            (1, (0, 0, 0), (0, 0, 0), (1, 1, 1)),
            (24, (0, 0, 0.01), (math.radians(0.45), 0, math.radians(0.6)), (1.006, 1.006, 1.006)),
            (48, (0, 0, 0), (0, 0, math.radians(-0.45)), (0.997, 0.997, 0.997)),
            (72, (0, 0, 0), (0, 0, 0), (1, 1, 1)),
        ],
    )
    add_animation_clip(
        root,
        "move",
        [
            (1, (0, 0, 0), (0, 0, 0), (1, 1, 1)),
            (7, (0.016, -0.018, move_lift), (math.radians(-1.6), 0, move_sway), (1, 1, 1)),
            (13, (0, -0.035, 0), (0, 0, 0), (1, 1, 1)),
            (19, (-0.016, -0.018, move_lift), (math.radians(-1.3), 0, -move_sway), (1, 1, 1)),
            (25, (0, 0, 0), (0, 0, 0), (1, 1, 1)),
        ],
    )
    add_animation_clip(
        root,
        "attack",
        [
            (1, (0, 0, 0), (0, 0, 0), (1, 1, 1)),
            (8, (0, 0.035, 0.01), (math.radians(2.5), 0, math.radians(-1.4)), (0.992, 0.992, 0.992)),
            (14, (0, -attack_reach, 0.018), (math.radians(-7), 0, math.radians(1.8)), (1.018, 1.018, 1.018)),
            (24, (0, 0, 0), (0, 0, 0), (1, 1, 1)),
        ],
    )
    add_animation_clip(
        root,
        "hit",
        [
            (1, (0, 0, 0), (0, 0, 0), (1, 1, 1)),
            (9, (0, recoil, 0.008), (math.radians(7.5), 0, math.radians(-4)), (0.965, 0.965, 0.965)),
            (18, (0, recoil * 0.42, 0.0), (math.radians(4), 0, math.radians(2.2)), (0.98, 0.98, 0.98)),
            (34, (0, 0, 0), (0, 0, 0), (1, 1, 1)),
        ],
    )
    add_animation_clip(
        root,
        "check",
        [
            (1, (0, 0, 0), (0, 0, 0), (1, 1, 1)),
            (10, (0, 0, 0.015), (0, 0, math.radians(1.4)), (1.04, 1.04, 1.04)),
            (20, (0, 0, 0), (0, 0, math.radians(-1.4)), (0.985, 0.985, 0.985)),
            (30, (0, 0, 0.012), (0, 0, 0), (1.025 if royal else 1.012, 1.025 if royal else 1.012, 1.025 if royal else 1.012)),
            (48, (0, 0, 0), (0, 0, 0), (1, 1, 1)),
        ],
    )
    root["animation_clips"] = "idle,move,attack,hit,check"


# ---------------------------------------------------------------------------
# Skeletal rig for the standalone humanoid units (foot archer, advisor-standard
# bearer, royal commander). These units are joined into a single skinned mesh,
# bound to an armature with per-limb bones, and animated with real bone poses so
# the runtime plays articulated motion instead of a whole-body transform clip.
# Mounted/vehicle units keep the lighter whole-object clip path above.
# ---------------------------------------------------------------------------

# (name, head, tail, parent) — rest pose matches the geometry built by add_human.
HUMANOID_BONES = [
    ("hips", (0.0, 0.0, 0.86), (0.0, 0.0, 1.04), None),
    ("spine", (0.0, 0.0, 1.04), (0.0, 0.0, 1.26), "hips"),
    ("chest", (0.0, 0.0, 1.26), (0.0, 0.0, 1.46), "spine"),
    ("neck", (0.0, 0.0, 1.46), (0.0, 0.0, 1.55), "chest"),
    ("head", (0.0, 0.0, 1.55), (0.0, 0.0, 1.76), "neck"),
    ("shoulder.L", (-0.04, 0.0, 1.38), (-0.14, 0.0, 1.28), "chest"),
    ("upperarm.L", (-0.14, 0.0, 1.28), (-0.31, -0.03, 1.06), "shoulder.L"),
    ("forearm.L", (-0.31, -0.03, 1.06), (-0.38, -0.12, 0.89), "upperarm.L"),
    ("hand.L", (-0.38, -0.12, 0.89), (-0.44, -0.2, 0.8), "forearm.L"),
    ("shoulder.R", (0.04, 0.0, 1.38), (0.14, 0.0, 1.28), "chest"),
    ("upperarm.R", (0.14, 0.0, 1.28), (0.31, -0.03, 1.06), "shoulder.R"),
    ("forearm.R", (0.31, -0.03, 1.06), (0.39, -0.13, 0.9), "upperarm.R"),
    ("hand.R", (0.39, -0.13, 0.9), (0.46, -0.2, 0.82), "forearm.R"),
    ("thigh.L", (-0.07, 0.0, 0.82), (-0.07, 0.0, 0.42), "hips"),
    ("shin.L", (-0.07, 0.0, 0.42), (-0.07, 0.0, 0.06), "thigh.L"),
    ("foot.L", (-0.07, 0.0, 0.06), (-0.07, -0.1, 0.0), "shin.L"),
    ("thigh.R", (0.07, 0.0, 0.82), (0.07, 0.0, 0.42), "hips"),
    ("shin.R", (0.07, 0.0, 0.42), (0.07, 0.0, 0.06), "thigh.R"),
    ("foot.R", (0.07, 0.0, 0.06), (0.07, -0.1, 0.0), "shin.R"),
]


def _point_segment_distance(p: Vector, a: Vector, b: Vector) -> float:
    ab = b - a
    denom = ab.length_squared
    if denom < 1e-9:
        return (p - a).length
    t = max(0.0, min(1.0, (p - a).dot(ab) / denom))
    return (p - (a + ab * t)).length


def merge_unit_to_mesh(root: bpy.types.Object, name: str) -> bpy.types.Object:
    """Convert curves, unparent, apply transforms, and join into one mesh."""
    bpy.ops.object.mode_set(mode="OBJECT")
    children = [o for o in bpy.data.objects if o.parent is root]
    for obj in children:
        if obj.type == "CURVE":
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target="MESH")
    children = [o for o in bpy.data.objects if o.parent is root and o.type == "MESH"]

    bpy.ops.object.select_all(action="DESELECT")
    for obj in children:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = children[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.object.delete()

    bpy.ops.object.select_all(action="DESELECT")
    for obj in children:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = children[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()

    body = bpy.context.view_layer.objects.active
    body.name = name
    return body


def build_humanoid_armature(name: str) -> bpy.types.Object:
    arm_data = bpy.data.armatures.new(f"{name} skeleton")
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    created: dict[str, bpy.types.EditBone] = {}
    for bname, head, tail, parent in HUMANOID_BONES:
        bone = arm_data.edit_bones.new(bname)
        bone.head = head
        bone.tail = tail
        bone.use_connect = False
        if parent:
            bone.parent = created[parent]
        created[bname] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def bind_mesh_to_armature(body: bpy.types.Object, arm: bpy.types.Object) -> None:
    # Drop the leftover bevel/weighted-normal modifiers inherited from the join
    # so the skinned glTF export does not re-evaluate them on every sampled frame.
    for mod in list(body.modifiers):
        body.modifiers.remove(mod)
    bones = [
        (b.name, Vector(b.head_local), Vector(b.tail_local))
        for b in arm.data.bones
    ]
    groups = {name: body.vertex_groups.new(name=name) for name, _, _ in bones}
    for vert in body.data.vertices:
        co = vert.co
        best_name = None
        best_dist = 1e9
        for name, head, tail in bones:
            dist = _point_segment_distance(co, head, tail)
            if dist < best_dist:
                best_dist = dist
                best_name = name
        groups[best_name].add([vert.index], 1.0, "REPLACE")
    body.parent = arm
    modifier = body.modifiers.new("Armature", "ARMATURE")
    modifier.object = arm


def _pose_clip(arm: bpy.types.Object, name: str, entries) -> None:
    """entries: list of (frame, {bone: (rx, ry, rz) radians}, (lx, ly, lz) | None)."""
    action = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = action
    for pbone in arm.pose.bones:
        pbone.rotation_mode = "XYZ"
    for frame, rotations, loc in entries:
        for bname, rot in rotations.items():
            pbone = arm.pose.bones[bname]
            pbone.rotation_euler = rot
            pbone.keyframe_insert(data_path="rotation_euler", frame=frame)
        if loc is not None:
            arm.location = loc
            arm.keyframe_insert(data_path="location", frame=frame)
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(action.frame_range[0]), action)
    strip.name = name
    arm.animation_data.action = None
    arm.location = (0.0, 0.0, 0.0)


def animate_humanoid(arm: bpy.types.Object, role: str) -> None:
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 72
    bpy.context.scene.render.fps = 24
    r = math.radians
    zero = (0.0, 0.0, 0.0)

    _pose_clip(
        arm,
        "idle",
        [
            (1, {"chest": zero, "head": zero, "upperarm.L": zero, "upperarm.R": zero}, (0, 0, 0)),
            (24, {"chest": (r(1.2), 0, 0), "head": (r(-1.0), 0, r(0.8)), "upperarm.L": (r(2.0), 0, 0), "upperarm.R": (r(2.0), 0, 0)}, (0, 0, 0.006)),
            (48, {"chest": (r(-0.6), 0, 0), "head": (r(0.6), 0, r(-0.8)), "upperarm.L": (r(-1.0), 0, 0), "upperarm.R": (r(-1.0), 0, 0)}, (0, 0, 0)),
            (72, {"chest": zero, "head": zero, "upperarm.L": zero, "upperarm.R": zero}, (0, 0, 0)),
        ],
    )

    _pose_clip(
        arm,
        "move",
        [
            (1, {"thigh.L": zero, "thigh.R": zero, "shin.L": zero, "shin.R": zero, "upperarm.L": zero, "upperarm.R": zero, "spine": zero}, (0, 0, 0)),
            (7, {"thigh.L": (r(24), 0, 0), "thigh.R": (r(-22), 0, 0), "shin.L": (r(-18), 0, 0), "shin.R": (r(10), 0, 0), "upperarm.L": (r(-16), 0, 0), "upperarm.R": (r(16), 0, 0), "spine": (r(2), 0, 0)}, (0, 0, 0.02)),
            (13, {"thigh.L": zero, "thigh.R": zero, "shin.L": zero, "shin.R": zero, "upperarm.L": zero, "upperarm.R": zero, "spine": zero}, (0, 0, 0)),
            (19, {"thigh.L": (r(-22), 0, 0), "thigh.R": (r(24), 0, 0), "shin.L": (r(10), 0, 0), "shin.R": (r(-18), 0, 0), "upperarm.L": (r(16), 0, 0), "upperarm.R": (r(-16), 0, 0), "spine": (r(2), 0, 0)}, (0, 0, 0.02)),
            (25, {"thigh.L": zero, "thigh.R": zero, "shin.L": zero, "shin.R": zero, "upperarm.L": zero, "upperarm.R": zero, "spine": zero}, (0, 0, 0)),
        ],
    )

    if role == "foot-archer":
        attack = [
            (1, {"chest": zero, "upperarm.L": zero, "forearm.L": zero, "upperarm.R": zero, "forearm.R": zero}, None),
            (8, {"chest": (0, 0, r(10)), "upperarm.L": (r(-6), 0, r(18)), "forearm.L": (r(8), 0, r(34)), "upperarm.R": (r(-8), 0, r(-8)), "forearm.R": (r(-6), 0, 0)}, None),
            (14, {"chest": (0, 0, r(-4)), "upperarm.L": (r(-4), 0, r(-10)), "forearm.L": (r(-14), 0, r(-12)), "upperarm.R": (r(-8), 0, r(-8)), "forearm.R": (r(-6), 0, 0)}, None),
            (24, {"chest": zero, "upperarm.L": zero, "forearm.L": zero, "upperarm.R": zero, "forearm.R": zero}, None),
        ]
    else:
        attack = [
            (1, {"chest": zero, "upperarm.R": zero, "forearm.R": zero, "spine": zero}, None),
            (8, {"chest": (0, 0, r(-12)), "upperarm.R": (r(-40), 0, 0), "forearm.R": (r(-20), 0, 0), "spine": (r(-3), 0, 0)}, None),
            (14, {"chest": (0, 0, r(8)), "upperarm.R": (r(46), 0, 0), "forearm.R": (r(20), 0, 0), "spine": (r(5), 0, 0)}, None),
            (24, {"chest": zero, "upperarm.R": zero, "forearm.R": zero, "spine": zero}, None),
        ]
    _pose_clip(arm, "attack", attack)

    _pose_clip(
        arm,
        "hit",
        [
            (1, {"spine": zero, "chest": zero, "head": zero, "upperarm.L": zero, "upperarm.R": zero}, (0, 0, 0)),
            (9, {"spine": (r(14), 0, 0), "chest": (r(8), 0, 0), "head": (r(12), 0, 0), "upperarm.L": (r(-20), 0, 0), "upperarm.R": (r(-20), 0, 0)}, (0, 0.02, -0.01)),
            (18, {"spine": (r(-5), 0, 0), "chest": (r(-3), 0, 0), "head": (r(-4), 0, 0), "upperarm.L": (r(8), 0, 0), "upperarm.R": (r(8), 0, 0)}, (0, 0, 0)),
            (34, {"spine": zero, "chest": zero, "head": zero, "upperarm.L": zero, "upperarm.R": zero}, (0, 0, 0)),
        ],
    )

    _pose_clip(
        arm,
        "check",
        [
            (1, {"chest": zero, "head": zero, "upperarm.R": zero, "forearm.R": zero}, (0, 0, 0)),
            (10, {"chest": (r(-6), 0, 0), "head": (r(-8), 0, 0), "upperarm.R": (r(-70), 0, 0), "forearm.R": (r(-20), 0, 0)}, (0, 0, 0.02)),
            (20, {"chest": (r(-4), 0, 0), "head": (r(-6), 0, 0), "upperarm.R": (r(-64), 0, 0), "forearm.R": (r(-26), 0, 0)}, (0, 0, 0.01)),
            (30, {"chest": (r(-6), 0, 0), "head": (r(-8), 0, 0), "upperarm.R": (r(-72), 0, 0), "forearm.R": (r(-18), 0, 0)}, (0, 0, 0.02)),
            (48, {"chest": zero, "head": zero, "upperarm.R": zero, "forearm.R": zero}, (0, 0, 0)),
        ],
    )
    arm["animation_clips"] = "idle,move,attack,hit,check"


def add_skinned_human_unit(side: str, role: str, variant: str) -> None:
    reset_scene()
    ensure_materials()

    root = add_human(side, variant, 1.0)
    body = merge_unit_to_mesh(root, f"{side}-{role}-body")
    arm = build_humanoid_armature(f"{side}-{role}-runtime-root")
    bind_mesh_to_armature(body, arm)
    animate_humanoid(arm, role)
    arm["required_animations"] = "idle,move,attack,hit,check"
    arm["forward_axis"] = "+Y in Blender, converted by glTF import"
    arm["origin_policy"] = "ground centered"
    arm["rig"] = "skeletal armature, per-limb bone animation"

    bpy.ops.object.light_add(type="AREA", location=(0, -3, 5))
    bpy.context.object.name = "preview softbox"
    bpy.context.object.data.energy = 450
    bpy.context.object.data.size = 4
    bpy.ops.object.camera_add(location=(0, -5.0, 2.4), rotation=(math.radians(64), 0, 0))
    bpy.context.scene.camera = bpy.context.object

    filepath = OUT_DIR / f"{side}-{role}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format="GLB",
        export_copyright="MIRROR project-authored procedural Blender asset, AGPL-3.0-or-later",
        export_apply=False,
        export_animations=True,
        export_nla_strips=True,
        export_skins=True,
        export_yup=True,
    )
    print(f"wrote {filepath} (skeletal rig)")


def add_unit(side: str, role: str) -> None:
    if role in {"foot-archer", "advisor-standard-bearer", "royal-commander"}:
        variant = {
            "foot-archer": "archer",
            "advisor-standard-bearer": "standard",
            "royal-commander": "commander",
        }[role]
        add_skinned_human_unit(side, role, variant)
        return

    reset_scene()
    ensure_materials()
    reset_scene()
    ensure_materials()

    if role == "foot-archer":
        add_human(side, "archer", 1.0)
    elif role == "horse-archer":
        add_horse(side, (0, 0, 0), 0.82)
        add_human(side, "archer", 0.48, (0, -0.04, 1.02))
    elif role == "advisor-standard-bearer":
        add_human(side, "standard", 1.05)
    elif role == "war-chariot":
        add_chariot(side)
    elif role == "war-elephant-commander":
        add_elephant(side)
    elif role == "royal-commander":
        add_human(side, "commander", 1.08)
    else:
        raise ValueError(role)

    # Add a tiny named root marker and runtime animation clips.
    root = bpy.data.objects.new(f"{side}-{role}-runtime-root", None)
    bpy.context.collection.objects.link(root)
    for obj in bpy.context.scene.objects:
        if obj is not root and obj.parent is None:
            obj.parent = root
    add_runtime_animation_clips(root, role)
    root["required_animations"] = "idle,move,attack,hit,check"
    root["forward_axis"] = "+Y in Blender, converted by glTF import"
    root["origin_policy"] = "ground centered"

    # Small local lighting/camera for thumbnails if opened in Blender.
    bpy.ops.object.light_add(type="AREA", location=(0, -3, 5))
    bpy.context.object.name = "preview softbox"
    bpy.context.object.data.energy = 450
    bpy.context.object.data.size = 4
    bpy.ops.object.camera_add(location=(0, -5.0, 2.4), rotation=(math.radians(64), 0, 0))
    bpy.context.scene.camera = bpy.context.object

    filepath = OUT_DIR / f"{side}-{role}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format="GLB",
        export_copyright="MIRROR project-authored procedural Blender asset, AGPL-3.0-or-later",
        export_apply=True,
        export_animations=True,
        export_nla_strips=True,
        export_yup=True,
    )
    print(f"wrote {filepath}")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    roles = [
        "foot-archer",
        "horse-archer",
        "advisor-standard-bearer",
        "war-chariot",
        "war-elephant-commander",
        "royal-commander",
    ]
    for side in ["pandava", "kaurava"]:
        for role in roles:
            add_unit(side, role)


if __name__ == "__main__":
    main()
