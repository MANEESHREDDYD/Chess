"""Metric helpers built on top of MIRROR feature tables."""

from __future__ import annotations

from typing import Any

from .features import (
    aggregate_analysis_features,
    analysis_quality_features,
    player_summary_features,
    puzzle_motif_features,
)
from .models import MirrorBackupFile


def compute_player_summary(backup: MirrorBackupFile) -> list[dict[str, Any]]:
    """Compute player-level analytics rows."""
    return player_summary_features(backup)


def compute_puzzle_performance(backup: MirrorBackupFile) -> list[dict[str, Any]]:
    """Compute motif-level puzzle performance rows."""
    return puzzle_motif_features(backup)


def compute_analysis_quality(backup: MirrorBackupFile) -> list[dict[str, Any]]:
    """Compute analysis quality rows."""
    return analysis_quality_features(backup)


def compute_player_analysis_rollup(backup: MirrorBackupFile, player_id: str) -> dict[str, Any]:
    """Aggregate analysis quality for one player."""
    analyses = [
        analysis
        for analysis in backup.data.saved_analyses
        if analysis.player_id == player_id and analysis.status == "complete"
    ]
    return aggregate_analysis_features(analyses)
