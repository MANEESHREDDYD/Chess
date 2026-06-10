-- MIRROR analytics warehouse schema.
-- These tables model the exported IndexedDB backup JSON after local ingestion.
-- The schema is intentionally portable SQL: no Supabase, cloud service, or
-- dialect-specific JSON operators are required.

create table players (
    id varchar(128) primary key,
    display_name varchar(255),
    created_at timestamp,
    updated_at timestamp,
    current_style_vector_id varchar(128),
    calibration_status varchar(64),
    detected_elo integer,
    elo_band varchar(64)
);

create table local_matches (
    id varchar(128) primary key,
    player_id varchar(128) not null,
    mode varchar(64),
    side varchar(16),
    actual_side varchar(16),
    difficulty varchar(64),
    result varchar(64),
    result_label varchar(128),
    pgn text,
    move_count integer,
    created_at timestamp,
    completed_at timestamp
);

create table mirror_matches (
    id varchar(128) primary key,
    player_id varchar(128) not null,
    started_at timestamp,
    completed_at timestamp,
    pgn text,
    result varchar(64),
    mirror_version integer
);

create table imported_games (
    id varchar(160) primary key,
    player_id varchar(128) not null,
    source varchar(64),
    original_filename varchar(255),
    imported_at timestamp,
    result varchar(32),
    white_player varchar(255),
    black_player varchar(255),
    user_color varchar(16),
    move_count integer,
    final_fen text,
    legal_status varchar(32),
    validation_error_count integer,
    analysis_status varchar(32),
    stylevector_applied boolean,
    created_at timestamp,
    updated_at timestamp
);

create table style_vectors (
    id varchar(128) primary key,
    player_id varchar(128) not null,
    calibration_run_id varchar(128),
    source varchar(64),
    opening_white_top3_text text,
    opening_black_top3_text text,
    avg_move_time_ms numeric(12, 2),
    time_pressure_blunder_rate numeric(8, 4),
    exchange_willingness numeric(8, 4),
    preferred_minor varchar(32),
    motif_fork_blindness numeric(8, 4),
    motif_pin_blindness numeric(8, 4),
    motif_skewer_blindness numeric(8, 4),
    motif_removing_the_defender_blindness numeric(8, 4),
    endgame_strength numeric(8, 4),
    swindle_preference varchar(32),
    detected_elo integer,
    elo_band varchar(64),
    schema_version integer,
    computed_at timestamp,
    previous_vector_id varchar(128)
);

create table saved_analyses (
    id varchar(128) primary key,
    player_id varchar(128) not null,
    match_id varchar(128) not null,
    match_type varchar(32),
    source varchar(64),
    engine_depth integer,
    engine_version varchar(64),
    status varchar(32),
    created_at timestamp,
    completed_at timestamp,
    total_moves integer,
    analyzed_moves integer,
    average_cp_loss numeric(12, 4),
    accuracy_estimate numeric(8, 4),
    best_count integer,
    good_count integer,
    inaccuracy_count integer,
    mistake_count integer,
    blunder_count integer,
    missed_tactic_count integer
);

create table analysis_moves (
    analysis_id varchar(128) not null,
    ply integer not null,
    player_id varchar(128) not null,
    move_number integer,
    color varchar(16),
    san varchar(32),
    uci varchar(16),
    cp_loss integer,
    classification varchar(32),
    best_move varchar(16),
    primary key (analysis_id, ply)
);

create table game_reviews (
    id varchar(160) primary key,
    player_id varchar(128) not null,
    source_type varchar(32),
    source_id varchar(160),
    created_at timestamp,
    analysis_depth integer,
    engine_name varchar(64),
    engine_version varchar(64),
    total_moves integer,
    reviewed_side varchar(16),
    accuracy_white numeric(8, 4),
    accuracy_black numeric(8, 4),
    average_cp_loss_white numeric(12, 4),
    average_cp_loss_black numeric(12, 4),
    result varchar(64),
    opening_name varchar(255),
    weakest_phase varchar(32),
    key_moment_count integer,
    recommended_action_count integer
);

create table game_review_moves (
    review_id varchar(160) not null,
    ply integer not null,
    player_id varchar(128) not null,
    move_number integer,
    side varchar(16),
    san varchar(32),
    uci varchar(16),
    cp_loss integer,
    classification varchar(32),
    phase varchar(32),
    is_turning_point boolean,
    retry_available boolean,
    primary key (review_id, ply)
);

create table clue_attempts (
    id varchar(128) primary key,
    player_id varchar(128) not null,
    puzzle_id varchar(128) not null,
    source varchar(64),
    motif varchar(128),
    difficulty varchar(64),
    hints_used integer,
    solved boolean,
    time_spent_ms integer,
    started_at timestamp,
    completed_at timestamp,
    created_at timestamp,
    current_step integer,
    solved_steps integer,
    total_steps integer,
    failed_step integer
);

create table puzzle_reviews (
    id varchar(160) primary key,
    player_id varchar(128) not null,
    puzzle_id varchar(128) not null,
    motif varchar(128),
    difficulty varchar(64),
    is_multi_move boolean,
    last_attempt_at timestamp,
    next_due_at timestamp,
    interval_days integer,
    ease numeric(8, 4),
    attempts integer,
    lapses integer,
    solved_streak integer,
    last_result varchar(32),
    updated_at timestamp
);

create table story_progress (
    id varchar(160) primary key,
    player_id varchar(128) not null,
    chapter_id varchar(128) not null,
    status varchar(64),
    best_result varchar(64),
    attempts integer,
    completed_at timestamp,
    updated_at timestamp
);

create table achievements (
    id varchar(160) primary key,
    player_id varchar(128) not null,
    achievement_id varchar(128) not null,
    title varchar(255),
    description text,
    earned_at timestamp
);
