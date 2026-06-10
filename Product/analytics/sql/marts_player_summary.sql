-- Player-level MIRROR analytics mart.
-- Produces portfolio-ready metrics from local backup tables.

with game_events as (
    select
        player_id,
        id as event_id,
        cast(coalesce(completed_at, created_at) as date) as activity_date,
        'local_match' as event_type
    from local_matches
    union all
    select
        player_id,
        id as event_id,
        cast(coalesce(completed_at, started_at) as date) as activity_date,
        'mirror_match' as event_type
    from mirror_matches
    union all
    select
        player_id,
        id as event_id,
        cast(coalesce(imported_at, created_at) as date) as activity_date,
        'imported_game' as event_type
    from imported_games
    where legal_status = 'valid'
),
activity_events as (
    select player_id, activity_date from game_events
    union all
    select player_id, cast(coalesce(completed_at, created_at) as date) as activity_date
    from saved_analyses
    union all
    select player_id, cast(coalesce(imported_at, created_at) as date) as activity_date
    from imported_games
    union all
    select player_id, cast(coalesce(completed_at, started_at, created_at) as date) as activity_date
    from clue_attempts
    union all
    select player_id, cast(coalesce(completed_at, updated_at) as date) as activity_date
    from story_progress
    union all
    select player_id, cast(earned_at as date) as activity_date
    from achievements
    union all
    select player_id, cast(computed_at as date) as activity_date
    from style_vectors
),
analysis_rollup as (
    select
        player_id,
        count(*) as analyses_completed,
        avg(average_cp_loss) as average_cp_loss,
        avg(accuracy_estimate) as accuracy_estimate,
        sum(blunder_count) as blunder_count,
        sum(mistake_count) as mistake_count
    from saved_analyses
    where status = 'complete'
    group by player_id
),
game_review_rollup as (
    select
        gr.player_id,
        count(*) as reviewed_games_count,
        avg((coalesce(gr.average_cp_loss_white, 0) + coalesce(gr.average_cp_loss_black, 0)) / 2.0) as review_average_cp_loss,
        sum(case when grm.classification = 'blunder' then 1 else 0 end) as review_blunder_count,
        sum(case when grm.classification = 'mistake' then 1 else 0 end) as review_mistake_count,
        max(gr.weakest_phase) as review_phase_weakness_summary
    from game_reviews gr
    left join game_review_moves grm on grm.review_id = gr.id
    group by gr.player_id
),
import_rollup as (
    select
        ig.player_id,
        count(*) as imported_games_count,
        sum(case when ig.legal_status = 'valid' then 1 else 0 end) as valid_imported_games,
        sum(case when ig.legal_status = 'invalid' then 1 else 0 end) as invalid_imported_games,
        sum(case when ig.analysis_status = 'analyzed' or sa.id is not null then 1 else 0 end) as analyzed_imported_games,
        case
            when sum(case when ig.legal_status = 'valid' then 1 else 0 end) = 0 then 0
            else cast(sum(case when ig.analysis_status = 'analyzed' or sa.id is not null then 1 else 0 end) as decimal(18, 4))
                / sum(case when ig.legal_status = 'valid' then 1 else 0 end)
        end as imported_game_analysis_coverage
    from imported_games ig
    left join saved_analyses sa
        on sa.match_id = ig.id
        and sa.match_type = 'imported'
        and sa.status = 'complete'
    group by ig.player_id
),
clue_rollup as (
    select
        player_id,
        count(*) as clue_attempts,
        sum(case when solved then 1 else 0 end) as clue_solved,
        sum(case when coalesce(total_steps, 1) > 1 then 1 else 0 end) as multi_move_attempts,
        sum(case when coalesce(total_steps, 1) > 1 and solved then 1 else 0 end) as multi_move_solved,
        avg(case when solved_without_reveal then 1.0 else 0.0 end) as solved_without_reveal_rate,
        avg(case when used_final_reveal then 1.0 else 0.0 end) as final_reveal_rate,
        max(streak_count) as best_clue_streak,
        sum(case when boss_cleared then 1 else 0 end) as boss_completion_count,
        sum(case when mode = 'review' then 1 else 0 end) as review_mode_attempts,
        sum(case when mode = 'review' and solved and not coalesce(used_final_reveal, false) then 1 else 0 end) as review_mode_successes
    from clue_attempts
    group by player_id
),
story_rollup as (
    select
        player_id,
        sum(case when status = 'complete' then 1 else 0 end) as story_chapters_completed,
        sum(case when status = 'available' then 1 else 0 end) as story_chapters_available
    from story_progress
    group by player_id
),
review_rollup as (
    select
        player_id,
        sum(case when next_due_at <= current_timestamp then 1 else 0 end) as review_due_count,
        sum(lapses) as review_lapse_count
    from puzzle_reviews
    group by player_id
),
achievement_rollup as (
    select
        player_id,
        count(*) as achievement_count
    from achievements
    group by player_id
),
activity_rollup as (
    select
        player_id,
        count(distinct activity_date) as active_days
    from activity_events
    where activity_date is not null
    group by player_id
),
latest_style_vector as (
    select *
    from (
        select
            sv.*,
            row_number() over (
                partition by sv.player_id
                order by sv.computed_at desc, sv.id desc
            ) as style_rank
        from style_vectors sv
    ) ranked
    where style_rank = 1
)
select
    p.id as player_id,
    p.display_name,
    coalesce(count(distinct ge.event_id), 0) as total_games,
    coalesce(sum(case when ge.event_type = 'mirror_match' then 1 else 0 end), 0) as mirror_matches,
    coalesce(ir.imported_games_count, 0) as imported_games_count,
    coalesce(ir.valid_imported_games, 0) as valid_imported_games,
    coalesce(ir.invalid_imported_games, 0) as invalid_imported_games,
    coalesce(ir.imported_game_analysis_coverage, 0) as imported_game_analysis_coverage,
    coalesce(ar.analyses_completed, 0) as analyses_completed,
    coalesce(sr.story_chapters_completed, 0) as story_chapters_completed,
    coalesce(cr.clue_attempts, 0) as clue_attempts,
    case
        when coalesce(cr.clue_attempts, 0) = 0 then 0
        else cast(cr.clue_solved as decimal(18, 4)) / cr.clue_attempts
    end as clue_solve_rate,
    case
        when coalesce(cr.multi_move_attempts, 0) = 0 then 0
        else cast(cr.multi_move_solved as decimal(18, 4)) / cr.multi_move_attempts
    end as multi_move_solve_rate,
    coalesce(cr.solved_without_reveal_rate, 0) as solved_without_reveal_rate,
    coalesce(cr.final_reveal_rate, 0) as final_reveal_rate,
    case
        when coalesce(cr.review_mode_attempts, 0) = 0 then 0
        else cast(cr.review_mode_successes as decimal(18, 4)) / cr.review_mode_attempts
    end as review_mode_success_rate,
    coalesce(cr.best_clue_streak, 0) as best_clue_streak,
    coalesce(cr.boss_completion_count, 0) as boss_completion_count,
    coalesce(rr.review_due_count, 0) as review_due_count,
    coalesce(ach.achievement_count, 0) as achievement_count,
    coalesce(act.active_days, 0) as active_days,
    coalesce(ar.average_cp_loss, 0) as average_cp_loss,
    coalesce(ar.accuracy_estimate, 0) as accuracy_estimate,
    coalesce(ar.blunder_count, 0) as blunder_count,
    coalesce(ar.mistake_count, 0) as mistake_count,
    coalesce(grr.reviewed_games_count, 0) as reviewed_games_count,
    coalesce(grr.review_average_cp_loss, 0) as review_average_cp_loss,
    coalesce(grr.review_blunder_count, 0) as review_blunder_count,
    coalesce(grr.review_mistake_count, 0) as review_mistake_count,
    coalesce(grr.review_phase_weakness_summary, 'insufficient_data') as review_phase_weakness_summary,
    lsv.id as style_vector_id,
    lsv.time_pressure_blunder_rate as time_pressure_risk,
    lsv.exchange_willingness,
    lsv.preferred_minor,
    lsv.motif_pin_blindness,
    lsv.motif_fork_blindness,
    lsv.motif_skewer_blindness,
    lsv.motif_removing_the_defender_blindness,
    lsv.detected_elo,
    lsv.elo_band
from players p
left join game_events ge on ge.player_id = p.id
left join analysis_rollup ar on ar.player_id = p.id
left join game_review_rollup grr on grr.player_id = p.id
left join import_rollup ir on ir.player_id = p.id
left join clue_rollup cr on cr.player_id = p.id
left join story_rollup sr on sr.player_id = p.id
left join review_rollup rr on rr.player_id = p.id
left join achievement_rollup ach on ach.player_id = p.id
left join activity_rollup act on act.player_id = p.id
left join latest_style_vector lsv on lsv.player_id = p.id
group by
    p.id,
    p.display_name,
    ar.analyses_completed,
    ar.average_cp_loss,
    ar.accuracy_estimate,
    ar.blunder_count,
    ar.mistake_count,
    grr.reviewed_games_count,
    grr.review_average_cp_loss,
    grr.review_blunder_count,
    grr.review_mistake_count,
    grr.review_phase_weakness_summary,
    ir.imported_games_count,
    ir.valid_imported_games,
    ir.invalid_imported_games,
    ir.imported_game_analysis_coverage,
    cr.clue_attempts,
    cr.clue_solved,
    cr.multi_move_attempts,
    cr.multi_move_solved,
    sr.story_chapters_completed,
    rr.review_due_count,
    ach.achievement_count,
    act.active_days,
    lsv.id,
    lsv.time_pressure_blunder_rate,
    lsv.exchange_willingness,
    lsv.preferred_minor,
    lsv.motif_pin_blindness,
    lsv.motif_fork_blindness,
    lsv.motif_skewer_blindness,
    lsv.motif_removing_the_defender_blindness,
    lsv.detected_elo,
    lsv.elo_band;
