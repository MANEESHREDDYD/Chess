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
    end as analysis_trend
from ordered
left join players p on p.id = ordered.player_id;
