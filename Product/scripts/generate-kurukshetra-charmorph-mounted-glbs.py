"""
Generate mounted Kurukshetra GLBs with CharMorph/MB-Lab riders.

This is an upgrade pass for the six mounted/vehicle slots:

  - horse archer
  - war chariot
  - war elephant commander

The animals and vehicles are still MIRROR-authored procedural Blender geometry,
but the riders/drivers are real CharMorph/MB-Lab mb_male skinned humans with
159-joint rigs, fitted hair/lower cloth, seated poses, and matching animation
clips. This removes the worst visual failures from the previous mounted assets:
flat toy riders, floating kings/drivers, and detached body silhouettes.

License note: CharMorph's MB-Lab male character data is AGPL3-derived. The
exported mounted GLBs are therefore documented as AGPL3-derived humanoid riders
plus MIRROR-authored procedural mounts/vehicles.
"""

from __future__ import annotations

import importlib.util
import math
import os
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "assets" / "3d" / "kurukshetra-production-v1"
ONLY = os.environ.get("KURU_ONLY", "")

SIDES = ("pandava", "kaurava")
MOUNTED_ROLES = ("horse-archer", "war-chariot", "war-elephant-commander")


def import_script(module_name: str, path: Path):
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"Could not import {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


cm = import_script("kurukshetra_charmorph_humans", ROOT / "scripts" / "generate-kurukshetra-charmorph-humanoid-glbs.py")
proc = import_script("kurukshetra_procedural_mounts", ROOT / "scripts" / "generate-kurukshetra-realistic-glbs.py")


def reset_scene() -> None:
    proc.reset_scene()
    cm.MATS.clear()
    cm.ensure_mats()


def material_objects(parts: list[tuple[bpy.types.Object, str]]) -> list[bpy.types.Object]:
    return [obj for obj, _ in parts]


def apply_part_materials(parts: list[tuple[bpy.types.Object, str]], mats: dict) -> None:
    for obj, mat_name in parts:
        if obj.type != "MESH":
            continue
        mat = mats.get(mat_name)
        if mat is None:
            continue
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)


def parent_keep_world(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = matrix


def ensure_parent_keep_world(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    if child.parent is None:
        parent_keep_world(child, parent)


def set_object_tree_transform(obj: bpy.types.Object, *, loc, scale, rot=(0, 0, 0)) -> None:
    obj.location = loc
    obj.scale = scale
    obj.rotation_euler = rot


def add_rider(side: str, role: str, mounted_role: str, *, loc, scale, rot=(0, 0, 0)) -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    arm, body, fitted_assets = cm.import_charmorph_body(side, role)
    rest_pose = mounted_rest_pose(mounted_role)
    apply_pose_as_rest(arm, rest_pose)
    extras = cm.add_body_overlays(side, role, arm)
    extras += add_mounted_weapon_details(side, role, mounted_role, arm)
    for obj in extras:
        ensure_parent_keep_world(obj, arm)

    rider_root = bpy.data.objects.new(f"{side}-{mounted_role}-seated-rider-root", None)
    bpy.context.collection.objects.link(rider_root)
    parent_keep_world(arm, rider_root)
    for obj in [body, *fitted_assets]:
        if obj.parent is None:
            parent_keep_world(obj, rider_root)

    set_object_tree_transform(rider_root, loc=loc, scale=scale, rot=rot)
    create_mounted_rider_clips(arm, mounted_role)
    arm["rider_pose"] = f"seated {mounted_role}"
    arm["license"] = "AGPL3 derived from CharMorph MB-Lab mb_male"
    return rider_root, [arm, body, *fitted_assets, *extras]


def mounted_rest_pose(mounted_role: str) -> dict[str, tuple[float, float, float]]:
    r = math.radians
    seated = {
        "spine.003": (r(2), 0, 0),
        "spine.004": (r(-1.2), 0, 0),
        "thigh.L": (r(64), r(0), r(-18)),
        "thigh.R": (r(64), r(0), r(18)),
        "shin.L": (r(-74), r(0), r(5)),
        "shin.R": (r(-74), r(0), r(-5)),
        "foot.L": (r(8), r(0), r(-6)),
        "foot.R": (r(8), r(0), r(6)),
    }
    if mounted_role == "horse-archer":
        return {
            **seated,
            "upper_arm.L": (r(-20), r(-12), r(-48)),
            "forearm.L": (r(-10), r(0), r(-8)),
            "hand.L": (r(0), r(0), r(8)),
            "upper_arm.R": (r(-32), r(8), r(44)),
            "forearm.R": (r(-46), r(0), r(6)),
            "hand.R": (r(0), r(0), r(-8)),
            "spine.004": (r(-1), r(0), r(-6)),
        }
    if mounted_role == "war-chariot":
        return {
            **seated,
            "upper_arm.L": (r(-30), r(-24), r(-38)),
            "forearm.L": (r(-35), r(0), r(-5)),
            "upper_arm.R": (r(-30), r(24), r(38)),
            "forearm.R": (r(-35), r(0), r(5)),
            "spine.004": (r(1), r(0), r(0)),
        }
    return {
        **seated,
        "upper_arm.L": (r(-8), r(-38), r(-44)),
        "forearm.L": (r(-28), r(0), r(-4)),
        "upper_arm.R": (r(-56), r(12), r(18)),
        "forearm.R": (r(-38), r(0), r(4)),
        "spine.004": (r(-2), r(0), r(-4)),
    }


def apply_pose_as_rest(arm: bpy.types.Object, rotations: dict[str, tuple[float, float, float]]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
        if pb.name in rotations:
            pb.rotation_euler = rotations[pb.name]
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def add_mounted_weapon_details(side: str, role: str, mounted_role: str, arm: bpy.types.Object) -> list[bpy.types.Object]:
    cloth = "cloth indigo" if side == "pandava" else "cloth wine"
    out: list[bpy.types.Object] = []
    if mounted_role == "horse-archer":
        bow = cm.curve("mounted bow near left hand", [(-0.32, -0.2, 0.9), (-0.47, -0.26, 1.18), (-0.3, -0.22, 1.45)], 0.011, "wood")
        string = cm.curve("mounted bow string", [(-0.32, -0.2, 0.9), (-0.20, -0.24, 1.18), (-0.3, -0.22, 1.45)], 0.003, "steel")
        shaft = cm.cyl_between("mounted drawn arrow shaft", (0.18, -0.24, 1.16), (-0.48, -0.28, 1.2), 0.005, "wood", 8)
        head = cm.cone("mounted drawn arrow head", (-0.52, -0.285, 1.2), 0.015, 0, 0.05, "steel", 10)
        head.rotation_euler = (math.radians(88), 0, math.radians(78))
        for obj, bone in ((bow, "hand.L"), (string, "hand.L"), (shaft, "hand.R"), (head, "hand.R")):
            out.append(cm.parent_to_bone_keep_world(obj, arm, bone))
        quiver = cm.cone("mounted rear quiver", (0.14, 0.11, 1.18), 0.045, 0.038, 0.34, "dark leather", 16)
        quiver.rotation_euler = (math.radians(16), 0, math.radians(-12))
        out.append(cm.parent_to_bone_keep_world(quiver, arm, "spine.004"))
        for i in range(6):
            arrow = cm.cyl_between(f"mounted quiver arrow {i}", (0.08 + i * 0.012, 0.13, 1.32), (0.1 + i * 0.012, 0.16, 1.55), 0.004, "wood", 6)
            out.append(cm.parent_to_bone_keep_world(arrow, arm, "spine.004"))
    elif mounted_role == "war-chariot":
        for sx in (-1, 1):
            rein = cm.curve(f"driver hand rein {sx}", [(sx * 0.12, -0.18, 0.98), (sx * 0.18, -0.58, 0.76), (sx * 0.24, -1.12, 0.68)], 0.006, "dark leather")
            out.append(cm.parent_to_bone_keep_world(rein, arm, "hand.L" if sx < 0 else "hand.R"))
        spear_shaft = cm.cyl_between("driver short spear", (0.32, -0.14, 0.72), (0.44, -0.16, 1.54), 0.012, "wood", 10)
        spear = cm.cone("driver short spear head", (0.455, -0.162, 1.6), 0.035, 0, 0.12, "steel", 12)
        spear.rotation_euler = (math.radians(8), 0, math.radians(-8))
        out.append(cm.parent_to_bone_keep_world(spear_shaft, arm, "hand.R"))
        out.append(cm.parent_to_bone_keep_world(spear, arm, "hand.R"))
    else:
        blade = cm.cyl_between("elephant commander sword blade", (0.36, -0.2, 0.92), (0.54, -0.24, 1.5), 0.016, "steel", 8)
        grip = cm.cyl_between("elephant commander sword grip", (0.32, -0.18, 0.78), (0.37, -0.2, 0.94), 0.014, "wood", 8)
        shield = cm.cone("elephant commander shield", (-0.38, -0.2, 1.08), 0.15, 0.15, 0.035, "bronze", 36)
        shield.rotation_euler = (math.radians(90), 0, 0)
        out.append(cm.parent_to_bone_keep_world(blade, arm, "hand.R"))
        out.append(cm.parent_to_bone_keep_world(grip, arm, "hand.R"))
        out.append(cm.parent_to_bone_keep_world(shield, arm, "hand.L"))
        banner = cm.cube("small howdah banner cloth", (-0.24, 0.16, 1.38), (0.12, 0.008, 0.19), cloth, 0.003)
        out.append(cm.parent_to_bone_keep_world(banner, arm, "spine.004"))
    return out


def create_mounted_rider_clips(arm: bpy.types.Object, mounted_role: str) -> None:
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 72
    r = math.radians
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"

    base = mounted_rest_pose(mounted_role)

    def clip(name: str, frames) -> None:
        clip_name = f"rider_{name}"
        action = bpy.data.actions.new(clip_name)
        arm.animation_data_create()
        arm.animation_data.action = action
        for frame, rotations in frames:
            keyed_rotations = dict(base)
            keyed_rotations.update(rotations)
            for bone, rot in keyed_rotations.items():
                if bone in arm.pose.bones:
                    pb = arm.pose.bones[bone]
                    pb.rotation_euler = rot
                    pb.keyframe_insert(data_path="rotation_euler", frame=frame)
        track = arm.animation_data.nla_tracks.new()
        track.name = clip_name
        strip = track.strips.new(clip_name, int(action.frame_range[0]), action)
        strip.name = clip_name
        arm.animation_data.action = None

    clip("idle", [
        (1, {}),
        (24, {"spine.003": (r(2.8), 0, 0), "spine.004": (r(-1.8), 0, r(0.8))}),
        (48, {"spine.003": (r(1.2), 0, 0), "spine.004": (r(-0.4), 0, r(-0.6))}),
        (72, {}),
    ])
    if mounted_role == "horse-archer":
        clip("move", [(1, {}), (8, {"spine.003": (r(4), 0, r(1.2))}), (16, {"spine.003": (r(0), 0, r(-1.2))}), (24, {})])
        clip("attack", [
            (1, {}),
            (8, {"upper_arm.R": (r(-18), r(0), r(-80)), "forearm.R": (r(-50), 0, 0), "spine.004": (r(-1), 0, r(-12))}),
            (16, {"upper_arm.R": (r(0), r(0), r(-34)), "forearm.R": (r(-8), 0, 0), "spine.004": (r(2), 0, r(4))}),
            (28, {}),
        ])
    else:
        clip("move", [(1, {}), (12, {"spine.003": (r(3), 0, r(0.8))}), (24, {"spine.003": (r(1), 0, r(-0.8))}), (36, {})])
        clip("attack", [
            (1, {}),
            (10, {"upper_arm.R": (r(-64), 0, r(-18)), "forearm.R": (r(-24), 0, 0), "spine.004": (r(-3), 0, r(-9))}),
            (18, {"upper_arm.R": (r(36), 0, r(8)), "forearm.R": (r(20), 0, 0), "spine.004": (r(5), 0, r(10))}),
            (30, {}),
        ])
    clip("hit", [
        (1, {}),
        (9, {"spine.003": (r(10), 0, 0), "spine.004": (r(8), 0, 0)}),
        (20, {"spine.003": (r(-3), 0, 0), "spine.004": (r(-2), 0, 0)}),
        (34, {}),
    ])
    arm["animation_clips"] = "rider_idle,rider_move,rider_attack,rider_hit"


def refine_mount_parts(side: str, mounted_role: str, parts: list[tuple[bpy.types.Object, str]], mats: dict) -> list[tuple[bpy.types.Object, str]]:
    """Correct the most visible procedural-mount artifacts before export.

    The current mounted units are still not final licensed/PBR animal rigs, but
    this pass removes the obvious cube-seat look and lowers riders into contact
    with their mounts instead of visually stacking them on top.
    """
    palette = proc.palette_for(side)
    additions: list[tuple[bpy.types.Object, str]] = []

    if mounted_role == "war-elephant-commander":
        for obj, _ in parts:
            low = obj.name.lower()
            if "howdah" in low:
                obj.name = "low carved elephant fighting platform"
                obj.scale.x *= 0.82
                obj.scale.y *= 0.68
                obj.scale.z *= 0.28
                obj.location.z -= 0.20
            elif "caparison" in low:
                obj.scale.z *= 0.45
                obj.location.z -= 0.12
            elif "elephant forehead paint" in low:
                obj.location.z += 0.02

        cushion = proc._prim_cube("contoured elephant saddle cushion", (0, 0.04, 1.43), (0.34, 0.30, 0.035))
        additions.append((proc._bevel_join_safe(cushion), palette["sash"]))
        for sx in (-1, 1):
            rail = proc._curve_mesh(
                f"low howdah side rail {sx}",
                [(sx * 0.21, -0.12, 1.50), (sx * 0.24, 0.06, 1.55), (sx * 0.21, 0.25, 1.50)],
                0.011,
                "brass",
                mats,
            )
            additions.append((rail, "brass"))
            hanging_cloth = proc._prim_cube(
                f"elephant saddle hanging cloth {sx}",
                (sx * 0.32, 0.04, 1.31),
                (0.026, 0.34, 0.16),
            )
            additions.append((proc._smooth(hanging_cloth, 1), palette["sash"]))
        for y in (-0.16, 0.28):
            strap = proc._curve_mesh(
                f"elephant belly leather strap {y}",
                [(-0.36, y, 1.22), (-0.18, y, 1.08), (0, y, 1.03), (0.18, y, 1.08), (0.36, y, 1.22)],
                0.009,
                "leather_dark",
                mats,
            )
            additions.append((strap, "leather_dark"))

    if mounted_role == "war-chariot":
        for obj, _ in parts:
            low = obj.name.lower()
            if low == "cab":
                obj.name = "carved open chariot cabin"
                obj.scale.y *= 0.78
                obj.scale.z *= 0.55
                obj.location.z -= 0.10
            elif low == "chfront":
                obj.scale.z *= 0.72
                obj.location.z -= 0.04
            elif low == "rail":
                obj.location.z -= 0.03
        for sx in (-1, 1):
            side_panel = proc._prim_cube(
                f"open chariot side lattice {sx}",
                (sx * 0.30, 0.25, 0.66),
                (0.018, 0.34, 0.13),
            )
            additions.append((proc._smooth(side_panel, 1), "brass"))
            low_panel = proc._curve_mesh(
                f"chariot curved waist rail {sx}",
                [(sx * 0.28, 0.00, 0.70), (sx * 0.34, 0.25, 0.76), (sx * 0.28, 0.50, 0.70)],
                0.009,
                "brass",
                mats,
            )
            additions.append((low_panel, "brass"))

    if mounted_role == "horse-archer":
        for sx in (-1, 1):
            saddle_strap = proc._curve_mesh(
                f"horse saddle girth strap {sx}",
                [(sx * 0.22, -0.10, 0.92), (sx * 0.18, 0.08, 0.78), (sx * 0.17, 0.28, 0.70)],
                0.007,
                "leather_dark",
                mats,
            )
            additions.append((saddle_strap, "leather_dark"))

    return parts + additions


def build_mounted_unit(side: str, mounted_role: str) -> bpy.types.Object:
    reset_scene()
    mats = proc.build_all_materials()
    root = bpy.data.objects.new(f"{side}-{mounted_role}-runtime-root", None)
    bpy.context.collection.objects.link(root)

    if mounted_role == "horse-archer":
        mount_parts = proc.build_horse(side, mats, dark=(side == "kaurava"), scale=1.0)
        rider_root, _ = add_rider(side, "foot-archer", mounted_role, loc=(0, 0.02, 0.34), scale=(0.60, 0.60, 0.60))
    elif mounted_role == "war-chariot":
        mount_parts = proc.build_chariot(side, mats)
        mount_parts += proc.build_horse(side, mats, dark=False, scale=0.62, loc=(-0.23, -1.05, 0))
        mount_parts += proc.build_horse(side, mats, dark=True, scale=0.62, loc=(0.23, -1.05, 0))
        rider_root, _ = add_rider(side, "advisor-standard-bearer", mounted_role, loc=(0, 0.23, 0.34), scale=(0.55, 0.55, 0.55))
    else:
        mount_parts = proc.build_elephant(side, mats, scale=1.0)
        rider_root, _ = add_rider(side, "royal-commander", mounted_role, loc=(0, 0.04, 0.92), scale=(0.50, 0.50, 0.50))

    mount_parts = refine_mount_parts(side, mounted_role, mount_parts, mats)
    apply_part_materials(mount_parts, mats)
    for obj in material_objects(mount_parts):
        parent_keep_world(obj, root)
    parent_keep_world(rider_root, root)

    proc.animate_root_clips(root, role=mounted_role, king=False)
    root["required_animations"] = "idle,move,attack,hit"
    root["forward_axis"] = "+Y in Blender, converted by glTF import"
    root["origin_policy"] = "ground centered; rider/driver seated on mount or vehicle"
    root["asset_mix"] = "AGPL3-derived CharMorph/MB-Lab rider plus MIRROR procedural mount/vehicle"
    return root


def export_unit(root: bpy.types.Object, side: str, role: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    filepath = OUT_DIR / f"{side}-{role}.glb"
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format="GLB",
        export_copyright="AGPL3-derived CharMorph/MB-Lab rider plus MIRROR-authored procedural mount/vehicle",
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
    cm.require_charmorph()
    if ONLY:
        side, role = ONLY.split(":", 1)
        root = build_mounted_unit(side, role)
        export_unit(root, side, role)
        return
    for side in SIDES:
        for role in MOUNTED_ROLES:
            root = build_mounted_unit(side, role)
            export_unit(root, side, role)


if __name__ == "__main__":
    main()
