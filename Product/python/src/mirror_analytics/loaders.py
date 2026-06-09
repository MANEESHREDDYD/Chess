"""Load and validate MIRROR backup JSON files.

The loader reads a raw JSON file, validates the top-level envelope, and
hydrates it into the ``MirrorBackupFile`` dataclass tree so that downstream
modules never handle raw dicts.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import (
    AchievementRecord,
    AnalysisRecord,
    CalibrationRunRecord,
    ClueAttemptRecord,
    LocalMatchRecord,
    MirrorBackupData,
    MirrorBackupFile,
    MirrorMatchRecord,
    PlayerRecord,
    PuzzleReviewRecord,
    StoryProgressRecord,
    StyleVectorRecord,
)

# Keys that *must* exist in a valid backup envelope.
_REQUIRED_ENVELOPE_KEYS = {"schema_version", "app_name", "data"}

# Data arrays expected in exported MIRROR local backup files.
_REQUIRED_DATA_ARRAY_KEYS = {
    "players",
    "local_matches",
    "mirror_matches",
    "style_vectors",
    "saved_analyses",
    "clue_attempts",
    "puzzle_reviews",
    "story_progress",
    "achievements",
}


class BackupValidationError(Exception):
    """Raised when a backup file fails structural validation."""


def load_backup(path: str | Path) -> MirrorBackupFile:
    """Read a MIRROR backup JSON from *path* and return a typed model.

    Raises ``BackupValidationError`` on schema violations and
    ``FileNotFoundError`` / ``json.JSONDecodeError`` on I/O problems.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Backup file not found: {path}")

    raw = json.loads(path.read_text(encoding="utf-8"))
    return parse_backup(raw)


def parse_backup(raw: Any) -> MirrorBackupFile:
    """Parse an already-loaded dict into a ``MirrorBackupFile``.

    This is the *pure* validation / hydration function and can be unit-tested
    without touching the filesystem.
    """
    if not isinstance(raw, dict):
        raise BackupValidationError("Backup must be a JSON object")

    missing_envelope = _REQUIRED_ENVELOPE_KEYS - raw.keys()
    if missing_envelope:
        raise BackupValidationError(f"Missing top-level keys: {missing_envelope}")

    if raw.get("app_name") != "MIRROR":
        raise BackupValidationError(
            f"Expected app_name 'MIRROR', got '{raw.get('app_name')}'"
        )

    data_raw = raw.get("data")
    if not isinstance(data_raw, dict):
        raise BackupValidationError("'data' must be a JSON object")

    missing_arrays = _REQUIRED_DATA_ARRAY_KEYS - data_raw.keys()
    if missing_arrays:
        raise BackupValidationError(f"Missing data array keys: {sorted(missing_arrays)}")

    for key in sorted(_REQUIRED_DATA_ARRAY_KEYS | {"calibration_runs"}):
        if key in data_raw and not isinstance(data_raw[key], list):
            raise BackupValidationError(f"data.{key} must be an array")

    if "settings" in data_raw and not isinstance(data_raw["settings"], dict):
        raise BackupValidationError("data.settings must be an object")

    _validate_record_ids(data_raw)

    data = _hydrate_data(data_raw)

    return MirrorBackupFile(
        schema_version=raw.get("schema_version", 1),
        app_name="MIRROR",
        created_at=raw.get("created_at", ""),
        exported_by=raw.get("exported_by"),
        latest_known_tag=raw.get("latest_known_tag"),
        data=data,
    )


def _hydrate_list(raw_list: Any, factory):  # type: ignore[no-untyped-def]
    """Safely convert a raw JSON list to a list of dataclass instances."""
    if not isinstance(raw_list, list):
        return []
    return [factory(item) for item in raw_list if isinstance(item, dict)]


def _validate_record_ids(data_raw: dict[str, Any]) -> None:
    for key in sorted(_REQUIRED_DATA_ARRAY_KEYS | {"calibration_runs"}):
        rows = data_raw.get(key, [])
        if not isinstance(rows, list):
            continue
        for index, row in enumerate(rows):
            if not isinstance(row, dict):
                raise BackupValidationError(f"data.{key}[{index}] must be an object")
            if not row.get("id"):
                raise BackupValidationError(f"data.{key}[{index}] is missing id")


def _hydrate_data(d: dict[str, Any]) -> MirrorBackupData:
    return MirrorBackupData(
        players=_hydrate_list(d.get("players"), PlayerRecord.from_dict),
        local_matches=_hydrate_list(d.get("local_matches"), LocalMatchRecord.from_dict),
        mirror_matches=_hydrate_list(d.get("mirror_matches"), MirrorMatchRecord.from_dict),
        calibration_runs=_hydrate_list(d.get("calibration_runs"), CalibrationRunRecord.from_dict),
        style_vectors=_hydrate_list(d.get("style_vectors"), StyleVectorRecord.from_dict),
        saved_analyses=_hydrate_list(d.get("saved_analyses"), AnalysisRecord.from_dict),
        clue_attempts=_hydrate_list(d.get("clue_attempts"), ClueAttemptRecord.from_dict),
        puzzle_reviews=_hydrate_list(d.get("puzzle_reviews"), PuzzleReviewRecord.from_dict),
        story_progress=_hydrate_list(d.get("story_progress"), StoryProgressRecord.from_dict),
        achievements=_hydrate_list(d.get("achievements"), AchievementRecord.from_dict),
        settings=d.get("settings", {}),
    )
