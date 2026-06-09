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
),
activity_events as (
    select player_id, activity_date from game_events
    union all
    select player_id, cast(coalesce(completed_at, created_at) as date) as activity_date
    from saved_analyses
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
clue_rollup as (
    select
        player_id,
        count(*) as clue_attempts,
        sum(case when solved then 1 else 0 end) as clue_solved,
        sum(case when coalesce(total_steps, 1) > 1 then 1 else 0 end) as multi_move_attempts,
        sum(case when coalesce(total_steps, 1) > 1 and solved then 1 else 0 end) as multi_move_solved
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
    coalesce(rr.review_due_count, 0) as review_due_count,
    coalesce(ach.achievement_count, 0) as achievement_count,
    coalesce(act.active_days, 0) as active_days,
    coalesce(ar.average_cp_loss, 0) as average_cp_loss,
    coalesce(ar.accuracy_estimate, 0) as accuracy_estimate,
    coalesce(ar.blunder_count, 0) as blunder_count,
    coalesce(ar.mistake_count, 0) as mistake_count,
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
