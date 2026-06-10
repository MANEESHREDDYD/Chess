-- Analysis quality mart.
-- Tracks CP-loss, blunders, mistakes, and trend against the player's previous
-- analyzed game.

with ordered as (
    select
        sa.*,
        lag(sa.average_cp_loss) over (
            partition by sa.player_id
            order by sa.created_at, sa.id
        ) as previous_average_cp_loss,
        avg(sa.average_cp_loss) over (
            partition by sa.player_id
            rows between unbounded preceding and current row
        ) as running_average_cp_loss,
        avg(sa.accuracy_estimate) over (
            partition by sa.player_id
            rows between unbounded preceding and current row
        ) as running_accuracy_estimate
    from saved_analyses sa
    where sa.status = 'complete'
)
select
    ordered.player_id,
    p.display_name,
    ordered.id as analysis_id,
    ordered.match_id,
    ordered.match_type,
    ordered.created_at,
    ordered.engine_depth,
    ordered.average_cp_loss,
    ordered.accuracy_estimate,
    ordered.blunder_count,
    ordered.mistake_count,
    ordered.inaccuracy_count,
    ordered.analyzed_moves,
    ordered.previous_average_cp_loss,
    case
        when ordered.previous_average_cp_loss is null then 0
        else ordered.average_cp_loss - ordered.previous_average_cp_loss
    end as cp_loss_trend_vs_previous,
    ordered.running_average_cp_loss,
    ordered.running_accuracy_estimate,
    case
        when ordered.previous_average_cp_loss is null then 'insufficient_data'
        when ordered.average_cp_loss <= ordered.previous_average_cp_loss - 5 then 'improving'
        when ordered.average_cp_loss >= ordered.previous_average_cp_loss + 5 then 'regressing'
        else 'stable'
    end as analysis_trend,
    '' as phase_weakness_summary,
    '' as most_common_classification
from ordered
left join players p on p.id = ordered.player_id

union all

select
    gr.player_id,
    p.display_name,
    gr.id as analysis_id,
    gr.source_id as match_id,
    gr.source_type as match_type,
    gr.created_at,
    gr.analysis_depth as engine_depth,
    (coalesce(gr.average_cp_loss_white, 0) + coalesce(gr.average_cp_loss_black, 0)) / 2.0 as average_cp_loss,
    (coalesce(gr.accuracy_white, 0) + coalesce(gr.accuracy_black, 0)) / 2.0 as accuracy_estimate,
    sum(case when grm.classification = 'blunder' then 1 else 0 end) as blunder_count,
    sum(case when grm.classification = 'mistake' then 1 else 0 end) as mistake_count,
    sum(case when grm.classification = 'inaccuracy' then 1 else 0 end) as inaccuracy_count,
    count(grm.ply) as analyzed_moves,
    null as previous_average_cp_loss,
    0 as cp_loss_trend_vs_previous,
    (coalesce(gr.average_cp_loss_white, 0) + coalesce(gr.average_cp_loss_black, 0)) / 2.0 as running_average_cp_loss,
    (coalesce(gr.accuracy_white, 0) + coalesce(gr.accuracy_black, 0)) / 2.0 as running_accuracy_estimate,
    'game_review_record' as analysis_trend,
    coalesce(gr.weakest_phase, 'insufficient_data') as phase_weakness_summary,
    coalesce(max(grm.classification), 'insufficient_data') as most_common_classification
from game_reviews gr
left join players p on p.id = gr.player_id
left join game_review_moves grm on grm.review_id = gr.id
group by
    gr.player_id,
    p.display_name,
    gr.id,
    gr.source_id,
    gr.source_type,
    gr.created_at,
    gr.analysis_depth,
    gr.average_cp_loss_white,
    gr.average_cp_loss_black,
    gr.accuracy_white,
    gr.accuracy_black,
    gr.weakest_phase;
