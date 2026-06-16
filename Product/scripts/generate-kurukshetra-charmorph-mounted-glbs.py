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


def parent_keep_world(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = matrix


def set_object_tree_transform(obj: bpy.types.Object, *, loc, scale, rot=(0, 0, 0)) -> None:
    obj.location = loc
    obj.scale = scale
    obj.rotation_euler = rot


def add_rider(side: str, role: str, mounted_role: str, *, loc, scale, rot=(0, 0, 0)) -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    arm, body, fitted_assets = cm.import_charmorph_body(side, role)
    extras = cm.add_body_overlays(side, role, arm)
    extras += add_mounted_weapon_details(side, role, mounted_role)
    for obj in extras:
        parent_keep_world(obj, arm)

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


def add_mounted_weapon_details(side: str, role: str, mounted_role: str) -> list[bpy.types.Object]:
    cloth = "cloth indigo" if side == "pandava" else "cloth wine"
    out: list[bpy.types.Object] = []
    if mounted_role == "horse-archer":
        out.append(cm.curve("mounted bow near left hand", [(-0.32, -0.2, 0.9), (-0.47, -0.26, 1.18), (-0.3, -0.22, 1.45)], 0.011, "wood"))
        out.append(cm.curve("mounted bow string", [(-0.32, -0.2, 0.9), (-0.20, -0.24, 1.18), (-0.3, -0.22, 1.45)], 0.003, "steel"))
        out.append(cm.cyl_between("mounted drawn arrow shaft", (0.18, -0.24, 1.16), (-0.48, -0.28, 1.2), 0.005, "wood", 8))
        head = cm.cone("mounted drawn arrow head", (-0.52, -0.285, 1.2), 0.015, 0, 0.05, "steel", 10)
        head.rotation_euler = (math.radians(88), 0, math.radians(78))
        out.append(head)
        quiver = cm.cone("mounted rear quiver", (0.14, 0.11, 1.18), 0.045, 0.038, 0.34, "dark leather", 16)
        quiver.rotation_euler = (math.radians(16), 0, math.radians(-12))
        out.append(quiver)
        for i in range(6):
            out.append(cm.cyl_between(f"mounted quiver arrow {i}", (0.08 + i * 0.012, 0.13, 1.32), (0.1 + i * 0.012, 0.16, 1.55), 0.004, "wood", 6))
    elif mounted_role == "war-chariot":
        for sx in (-1, 1):
            out.append(cm.curve(f"driver hand rein {sx}", [(sx * 0.12, -0.18, 0.98), (sx * 0.18, -0.58, 0.76), (sx * 0.24, -1.12, 0.68)], 0.006, "dark leather"))
        out.append(cm.cyl_between("driver short spear", (0.32, -0.14, 0.72), (0.44, -0.16, 1.54), 0.012, "wood", 10))
        spear = cm.cone("driver short spear head", (0.455, -0.162, 1.6), 0.035, 0, 0.12, "steel", 12)
        spear.rotation_euler = (math.radians(8), 0, math.radians(-8))
        out.append(spear)
    else:
        out.append(cm.cyl_between("elephant commander sword blade", (0.36, -0.2, 0.92), (0.54, -0.24, 1.5), 0.016, "steel", 8))
        out.append(cm.cyl_between("elephant commander sword grip", (0.32, -0.18, 0.78), (0.37, -0.2, 0.94), 0.014, "wood", 8))
        shield = cm.cone("elephant commander shield", (-0.38, -0.2, 1.08), 0.15, 0.15, 0.035, "bronze", 36)
        shield.rotation_euler = (math.radians(90), 0, 0)
        out.append(shield)
        banner = cm.cube("small howdah banner cloth", (-0.24, 0.16, 1.38), (0.12, 0.008, 0.19), cloth, 0.003)
        out.append(banner)
    return out


def create_mounted_rider_clips(arm: bpy.types.Object, mounted_role: str) -> None:
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 72
    r = math.radians
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"

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
        base = {
            **seated,
            "upper_arm.L": (r(-16), r(-6), r(72)),
            "forearm.L": (r(-4), r(0), r(-12)),
            "hand.L": (r(0), r(0), r(8)),
            "upper_arm.R": (r(-24), r(2), r(-62)),
            "forearm.R": (r(-42), r(0), r(4)),
            "hand.R": (r(0), r(0), r(-8)),
            "spine.004": (r(-1), r(0), r(-6)),
        }
    elif mounted_role == "war-chariot":
        base = {
            **seated,
            "upper_arm.L": (r(-20), r(4), r(36)),
            "forearm.L": (r(-28), r(0), r(0)),
            "upper_arm.R": (r(-12), r(-2), r(-34)),
            "forearm.R": (r(-24), r(0), r(0)),
            "spine.004": (r(1), r(0), r(0)),
        }
    else:
        base = {
            **seated,
            "upper_arm.L": (r(-22), r(2), r(34)),
            "forearm.L": (r(-22), r(0), r(0)),
            "upper_arm.R": (r(-42), r(0), r(-22)),
            "forearm.R": (r(-28), r(0), r(0)),
            "spine.004": (r(-2), r(0), r(-4)),
        }

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


def build_mounted_unit(side: str, mounted_role: str) -> bpy.types.Object:
    reset_scene()
    mats = proc.build_all_materials()
    root = bpy.data.objects.new(f"{side}-{mounted_role}-runtime-root", None)
    bpy.context.collection.objects.link(root)

    if mounted_role == "horse-archer":
        mount_parts = proc.build_horse(side, mats, dark=(side == "kaurava"), scale=1.0)
        rider_root, _ = add_rider(side, "foot-archer", mounted_role, loc=(0, 0.03, 0.38), scale=(0.62, 0.62, 0.62))
    elif mounted_role == "war-chariot":
        mount_parts = proc.build_chariot(side, mats)
        mount_parts += proc.build_horse(side, mats, dark=False, scale=0.62, loc=(-0.23, -1.05, 0))
        mount_parts += proc.build_horse(side, mats, dark=True, scale=0.62, loc=(0.23, -1.05, 0))
        rider_root, _ = add_rider(side, "advisor-standard-bearer", mounted_role, loc=(0, 0.26, 0.46), scale=(0.58, 0.58, 0.58))
    else:
        mount_parts = proc.build_elephant(side, mats, scale=1.0)
        rider_root, _ = add_rider(side, "royal-commander", mounted_role, loc=(0, 0.08, 1.08), scale=(0.54, 0.54, 0.54))

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
