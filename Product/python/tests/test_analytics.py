from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from mirror_analytics.cli import main as cli_main
from mirror_analytics.features import (
    aggregate_analysis_features,
    latest_style_vector_features,
    player_summary_features,
    puzzle_motif_features,
)
from mirror_analytics.loaders import BackupValidationError, load_backup, parse_backup
from mirror_analytics.reports import generate_reports, render_markdown_insights


PRODUCT_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_BACKUP = PRODUCT_ROOT / "samples" / "anonymized-mirror-backup.sample.json"


@pytest.fixture
def backup():
    return load_backup(SAMPLE_BACKUP)


def test_backup_loading_parses_core_stores(backup):
    assert backup.app_name == "MIRROR"
    assert backup.data.players[0].id == "player-sample-001"
    assert len(backup.data.local_matches) == 8
    assert len(backup.data.mirror_matches) == 3
    assert len(backup.data.imported_games) == 2
    assert len(backup.data.saved_analyses) == 4
    assert len(backup.data.game_reviews) == 1
    assert len(backup.data.clue_attempts) == 10
    assert len(backup.data.clue_memory) == 3
    assert len(backup.data.puzzle_reviews) == 3
    assert len(backup.data.story_progress) == 5
    assert len(backup.data.achievements) == 5
    assert len(backup.data.style_vectors) == 2


def test_schema_validation_rejects_malformed_backup():
    raw = {
        "schema_version": 1,
        "app_name": "MIRROR",
        "data": {
            "players": [{"id": "player-1"}],
            "local_matches": [],
            "mirror_matches": [],
            "style_vectors": [],
            "saved_analyses": [],
            "clue_attempts": {"bad": "not an array"},
            "puzzle_reviews": [],
            "story_progress": [],
            "achievements": [],
        },
    }

    with pytest.raises(BackupValidationError, match="data.clue_attempts must be an array"):
        parse_backup(raw)


def test_player_summary_metrics(backup):
    row = player_summary_features(backup)[0]

    assert row["total_games"] == 12
    assert row["mirror_matches"] == 3
    assert row["imported_games_count"] == 2
    assert row["valid_imported_games"] == 1
    assert row["imported_source_breakdown"] == "lichess_pgn:1; manual_pgn:1"
    assert row["imported_result_summary"] == "1-0:2"
    assert row["imported_game_analysis_coverage"] == 1.0
    assert row["analyses_completed"] == 4
    assert row["reviewed_games_count"] == 1
    assert row["review_average_cp_loss"] == 23
    assert row["review_blunder_count"] == 0
    assert row["review_mistake_count"] == 0
    assert row["review_phase_weakness_summary"] == "opening"
    assert row["review_most_common_classification"] == "best"
    assert row["story_chapters_completed"] == 4
    assert row["clue_attempts"] == 10
    assert row["most_used_clue_level"] == "2"
    assert row["solved_without_reveal_rate"] > 0
    assert row["final_reveal_rate"] > 0
    assert row["review_mode_success_rate"] == 0
    assert row["best_clue_streak"] >= 2
    assert row["boss_completion_count"] == 0
    assert row["clue_solve_rate"] == 0.5
    assert row["multi_move_solve_rate"] == 1.0
    assert row["review_due_count"] == 3
    assert row["achievement_count"] == 5


def test_puzzle_solved_rate_and_weakest_motif_detection(backup):
    rows = {row["motif"]: row for row in puzzle_motif_features(backup)}

    assert rows["fork"]["solved_rate"] == 1.0
    assert rows["pin"]["solved_rate"] == 0.0
    assert rows["pin"]["failed_motif_count"] == 3
    assert rows["pin"]["weakest_motif"] == "pin"
    assert rows["fork"]["strongest_motif"] == "fork"
    assert rows["pin"]["most_used_clue_level"] in {"2", "3"}
    assert rows["pin"]["final_reveal_rate"] > 0


def test_cp_loss_aggregation(backup):
    rollup = aggregate_analysis_features(backup.data.saved_analyses)

    assert rollup["average_cp_loss"] == pytest.approx(39.0, abs=0.0001)
    assert rollup["accuracy_estimate"] == pytest.approx(80.675, abs=0.0001)
    assert rollup["blunder_count"] == 1
    assert rollup["mistake_count"] == 2
    assert rollup["improvement_trend"] == "regressing"


def test_style_vector_feature_extraction(backup):
    features = latest_style_vector_features(backup, "player-sample-001")

    assert features["style_vector_id"] == "sv-sample-002"
    assert features["detected_elo"] == 1350
    assert features["elo_band"] == "initiate"
    assert features["time_pressure_risk"] == 0.28
    assert features["tactical_weakness_summary"].startswith("pin:")
    assert "Prefers knight" in features["positional_preference_summary"]


def test_report_generation(backup, tmp_path):
    outputs = generate_reports(backup, tmp_path)

    for path in outputs.values():
        assert path.exists()

    insights = outputs["mirror_insights"].read_text(encoding="utf-8")
    assert "Player Progress Summary" in insights
    assert "Weakest motif: pin" in insights
    assert "Imported games: 2 (1 valid)" in insights
    assert "Game Review Pro records: 1" in insights
    assert "Review weakest phase: opening" in insights
    assert "Next Training Recommendation" in insights

    features = json.loads(outputs["mirror_features"].read_text(encoding="utf-8"))
    assert features["player_summary"][0]["player_id"] == "player-sample-001"


def test_render_markdown_insights_has_required_sections(backup):
    outputs = {
        "metadata": {},
        "player_summary": player_summary_features(backup),
        "puzzle_performance": puzzle_motif_features(backup),
        "story_progress": [],
        "analysis_quality": [],
    }
    markdown = render_markdown_insights(outputs)

    assert "## Puzzle Review Recommendations" in markdown
    assert "## Analysis Quality Summary" in markdown
    assert "## Story Progress" in markdown


def test_cli_output_creation(tmp_path):
    exit_code = cli_main(["--backup", str(SAMPLE_BACKUP), "--out", str(tmp_path)])

    assert exit_code == 0
    expected = {
        "player_summary.csv",
        "puzzle_performance.csv",
        "story_progress.csv",
        "analysis_quality.csv",
        "mirror_insights.md",
        "mirror_features.json",
    }
    assert expected == {path.name for path in tmp_path.iterdir()}

    with (tmp_path / "player_summary.csv").open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    assert rows[0]["player_id"] == "player-sample-001"
    assert rows[0]["imported_games_count"] == "2"
    assert rows[0]["reviewed_games_count"] == "1"


def test_sql_files_include_imported_games_fields():
    schema = (PRODUCT_ROOT / "analytics" / "sql" / "schema.sql").read_text(encoding="utf-8")
    player_mart = (PRODUCT_ROOT / "analytics" / "sql" / "marts_player_summary.sql").read_text(
        encoding="utf-8"
    )

    assert "create table imported_games" in schema
    assert "create table game_reviews" in schema
    assert "create table game_review_moves" in schema
    assert "analysis_status" in schema
    assert "imported_games_count" in player_mart
    assert "imported_game_analysis_coverage" in player_mart
    assert "reviewed_games_count" in player_mart
