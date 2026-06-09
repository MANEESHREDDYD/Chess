-- Story progression mart.
-- Shows narrative completion, retry friction, and currently available chapters.

select
    sp.player_id,
    p.display_name,
    sp.chapter_id,
    sp.status,
    sp.best_result,
    sp.attempts,
    sp.completed_at,
    sp.updated_at,
    case when sp.status = 'complete' then 1 else 0 end as is_complete,
    case when sp.status = 'available' then 1 else 0 end as is_available,
    sum(case when sp.status = 'complete' then 1 else 0 end)
        over (partition by sp.player_id) as completed_chapter_count,
    sum(case when sp.status = 'available' then 1 else 0 end)
        over (partition by sp.player_id) as available_chapter_count,
    avg(sp.attempts) over (partition by sp.player_id) as average_attempts_per_chapter,
    max(sp.updated_at) over (partition by sp.player_id) as latest_story_activity_at
from story_progress sp
left join players p on p.id = sp.player_id;
