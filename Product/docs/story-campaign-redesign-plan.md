# Story Campaign Redesign Plan

The current Story route has been reset toward a campaign-first product identity. The route still reuses existing chess encounters and puzzle mechanics, but the surface now presents acts, mission cards, mission briefings, objectives, and progress states.

## Product Goal

Story Mode should feel like a level-based campaign, not like Clue Chess with dialogue attached.

## Campaign Structure

- Campaign map with Act I, Act II, and Act III paths.
- Unlockable chapters as missions.
- Locked, available, and completed states.
- Mission briefing before the encounter.
- Battlefield encounter with a chess objective.
- Victory/reward screen after completion.
- Boss encounters at major chapter boundaries.
- Chapter progress and future reward hooks.

## UI Contract

- Use "Start Mission", not "Start Puzzle".
- Use "Mission briefing", not generic hint panels.
- Optional tactical support can appear inside missions, but it should be secondary.
- Story should avoid cluttered training controls by default.
- Story-specific visuals should be separate from Clue Chess mode styling.

## Near-Term Implementation Path

1. Add a mission intro screen with objective, opponent, location, and reward.
2. Add a victory screen with XP/reward copy and next mission routing.
3. Add mission outcome records to story progress metadata.
4. Add boss mission grouping for act finales.
5. Add route-level smoke tests for mission start/completion.

## Future Visual Path

The current route uses improved 2D board styling. Future 3D milestones should add battlefield background, board treatment, stylized soldier pieces, non-gory capture effects, mobile fallback, and reduced-motion settings.

## Honesty Note

Act II and Act III shells already exist. Future work should say Act II implementation and Act III implementation when deeper chapter mechanics are added, not "expand Chapters 8-14."
