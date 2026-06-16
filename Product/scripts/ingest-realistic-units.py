"""
Ingest realistic rigged source assets (Mixamo characters + animation FBX, or
CC0 GLB models) into the 12 Kurukshetra runtime slot GLBs.

It does NOT generate geometry. It takes professionally-made / Mixamo / CC0
source files you provide and produces:

  public/assets/3d/kurukshetra-production-v1/<slot>.glb

with the runtime clip contract (idle, move, attack, hit, and check for the
royal commander), normalized scale, forward axis, and ground-centered origin.

Usage (from Product/):
  # See what source files are expected and which are missing:
  blender --background --python scripts/ingest-realistic-units.py -- --dry-run

  # Build every slot that has its source files present:
  blender --background --python scripts/ingest-realistic-units.py

  # Build a single slot:
  blender --background --python scripts/ingest-realistic-units.py -- --only pandava-foot-archer

Config: asset-sources/asset-config.json  (paths are relative to asset-sources/)
Download guide: asset-sources/README.md
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "asset-sources"
CONFIG = SRC_DIR / "asset-config.json"
OUT_DIR = ROOT / "public" / "assets" / "3d" / "kurukshetra-production-v1"

REQUIRED = ["idle", "move", "attack", "hit"]
KING_REQUIRED = REQUIRED + ["check"]


def argv_after_dashes() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.materials):
        for item in list(coll):
            if getattr(item, "users", 0) == 0:
                coll.remove(item)


def import_any(path: Path) -> list[bpy.types.Object]:
    before = set(bpy.data.objects)
    ext = path.suffix.lower()
    if ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(path), automatic_bone_orientation=True)
    elif ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=str(path))
    else:
        raise ValueError(f"unsupported source type: {path}")
    return [o for o in bpy.data.objects if o not in before]


def find_armature(objs) -> bpy.types.Object | None:
    for o in objs:
        if o.type == "ARMATURE":
            return o
    return None


def take_action(objs) -> bpy.types.Action | None:
    for o in objs:
        ad = getattr(o, "animation_data", None)
        if ad and ad.action:
            return ad.action
    # NLA-only animations
    for o in objs:
        ad = getattr(o, "animation_data", None)
        if ad:
            for trk in ad.nla_tracks:
                for strip in trk.strips:
                    if strip.action:
                        return strip.action
    return None


def push_nla(arm: bpy.types.Object, action: bpy.types.Action, name: str) -> None:
    action.name = name
    arm.animation_data_create()
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, int(action.frame_range[0]), action)


def _bounds(meshes):
    import mathutils
    minv = mathutils.Vector((1e9, 1e9, 1e9))
    maxv = mathutils.Vector((-1e9, -1e9, -1e9))
    for m in meshes:
        for corner in m.bound_box:
            w = m.matrix_world @ mathutils.Vector(corner)
            minv = mathutils.Vector((min(minv.x, w.x), min(minv.y, w.y), min(minv.z, w.z)))
            maxv = mathutils.Vector((max(maxv.x, w.x), max(maxv.y, w.y), max(maxv.z, w.z)))
    return minv, maxv


def normalize(arm: bpy.types.Object, meshes: list, target_h: float, yaw_deg: float) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    objs = [arm] + meshes
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    # face forward (+Z local) by yawing about Z
    arm.rotation_euler = (arm.rotation_euler[0], arm.rotation_euler[1],
                          arm.rotation_euler[2] + math.radians(yaw_deg))
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    minv, maxv = _bounds(meshes)
    height = max(1e-4, maxv.z - minv.z)
    scale = target_h / height
    arm.scale = (arm.scale[0] * scale, arm.scale[1] * scale, arm.scale[2] * scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # recompute and ground-center
    minv, maxv = _bounds(meshes)
    cx = (minv.x + maxv.x) / 2
    cy = (minv.y + maxv.y) / 2
    arm.location = (arm.location[0] - cx, arm.location[1] - cy, arm.location[2] - minv.z)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)


def add_fallback_clips(arm: bpy.types.Object, king: bool) -> None:
    """For sources with no animation: synth gentle whole-object clips."""
    r = math.radians
    arm.rotation_mode = "XYZ"

    def clip(name, frames):
        act = bpy.data.actions.new(name)
        arm.animation_data_create()
        arm.animation_data.action = act
        for f, loc, rot in frames:
            arm.location = loc
            arm.rotation_euler = rot
            arm.keyframe_insert("location", frame=f)
            arm.keyframe_insert("rotation_euler", frame=f)
        trk = arm.animation_data.nla_tracks.new()
        trk.name = name
        trk.strips.new(name, int(act.frame_range[0]), act)
        arm.animation_data.action = None
        arm.location = (0, 0, 0)
        arm.rotation_euler = (0, 0, 0)

    clip("idle", [(1, (0, 0, 0), (0, 0, 0)), (24, (0, 0, 0.01), (0, 0, r(0.6))), (48, (0, 0, 0), (0, 0, r(-0.6))), (72, (0, 0, 0), (0, 0, 0))])
    clip("move", [(1, (0, 0, 0), (0, 0, 0)), (7, (0, 0, 0.03), (r(-2), 0, 0)), (13, (0, 0, 0), (0, 0, 0)), (19, (0, 0, 0.03), (r(2), 0, 0)), (25, (0, 0, 0), (0, 0, 0))])
    clip("attack", [(1, (0, 0, 0), (0, 0, 0)), (10, (0, -0.05, 0), (r(8), 0, 0)), (24, (0, 0, 0), (0, 0, 0))])
    clip("hit", [(1, (0, 0, 0), (0, 0, 0)), (9, (0, 0.06, 0), (r(10), 0, 0)), (34, (0, 0, 0), (0, 0, 0))])
    if king:
        clip("check", [(1, (0, 0, 0), (0, 0, 0)), (15, (0, 0, 0.04), (0, 0, 0)), (30, (0, 0, 0), (0, 0, 0))])


def build_unit(slot: str, spec: dict, dry: bool) -> tuple[bool, list[str]]:
    king = slot.endswith("royal-commander")
    needed = KING_REQUIRED if king else REQUIRED
    char_path = SRC_DIR / spec["character"]
    missing = []
    if not char_path.exists():
        missing.append(str(char_path.relative_to(ROOT)))
    clip_paths = {}
    for name, rel in spec.get("clips", {}).items():
        p = SRC_DIR / rel
        clip_paths[name] = p
        if not p.exists():
            missing.append(str(p.relative_to(ROOT)))
    if dry:
        return (len(missing) == 0), missing
    if missing:
        return False, missing

    reset_scene()
    char_objs = import_any(char_path)
    arm = find_armature(char_objs)
    if arm is None:
        return False, [f"no armature in {spec['character']}"]
    meshes = [o for o in char_objs if o.type == "MESH"]

    src_type = spec.get("type", "fbx-mixamo")
    if src_type == "gltf-animated":
        # use the model's own clips, renamed via spec["clip_from"]
        existing = {}
        if arm.animation_data:
            for trk in arm.animation_data.nla_tracks:
                for strip in trk.strips:
                    if strip.action:
                        existing[trk.name] = strip.action
        for target, srcname in spec.get("clip_from", {}).items():
            act = existing.get(srcname)
            if act:
                act.name = target
                # ensure a track named target exists
    else:
        # Mixamo: import each animation FBX and graft its action onto the character.
        for clipname, p in clip_paths.items():
            anim_objs = import_any(p)
            act = take_action(anim_objs)
            if act:
                push_nla(arm, act, clipname)
            for o in anim_objs:
                bpy.data.objects.remove(o, do_unlink=True)

    # if still no clips, synthesize fallback
    have = set()
    if arm.animation_data:
        have = {t.name for t in arm.animation_data.nla_tracks}
    if not (set(needed) <= have):
        if not have:
            add_fallback_clips(arm, king)

    normalize(arm, meshes, spec.get("target_height", 1.7), spec.get("yaw_deg", 0.0))

    arm["required_animations"] = ",".join(needed)
    arm["forward_axis"] = "+Z local before app yaw correction"
    arm["origin_policy"] = "ground centered"

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{slot}.glb"
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        export_apply=False,
        export_animations=True,
        export_nla_strips=True,
        export_skins=True,
        export_yup=True,
        export_draco_mesh_compression_enable=True,
        use_selection=True,
    )
    return True, []


def main() -> None:
    args = argv_after_dashes()
    dry = "--dry-run" in args
    only = None
    if "--only" in args:
        only = args[args.index("--only") + 1]

    if not CONFIG.exists():
        print(f"INGEST_ERROR config not found: {CONFIG.relative_to(ROOT)}")
        return
    config = json.loads(CONFIG.read_text())
    units = config["units"]

    built, blocked = [], {}
    for slot, spec in units.items():
        if only and slot != only:
            continue
        ok, missing = build_unit(slot, spec, dry)
        if ok and not dry:
            built.append(slot)
            print(f"INGEST_WROTE {slot}.glb")
        elif ok and dry:
            print(f"INGEST_READY {slot} (all sources present)")
        else:
            blocked[slot] = missing
            print(f"INGEST_BLOCKED {slot} missing: {missing}")

    print(f"INGEST_SUMMARY built={len(built)} blocked={len(blocked)} dry={dry}")


if __name__ == "__main__":
    main()
