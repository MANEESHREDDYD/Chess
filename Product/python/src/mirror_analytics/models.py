"""Data models mirroring the MIRROR IndexedDB schema.

Every dataclass here corresponds 1:1 to a TypeScript interface in the MIRROR
React app (``src/data/db.ts``). Fields use the exact JSON key names so that
``json.load`` output can be passed straight to ``from_dict`` constructors.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


# ---------------------------------------------------------------------------
# StyleVector (nested inside StyleVectorRecord.vector)
# ---------------------------------------------------------------------------

@dataclass
class StyleVector:
    """11 behavioral/profile fields plus schema metadata derived from calibration."""

    opening_white_top3: list[str] = field(default_factory=list)
    opening_black_top3: list[str] = field(default_factory=list)
    avg_move_time_ms: float = 0.0
    time_pressure_blunder_rate: float = 0.0
    exchange_willingness: float = 0.0
    preferred_minor: str = "neutral"  # 'knight' | 'bishop' | 'neutral'
    motif_blindness: dict[str, float] = field(default_factory=dict)
    endgame_strength: float = 0.0
    swindle_preference: Optional[str] = None  # 'principled' | 'swindle' | null
    detected_elo: int = 800
    elo_band: str = "apprentice"  # 'apprentice' | 'initiate' | 'adept' | 'master'
    schema_version: int = 1

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "StyleVector":
        return cls(
            opening_white_top3=d.get("opening_white_top3", []),
            opening_black_top3=d.get("opening_black_top3", []),
            avg_move_time_ms=d.get("avg_move_time_ms", 0),
            time_pressure_blunder_rate=d.get("time_pressure_blunder_rate", 0),
            exchange_willingness=d.get("exchange_willingness", 0),
            preferred_minor=d.get("preferred_minor", "neutral"),
            motif_blindness=d.get("motif_blindness", {}),
            endgame_strength=d.get("endgame_strength", 0),
            swindle_preference=d.get("swindle_preference"),
            detected_elo=d.get("detected_elo", 800),
            elo_band=d.get("elo_band", "apprentice"),
            schema_version=d.get("schema_version", 1),
        )


# ---------------------------------------------------------------------------
# Top-level records (one per IndexedDB store)
# ---------------------------------------------------------------------------

@dataclass
class PlayerRecord:
    id: str = ""
    display_name: str = ""
    created_at: str = ""
    updated_at: str = ""
    current_style_vector_id: Optional[str] = None
    calibration_status: Optional[str] = None
    settings: dict[str, Any] = field(default_factory=dict)
    detected_elo: Optional[int] = None
    elo_band: Optional[str] = None

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "PlayerRecord":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class LocalMatchRecord:
    id: str = ""
    player_id: str = ""
    mode: str = "computer"
    side: str = "white"
    actual_side: str = "white"
    difficulty: str = "Casual"
    result: str = ""
    result_label: str = ""
    pgn: str = ""
    move_count: int = 0
    created_at: str = ""
    completed_at: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "LocalMatchRecord":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class MirrorMatchRecord:
    id: str = ""
    player_id: str = ""
    started_at: str = ""
    completed_at: Optional[str] = None
    pgn: Optional[str] = None
    result: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "MirrorMatchRecord":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class ImportedGameRecord:
    id: str = ""
    player_id: str = ""
    source: str = "unknown_pgn"
    original_filename: Optional[str] = None
    imported_at: str = ""
    headers: dict[str, Any] = field(default_factory=dict)
    pgn_text: str = ""
    normalized_pgn: str = ""
    result: Optional[str] = None
    white: Optional[str] = None
    black: Optional[str] = None
    user_color: Optional[str] = None
    move_count: int = 0
    final_fen: str = ""
    legal_status: str = "invalid"
    validation_errors: list[str] = field(default_factory=list)
    analysis_status: str = "not_analyzed"
    stylevector_applied: bool = False
    created_at: str = ""
    updated_at: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "ImportedGameRecord":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class CalibrationRunRecord:
    id: str = ""
    player_id: str = ""
    started_at: str = ""
    completed_at: Optional[str] = None
    status: str = "in_progress"
    current_task_index: int = 0
    task_outputs: dict[str, Any] = field(default_factory=dict)
    style_vector_id: Optional[str] = None

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "CalibrationRunRecord":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class StyleVectorRecord:
    id: str = ""
    player_id: str = ""
    calibration_run_id: Optional[str] = None
    source: str = "calibration"
    vector: StyleVector = field(default_factory=StyleVector)
    computed_at: str = ""
    previous_vector_id: Optional[str] = None

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "StyleVectorRecord":
        vec = d.get("vector", {})
        return cls(
            id=d.get("id", ""),
            player_id=d.get("player_id", ""),
            calibration_run_id=d.get("calibration_run_id"),
            source=d.get("source", "calibration"),
            vector=StyleVector.from_dict(vec) if isinstance(vec, dict) else StyleVector(),
            computed_at=d.get("computed_at", ""),
            previous_vector_id=d.get("previous_vector_id"),
        )


@dataclass
class AnalysisMove:
    ply: int = 0
    move_number: int = 0
    color: str = "white"
    san: str = ""
    uci: Optional[str] = None
    fen_before: str = ""
    fen_after: str = ""
    best_eval_cp: Optional[int] = None
    played_eval_cp: Optional[int] = None
    cp_loss: Optional[int] = None
    classification: str = "unknown"
    best_move: Optional[str] = None
    best_line: Optional[list[str]] = None
    note: Optional[str] = None

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "AnalysisMove":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class AnalysisSummary:
    total_moves: int = 0
    analyzed_moves: int = 0
    average_cp_loss: float = 0.0
    accuracy_estimate: Optional[float] = None
    best_count: int = 0
    good_count: int = 0
    inaccuracy_count: int = 0
    mistake_count: int = 0
    blunder_count: int = 0
    missed_tactic_count: Optional[int] = None
    opening_phase_moves: Optional[int] = None
    middlegame_phase_moves: Optional[int] = None
    endgame_phase_moves: Optional[int] = None

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "AnalysisSummary":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class AnalysisRecord:
    id: str = ""
    player_id: str = ""
    match_id: str = ""
    match_type: str = "computer"
    source: str = "local_stockfish"
    engine_depth: int = 0
    engine_version: Optional[str] = None
    status: str = "complete"
    created_at: str = ""
    completed_at: Optional[str] = None
    pgn: str = ""
    summary: AnalysisSummary = field(default_factory=AnalysisSummary)
    moves: list[AnalysisMove] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "AnalysisRecord":
        summary = d.get("summary", {})
        moves = d.get("moves", [])
        return cls(
            id=d.get("id", ""),
            player_id=d.get("player_id", ""),
            match_id=d.get("match_id", ""),
            match_type=d.get("match_type", "computer"),
            source=d.get("source", "local_stockfish"),
            engine_depth=d.get("engine_depth", 0),
            engine_version=d.get("engine_version"),
            status=d.get("status", "complete"),
            created_at=d.get("created_at", ""),
            completed_at=d.get("completed_at"),
            pgn=d.get("pgn", ""),
            summary=AnalysisSummary.from_dict(summary) if isinstance(summary, dict) else AnalysisSummary(),
            moves=[AnalysisMove.from_dict(m) for m in moves] if isinstance(moves, list) else [],
            metadata=d.get("metadata", {}),
        )


@dataclass
class ClueAttemptRecord:
    id: str = ""
    player_id: str = ""
    puzzle_id: str = ""
    source: str = "seed"
    fen: str = ""
    solution_moves: list[str] = field(default_factory=list)
    attempted_moves: list[str] = field(default_factory=list)
    motif: Optional[str] = None
    difficulty: str = "beginner"
    hints_used: int = 0
    solved: bool = False
    time_spent_ms: Optional[int] = None
    started_at: str = ""
    completed_at: Optional[str] = None
    created_at: str = ""
    current_step: Optional[int] = None
    solved_steps: Optional[int] = None
    total_steps: Optional[int] = None
    line_attempts: Optional[list[str]] = None
    failed_step: Optional[int] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "ClueAttemptRecord":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class PuzzleReviewRecord:
    id: str = ""
    player_id: str = ""
    puzzle_id: str = ""
    motif: str = ""
    difficulty: Optional[str] = None
    is_multi_move: Optional[bool] = None
    last_attempt_at: Optional[str] = None
    next_due_at: str = ""
    interval_days: int = 0
    ease: float = 2.5
    attempts: int = 0
    lapses: int = 0
    solved_streak: int = 0
    last_result: str = "failed"
    updated_at: str = ""

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "PuzzleReviewRecord":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class StoryProgressRecord:
    id: str = ""
    player_id: str = ""
    chapter_id: str = ""
    status: str = "locked"
    best_result: Optional[str] = None
    attempts: int = 0
    completed_at: Optional[str] = None
    updated_at: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "StoryProgressRecord":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class AchievementRecord:
    id: str = ""
    player_id: str = ""
    achievement_id: str = ""
    title: str = ""
    description: Optional[str] = None
    earned_at: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "AchievementRecord":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


# ---------------------------------------------------------------------------
# Backup envelope
# ---------------------------------------------------------------------------

@dataclass
class MirrorBackupData:
    """All data stores contained within a MIRROR backup."""

    players: list[PlayerRecord] = field(default_factory=list)
    local_matches: list[LocalMatchRecord] = field(default_factory=list)
    mirror_matches: list[MirrorMatchRecord] = field(default_factory=list)
    imported_games: list[ImportedGameRecord] = field(default_factory=list)
    calibration_runs: list[CalibrationRunRecord] = field(default_factory=list)
    style_vectors: list[StyleVectorRecord] = field(default_factory=list)
    saved_analyses: list[AnalysisRecord] = field(default_factory=list)
    clue_attempts: list[ClueAttemptRecord] = field(default_factory=list)
    puzzle_reviews: list[PuzzleReviewRecord] = field(default_factory=list)
    story_progress: list[StoryProgressRecord] = field(default_factory=list)
    achievements: list[AchievementRecord] = field(default_factory=list)
    settings: dict[str, Any] = field(default_factory=dict)


@dataclass
class MirrorBackupFile:
    """Top-level envelope for a MIRROR backup JSON export."""

    schema_version: int = 1
    app_name: str = "MIRROR"
    created_at: str = ""
    exported_by: Optional[str] = None
    latest_known_tag: Optional[str] = None
    data: MirrorBackupData = field(default_factory=MirrorBackupData)
