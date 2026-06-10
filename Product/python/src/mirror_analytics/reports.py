"""CSV, JSON, and Markdown report generation for MIRROR analytics."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from .features import backup_feature_bundle
from .models import MirrorBackupFile


def generate_reports(backup: MirrorBackupFile, out_dir: str | Path) -> dict[str, Path]:
    """Generate all analytics outputs and return their paths."""
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    bundle = backup_feature_bundle(backup)

    outputs = {
        "player_summary": out_path / "player_summary.csv",
        "puzzle_performance": out_path / "puzzle_performance.csv",
        "story_progress": out_path / "story_progress.csv",
        "analysis_quality": out_path / "analysis_quality.csv",
        "mirror_insights": out_path / "mirror_insights.md",
        "mirror_features": out_path / "mirror_features.json",
    }

    write_csv(outputs["player_summary"], bundle["player_summary"])
    write_csv(outputs["puzzle_performance"], bundle["puzzle_performance"])
    write_csv(outputs["story_progress"], bundle["story_progress"])
    write_csv(outputs["analysis_quality"], bundle["analysis_quality"])
    outputs["mirror_features"].write_text(
        json.dumps(bundle, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    outputs["mirror_insights"].write_text(
        render_markdown_insights(bundle),
        encoding="utf-8",
    )
    return outputs


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    """Write table rows as CSV."""
    fieldnames = list(rows[0].keys()) if rows else []
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        if fieldnames:
            writer.writeheader()
            writer.writerows(rows)


def render_markdown_insights(bundle: dict[str, Any]) -> str:
    """Render a human-readable analytics summary."""
    player_rows = bundle["player_summary"]
    puzzle_rows = bundle["puzzle_performance"]
    story_rows = bundle["story_progress"]
    analysis_rows = bundle["analysis_quality"]

    lines = [
        "# MIRROR Analytics Insights",
        "",
        "Generated from an exported MIRROR backup JSON file. This is a local-first analytics report, not runtime GenAI coaching.",
        "",
    ]

    if not player_rows:
        lines.extend(["## Player Progress Summary", "", "No players found in this backup.", ""])
        return "\n".join(lines)

    for player in player_rows:
        player_id = player["player_id"]
        display_name = player.get("display_name") or player_id
        player_puzzles = [row for row in puzzle_rows if row["player_id"] == player_id]
        player_story = [row for row in story_rows if row["player_id"] == player_id]
        player_analysis = [row for row in analysis_rows if row["player_id"] == player_id]
        weakest = player_puzzles[0]["weakest_motif"] if player_puzzles else ""
        strongest = player_puzzles[0]["strongest_motif"] if player_puzzles else ""
        due_motifs = [
            row["motif"]
            for row in sorted(
                player_puzzles,
                key=lambda row: (-row["review_due_count"], row["solved_rate"], row["motif"]),
            )
            if row["review_due_count"] > 0
        ]

        lines.extend(
            [
                "## Player Progress Summary",
                "",
                f"Player: {display_name} ({player_id})",
                "",
                f"- Total games: {player['total_games']} ({player['mirror_matches']} Mirror matches)",
                f"- Imported games: {player.get('imported_games_count', 0)} ({player.get('valid_imported_games', 0)} valid)",
                f"- Imported-game analysis coverage: {as_percent(player.get('imported_game_analysis_coverage', 0))}",
                f"- Analyses completed: {player['analyses_completed']}",
                f"- Game Review Pro records: {player.get('reviewed_games_count', 0)}",
                f"- Clue solve rate: {as_percent(player['clue_solve_rate'])}",
                f"- Multi-move solve rate: {as_percent(player['multi_move_solve_rate'])}",
                f"- Active days: {player['active_days']} with an estimated {player['streak_estimate_days']}-day current streak",
                f"- Achievements earned: {player['achievement_count']}",
                f"- Import sources: {player.get('imported_source_breakdown') or 'none'}",
                "",
                "## Weakest Motifs",
                "",
                f"- Weakest motif: {weakest or 'Not enough puzzle data'}",
                f"- Strongest motif: {strongest or 'Not enough puzzle data'}",
            ]
        )

        for row in player_puzzles:
            lines.append(
                f"- {row['motif']}: {as_percent(row['solved_rate'])} solved, "
                f"{row['failed_motif_count']} failed attempts, {row['review_lapse_count']} review lapses"
            )

        review_text = ", ".join(due_motifs[:3]) if due_motifs else "No reviews due"
        lines.extend(
            [
                "",
                "## Puzzle Review Recommendations",
                "",
                f"- Due review motifs: {review_text}",
                f"- Review due count: {player['review_due_count']}",
                "",
                "## Analysis Quality Summary",
                "",
                f"- Average CP loss: {player['average_cp_loss']}",
                f"- Accuracy estimate: {player['accuracy_estimate']}",
                f"- Blunders: {player['blunder_count']}",
                f"- Mistakes: {player['mistake_count']}",
                f"- Improvement trend: {player['analysis_improvement_trend']}",
                f"- Review average CP loss: {player.get('review_average_cp_loss', 0)}",
                f"- Review blunders: {player.get('review_blunder_count', 0)}",
                f"- Review mistakes: {player.get('review_mistake_count', 0)}",
                f"- Review weakest phase: {player.get('review_phase_weakness_summary', 'insufficient_data')}",
                f"- Most common review label: {player.get('review_most_common_classification', 'insufficient_data')}",
            ]
        )

        stockfish_analysis = [
            row for row in player_analysis if row.get("improvement_trend") != "game_review_record"
        ]
        if stockfish_analysis:
            latest = stockfish_analysis[-1]
            lines.append(
                f"- Latest analysis CP loss delta vs previous: {latest['cp_loss_trend_vs_previous']}"
            )

        completed_story = sum(1 for row in player_story if row["is_complete"])
        available_story = sum(1 for row in player_story if row["status"] == "available")
        lines.extend(
            [
                "",
                "## Story Progress",
                "",
                f"- Completed chapters: {completed_story}",
                f"- Available chapters: {available_story}",
                "",
                "## StyleVector Feature Summary",
                "",
                f"- Aggression index: {player['aggression_index']}",
                f"- Risk index: {player['risk_index']}",
                f"- Time-pressure risk: {player['time_pressure_risk']}",
                f"- Tactical weakness: {player['tactical_weakness_summary']}",
                f"- Positional preference: {player['positional_preference_summary']}",
                "",
                "## Next Training Recommendation",
                "",
                f"- {next_training_recommendation(player, weakest, due_motifs)}",
                "",
            ]
        )

    return "\n".join(lines).rstrip() + "\n"


def next_training_recommendation(
    player: dict[str, Any],
    weakest_motif: str,
    due_motifs: list[str],
) -> str:
    """Choose a transparent next action from engineered features."""
    if due_motifs:
        return f"Clear due spaced-repetition reviews first, starting with {due_motifs[0]}."
    if weakest_motif:
        return f"Run a focused clue set on {weakest_motif}, then analyze one fresh game."
    if player["analyses_completed"] == 0:
        return "Analyze one completed game to seed CP-loss and accuracy features."
    if player["mirror_matches"] == 0:
        return "Play one Mirror match so StyleVector behavior can be compared against real games."
    return "Play one game, analyze it, and repeat the motif with the lowest solve rate."


def as_percent(value: float) -> str:
    return f"{value * 100:.1f}%"
