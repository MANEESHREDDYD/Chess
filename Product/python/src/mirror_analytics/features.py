"""Feature extraction for MIRROR backup analytics.

The functions in this module convert typed backup records into table-shaped
features. They intentionally use transparent heuristics rather than opaque
models so each feature can be inspected and audited.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict
from datetime import date, datetime, timezone
from statistics import mean
from typing import Any, Iterable

from .models import (
    AnalysisRecord,
    ClueAttemptRecord,
    MirrorBackupFile,
    PuzzleReviewRecord,
    StyleVectorRecord,
)


AGGRESSIVE_OPENINGS = {"e4", "c5", "f4", "g4", "b4", "a4", "h4"}


def player_summary_features(backup: MirrorBackupFile) -> list[dict[str, Any]]:
    """Return one analytics row per player."""
    rows: list[dict[str, Any]] = []
    reference = parse_datetime(backup.created_at) or datetime.now(timezone.utc)

    for player in backup.data.players:
        player_id = player.id
        local_matches = [m for m in backup.data.local_matches if m.player_id == player_id]
        mirror_matches = [m for m in backup.data.mirror_matches if m.player_id == player_id]
        analyses = [
            a
            for a in backup.data.saved_analyses
            if a.player_id == player_id and a.status == "complete"
        ]
        clue_attempts = [a for a in backup.data.clue_attempts if a.player_id == player_id]
        puzzle_reviews = [r for r in backup.data.puzzle_reviews if r.player_id == player_id]
        story_progress = [s for s in backup.data.story_progress if s.player_id == player_id]
        achievements = [a for a in backup.data.achievements if a.player_id == player_id]
        style_features = latest_style_vector_features(backup, player_id)

        active_dates = sorted(
            {
                active_date
                for active_date in activity_dates_for_player(backup, player_id)
                if active_date is not None
            }
        )

        total_clues = len(clue_attempts)
        solved_clues = sum(1 for attempt in clue_attempts if attempt.solved)
        multi_attempts = [attempt for attempt in clue_attempts if is_multi_move_attempt(attempt)]
        solved_multi = sum(1 for attempt in multi_attempts if attempt.solved)
        due_reviews = [
            review
            for review in puzzle_reviews
            if (parse_datetime(review.next_due_at) or datetime.max.replace(tzinfo=timezone.utc))
            <= reference
        ]

        analysis_quality = aggregate_analysis_features(analyses)

        row: dict[str, Any] = {
            "player_id": player_id,
            "display_name": player.display_name,
            "total_games": len(local_matches) + len(mirror_matches),
            "local_matches": len(local_matches),
            "mirror_matches": len(mirror_matches),
            "analyses_completed": len(analyses),
            "story_chapters_completed": sum(1 for s in story_progress if s.status == "complete"),
            "story_chapters_available": sum(1 for s in story_progress if s.status == "available"),
            "clue_attempts": total_clues,
            "clue_solve_rate": safe_rate(solved_clues, total_clues),
            "multi_move_solve_rate": safe_rate(solved_multi, len(multi_attempts)),
            "review_due_count": len(due_reviews),
            "achievement_count": len(achievements),
            "active_days": len(active_dates),
            "streak_estimate_days": estimate_streak_days(active_dates),
            "average_cp_loss": analysis_quality["average_cp_loss"],
            "blunder_count": analysis_quality["blunder_count"],
            "mistake_count": analysis_quality["mistake_count"],
            "accuracy_estimate": analysis_quality["accuracy_estimate"],
            "analysis_improvement_trend": analysis_quality["improvement_trend"],
            **style_features,
        }
        rows.append(row)

    return rows


def puzzle_motif_features(backup: MirrorBackupFile) -> list[dict[str, Any]]:
    """Return per-player, per-motif puzzle performance features."""
    grouped_attempts: dict[tuple[str, str], list[ClueAttemptRecord]] = defaultdict(list)
    grouped_reviews: dict[tuple[str, str], list[PuzzleReviewRecord]] = defaultdict(list)
    reference = parse_datetime(backup.created_at) or datetime.now(timezone.utc)

    for attempt in backup.data.clue_attempts:
        grouped_attempts[(attempt.player_id, attempt.motif or "unknown")].append(attempt)

    for review in backup.data.puzzle_reviews:
        grouped_reviews[(review.player_id, review.motif or "unknown")].append(review)

    keys = sorted(set(grouped_attempts) | set(grouped_reviews))
    rows: list[dict[str, Any]] = []

    for player_id, motif in keys:
        attempts = grouped_attempts.get((player_id, motif), [])
        reviews = grouped_reviews.get((player_id, motif), [])
        solved_count = sum(1 for attempt in attempts if attempt.solved)
        failed_count = len(attempts) - solved_count
        multi_attempts = [attempt for attempt in attempts if is_multi_move_attempt(attempt)]
        multi_failed = sum(1 for attempt in multi_attempts if not attempt.solved)
        due_count = sum(
            1
            for review in reviews
            if (parse_datetime(review.next_due_at) or datetime.max.replace(tzinfo=timezone.utc))
            <= reference
        )
        rows.append(
            {
                "player_id": player_id,
                "motif": motif,
                "attempts": len(attempts),
                "solved_count": solved_count,
                "failed_motif_count": failed_count,
                "solved_rate": safe_rate(solved_count, len(attempts)),
                "review_lapse_count": sum(review.lapses for review in reviews),
                "review_due_count": due_count,
                "multi_move_attempts": len(multi_attempts),
                "multi_move_failure_rate": safe_rate(multi_failed, len(multi_attempts)),
                "weakest_motif": "",
                "strongest_motif": "",
            }
        )

    for player_id in {row["player_id"] for row in rows}:
        player_rows = [row for row in rows if row["player_id"] == player_id]
        weakest = weakest_motif(player_rows)
        strongest = strongest_motif(player_rows)
        for row in player_rows:
            row["weakest_motif"] = weakest
            row["strongest_motif"] = strongest

    return rows


def story_progress_features(backup: MirrorBackupFile) -> list[dict[str, Any]]:
    """Return story progression rows suitable for SQL marts or CSV output."""
    rows: list[dict[str, Any]] = []
    for story in sorted(
        backup.data.story_progress,
        key=lambda s: (s.player_id, s.chapter_id, s.updated_at),
    ):
        rows.append(
            {
                "player_id": story.player_id,
                "chapter_id": story.chapter_id,
                "status": story.status,
                "best_result": story.best_result or "",
                "attempts": story.attempts,
                "completed_at": story.completed_at or "",
                "updated_at": story.updated_at,
                "is_complete": story.status == "complete",
            }
        )
    return rows


def analysis_quality_features(backup: MirrorBackupFile) -> list[dict[str, Any]]:
    """Return one row per completed analysis with trend features."""
    analyses = [
        analysis
        for analysis in backup.data.saved_analyses
        if analysis.status == "complete"
    ]
    analyses.sort(key=lambda analysis: analysis.created_at)
    by_player: dict[str, list[AnalysisRecord]] = defaultdict(list)
    for analysis in analyses:
        by_player[analysis.player_id].append(analysis)

    rows: list[dict[str, Any]] = []
    for player_id, player_analyses in by_player.items():
        previous_cp_loss: float | None = None
        player_trend = aggregate_analysis_features(player_analyses)["improvement_trend"]
        for analysis in player_analyses:
            avg_cp_loss = analysis_average_cp_loss(analysis)
            trend_delta = (
                round(avg_cp_loss - previous_cp_loss, 4)
                if previous_cp_loss is not None
                else 0.0
            )
            rows.append(
                {
                    "player_id": player_id,
                    "analysis_id": analysis.id,
                    "match_id": analysis.match_id,
                    "match_type": analysis.match_type,
                    "created_at": analysis.created_at,
                    "average_cp_loss": round(avg_cp_loss, 4),
                    "accuracy_estimate": round(analysis_accuracy_estimate(analysis), 4),
                    "blunder_count": analysis_blunder_count(analysis),
                    "mistake_count": analysis_mistake_count(analysis),
                    "inaccuracy_count": analysis_inaccuracy_count(analysis),
                    "analyzed_moves": analysis.summary.analyzed_moves or len(analysis.moves),
                    "cp_loss_trend_vs_previous": trend_delta,
                    "improvement_trend": player_trend,
                }
            )
            previous_cp_loss = avg_cp_loss
    return rows


def latest_style_vector_features(
    backup: MirrorBackupFile,
    player_id: str,
) -> dict[str, Any]:
    """Derive interpretable features from the latest StyleVector for a player."""
    record = latest_style_vector_record(backup, player_id)
    if record is None:
        return {
            "style_vector_id": "",
            "aggression_index": 0.0,
            "risk_index": 0.0,
            "time_pressure_risk": 0.0,
            "tactical_weakness_summary": "No StyleVector available",
            "positional_preference_summary": "No StyleVector available",
            "detected_elo": 0,
            "elo_band": "",
        }

    vector = record.vector
    all_openings = vector.opening_white_top3 + vector.opening_black_top3
    opening_aggression = safe_rate(
        sum(1 for move in all_openings if move in AGGRESSIVE_OPENINGS),
        len(all_openings),
    )
    swindle_risk = 1.0 if vector.swindle_preference == "swindle" else 0.0
    max_motif_blindness = max(vector.motif_blindness.values(), default=0.0)

    aggression_index = clamp01(
        mean([vector.exchange_willingness, opening_aggression, swindle_risk])
    )
    risk_index = clamp01(
        mean(
            [
                vector.time_pressure_blunder_rate,
                max_motif_blindness,
                1.0 - vector.endgame_strength,
                swindle_risk,
            ]
        )
    )

    weakest = strongest_key(vector.motif_blindness)
    weakest_value = vector.motif_blindness.get(weakest, 0.0) if weakest else 0.0
    white_openings = ", ".join(vector.opening_white_top3) or "none recorded"
    black_openings = ", ".join(vector.opening_black_top3) or "none recorded"

    return {
        "style_vector_id": record.id,
        "aggression_index": round(aggression_index, 4),
        "risk_index": round(risk_index, 4),
        "time_pressure_risk": round(clamp01(vector.time_pressure_blunder_rate), 4),
        "tactical_weakness_summary": (
            f"{weakest}: {weakest_value:.2f}" if weakest else "No motif blindness recorded"
        ),
        "positional_preference_summary": (
            f"Prefers {vector.preferred_minor}; white openings: {white_openings}; "
            f"black replies: {black_openings}; endgame strength: {vector.endgame_strength:.2f}"
        ),
        "detected_elo": vector.detected_elo,
        "elo_band": vector.elo_band,
    }


def aggregate_analysis_features(analyses: Iterable[AnalysisRecord]) -> dict[str, Any]:
    """Aggregate completed analysis records into player-level quality metrics."""
    sorted_analyses = sorted(analyses, key=lambda analysis: analysis.created_at)
    if not sorted_analyses:
        return {
            "average_cp_loss": 0.0,
            "accuracy_estimate": 0.0,
            "blunder_count": 0,
            "mistake_count": 0,
            "improvement_trend": "insufficient_data",
        }

    cp_losses = [analysis_average_cp_loss(analysis) for analysis in sorted_analyses]
    accuracies = [analysis_accuracy_estimate(analysis) for analysis in sorted_analyses]
    halfway = max(1, len(cp_losses) // 2)
    early = mean(cp_losses[:halfway])
    late = mean(cp_losses[halfway:]) if cp_losses[halfway:] else early
    delta = late - early

    if len(cp_losses) < 2:
        trend = "insufficient_data"
    elif delta <= -5:
        trend = "improving"
    elif delta >= 5:
        trend = "regressing"
    else:
        trend = "stable"

    return {
        "average_cp_loss": round(mean(cp_losses), 4),
        "accuracy_estimate": round(mean(accuracies), 4),
        "blunder_count": sum(analysis_blunder_count(analysis) for analysis in sorted_analyses),
        "mistake_count": sum(analysis_mistake_count(analysis) for analysis in sorted_analyses),
        "improvement_trend": trend,
    }


def backup_feature_bundle(backup: MirrorBackupFile) -> dict[str, Any]:
    """Return all engineered features as a JSON-serializable bundle."""
    return {
        "metadata": {
            "schema_version": backup.schema_version,
            "app_name": backup.app_name,
            "created_at": backup.created_at,
            "latest_known_tag": backup.latest_known_tag or "",
        },
        "player_summary": player_summary_features(backup),
        "puzzle_performance": puzzle_motif_features(backup),
        "story_progress": story_progress_features(backup),
        "analysis_quality": analysis_quality_features(backup),
        "style_vectors": [
            {"id": row.id, "player_id": row.player_id, "source": row.source, "vector": asdict(row.vector)}
            for row in backup.data.style_vectors
        ],
    }


def latest_style_vector_record(
    backup: MirrorBackupFile,
    player_id: str,
) -> StyleVectorRecord | None:
    player = next((p for p in backup.data.players if p.id == player_id), None)
    rows = [row for row in backup.data.style_vectors if row.player_id == player_id]
    if not rows:
        return None
    if player and player.current_style_vector_id:
        current = next((row for row in rows if row.id == player.current_style_vector_id), None)
        if current is not None:
            return current
    rows.sort(key=lambda row: row.computed_at)
    return rows[-1]


def activity_dates_for_player(
    backup: MirrorBackupFile,
    player_id: str,
) -> Iterable[date | None]:
    for match in backup.data.local_matches:
        if match.player_id == player_id:
            yield date_part(match.completed_at or match.created_at)
    for match in backup.data.mirror_matches:
        if match.player_id == player_id:
            yield date_part(match.completed_at or match.started_at)
    for analysis in backup.data.saved_analyses:
        if analysis.player_id == player_id:
            yield date_part(analysis.completed_at or analysis.created_at)
    for attempt in backup.data.clue_attempts:
        if attempt.player_id == player_id:
            yield date_part(attempt.completed_at or attempt.started_at or attempt.created_at)
    for story in backup.data.story_progress:
        if story.player_id == player_id:
            yield date_part(story.completed_at or story.updated_at)
    for achievement in backup.data.achievements:
        if achievement.player_id == player_id:
            yield date_part(achievement.earned_at)
    for style_vector in backup.data.style_vectors:
        if style_vector.player_id == player_id:
            yield date_part(style_vector.computed_at)


def analysis_average_cp_loss(analysis: AnalysisRecord) -> float:
    if analysis.summary.average_cp_loss:
        return float(analysis.summary.average_cp_loss)
    losses = [move.cp_loss for move in analysis.moves if move.cp_loss is not None]
    return float(mean(losses)) if losses else 0.0


def analysis_accuracy_estimate(analysis: AnalysisRecord) -> float:
    if analysis.summary.accuracy_estimate is not None:
        return float(analysis.summary.accuracy_estimate)
    return round(clamp(100.0 - analysis_average_cp_loss(analysis) * 0.45, 0.0, 100.0), 4)


def analysis_blunder_count(analysis: AnalysisRecord) -> int:
    return analysis.summary.blunder_count or sum(
        1 for move in analysis.moves if move.classification == "blunder"
    )


def analysis_mistake_count(analysis: AnalysisRecord) -> int:
    return analysis.summary.mistake_count or sum(
        1 for move in analysis.moves if move.classification == "mistake"
    )


def analysis_inaccuracy_count(analysis: AnalysisRecord) -> int:
    return analysis.summary.inaccuracy_count or sum(
        1 for move in analysis.moves if move.classification == "inaccuracy"
    )


def is_multi_move_attempt(attempt: ClueAttemptRecord) -> bool:
    if attempt.total_steps is not None:
        return attempt.total_steps > 1
    return len(attempt.solution_moves) > 1


def weakest_motif(rows: list[dict[str, Any]]) -> str:
    candidates = [row for row in rows if row["attempts"] > 0 or row["review_lapse_count"] > 0]
    if not candidates:
        return ""
    candidates.sort(
        key=lambda row: (
            row["solved_rate"],
            -row["failed_motif_count"],
            -row["review_lapse_count"],
            row["motif"],
        )
    )
    return str(candidates[0]["motif"])


def strongest_motif(rows: list[dict[str, Any]]) -> str:
    candidates = [row for row in rows if row["attempts"] > 0]
    if not candidates:
        return ""
    candidates.sort(
        key=lambda row: (
            -row["solved_rate"],
            -row["solved_count"],
            -row["attempts"],
            row["motif"],
        )
    )
    return str(candidates[0]["motif"])


def motif_attempt_counts(attempts: Iterable[ClueAttemptRecord]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for attempt in attempts:
        counts[attempt.motif or "unknown"] += 1
    return counts


def strongest_key(values: dict[str, float]) -> str:
    if not values:
        return ""
    return max(values.items(), key=lambda item: (item[1], item[0]))[0]


def estimate_streak_days(active_dates: list[date]) -> int:
    if not active_dates:
        return 0
    streak = 1
    current = active_dates[-1]
    active_set = set(active_dates)
    while True:
        ordinal = current.toordinal() - 1
        next_date = date.fromordinal(ordinal)
        if next_date not in active_set:
            return streak
        streak += 1
        current = next_date


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


def date_part(value: str | None) -> date | None:
    parsed = parse_datetime(value)
    return parsed.date() if parsed else None


def safe_rate(numerator: int | float, denominator: int | float) -> float:
    if not denominator:
        return 0.0
    return round(float(numerator) / float(denominator), 4)


def clamp01(value: float) -> float:
    return clamp(value, 0.0, 1.0)


def clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))
