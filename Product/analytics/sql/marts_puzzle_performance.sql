-- Motif-level puzzle performance mart.
-- Supports weak-motif detection, review prioritization, and spaced-repetition
-- operational analytics.

with attempt_rollup as (
    select
        player_id,
        coalesce(motif, 'unknown') as motif,
        count(*) as attempts,
        sum(case when solved then 1 else 0 end) as solved_count,
        sum(case when solved then 0 else 1 end) as failed_motif_count,
        sum(case when coalesce(total_steps, 1) > 1 then 1 else 0 end) as multi_move_attempts,
        sum(
            case
                when coalesce(total_steps, 1) > 1 and not solved then 1
                else 0
            end
        ) as multi_move_failures,
        avg(hints_used) as average_hints_used,
        avg(time_spent_ms) as average_time_spent_ms,
        avg(case when solved_without_reveal then 1.0 else 0.0 end) as solved_without_reveal_rate,
        avg(case when used_final_reveal then 1.0 else 0.0 end) as final_reveal_rate,
        max(streak_count) as best_streak,
        sum(case when boss_cleared then 1 else 0 end) as boss_completion_count,
        sum(case when mode = 'review' then 1 else 0 end) as review_mode_attempts,
        sum(case when mode = 'review' and solved and not coalesce(used_final_reveal, false) then 1 else 0 end) as review_mode_successes
    from clue_attempts
    group by player_id, coalesce(motif, 'unknown')
),
review_rollup as (
    select
        player_id,
        coalesce(motif, 'unknown') as motif,
        count(*) as review_queue_count,
        sum(lapses) as review_lapse_count,
        sum(case when next_due_at <= current_timestamp then 1 else 0 end) as review_due_count,
        avg(ease) as average_review_ease
    from puzzle_reviews
    group by player_id, coalesce(motif, 'unknown')
),
motif_keys as (
    select player_id, motif from attempt_rollup
    union
    select player_id, motif from review_rollup
),
combined as (
    select
        k.player_id,
        k.motif,
        coalesce(a.attempts, 0) as attempts,
        coalesce(a.solved_count, 0) as solved_count,
        coalesce(a.failed_motif_count, 0) as failed_motif_count,
        case
            when coalesce(a.attempts, 0) = 0 then 0
            else cast(a.solved_count as decimal(18, 4)) / a.attempts
        end as solved_rate,
        coalesce(r.review_lapse_count, 0) as review_lapse_count,
        coalesce(r.review_due_count, 0) as review_due_count,
        coalesce(a.multi_move_attempts, 0) as multi_move_attempts,
        case
            when coalesce(a.multi_move_attempts, 0) = 0 then 0
            else cast(a.multi_move_failures as decimal(18, 4)) / a.multi_move_attempts
        end as multi_move_failure_rate,
        coalesce(a.average_hints_used, 0) as average_hints_used,
        coalesce(a.average_time_spent_ms, 0) as average_time_spent_ms,
        coalesce(a.solved_without_reveal_rate, 0) as solved_without_reveal_rate,
        coalesce(a.final_reveal_rate, 0) as final_reveal_rate,
        coalesce(a.best_streak, 0) as best_streak,
        coalesce(a.boss_completion_count, 0) as boss_completion_count,
        case
            when coalesce(a.review_mode_attempts, 0) = 0 then 0
            else cast(a.review_mode_successes as decimal(18, 4)) / a.review_mode_attempts
        end as review_mode_success_rate,
        coalesce(r.average_review_ease, 0) as average_review_ease
    from motif_keys k
    left join attempt_rollup a
        on a.player_id = k.player_id
       and a.motif = k.motif
    left join review_rollup r
        on r.player_id = k.player_id
       and r.motif = k.motif
),
ranked as (
    select
        combined.*,
        row_number() over (
            partition by player_id
            order by solved_rate asc, failed_motif_count desc, review_lapse_count desc, motif asc
        ) as weakest_rank,
        row_number() over (
            partition by player_id
            order by solved_rate desc, solved_count desc, attempts desc, motif asc
        ) as strongest_rank
    from combined
)
select
    player_id,
    motif,
    attempts,
    solved_count,
    failed_motif_count,
    solved_rate,
    review_lapse_count,
    review_due_count,
    multi_move_attempts,
    multi_move_failure_rate,
    average_hints_used,
    average_time_spent_ms,
    solved_without_reveal_rate,
    final_reveal_rate,
    review_mode_success_rate,
    best_streak,
    boss_completion_count,
    average_review_ease,
    case when weakest_rank = 1 then motif else null end as weakest_motif,
    case when strongest_rank = 1 then motif else null end as strongest_motif
from ranked;
