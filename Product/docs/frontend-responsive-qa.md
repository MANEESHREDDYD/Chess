# Frontend Responsive QA

## Purpose

The previous product-quality visual check loaded routes but did not catch visible collisions. `M-FRONTEND-PRODUCTION-REDESIGN-1` replaces that false-confidence path with screenshot artifacts and bounding-box assertions.

## Command

```bash
node scripts/run-frontend-production-redesign-check.mjs
```

The legacy command now delegates to the same stricter check:

```bash
node scripts/run-product-quality-visual-check.mjs
```

## Viewports

The production redesign check runs in Chromium at:

- 1440x900
- 1366x768
- 1280x720
- 1024x768
- 900x768
- 390x844

## Routes

The check visits:

- `/play`
- `/progress`
- `/mirror`
- `/story`
- `/clue-chess`
- `/analytics`
- `/review/local_match/frontend-local`
- `/import-pgn`

The script seeds a local IndexedDB fixture so routes render meaningful game, review, analytics, puzzle, and progression content without cloud or login.

## Artifact Folder

Screenshots are saved to:

```text
Product/artifacts/frontend-redesign/
```

Each route and viewport gets its own PNG artifact.

## Required Assertions

The script fails if:

- `/play` board overlaps controls
- `/play` board overlaps history/review panel
- `/play` controls overlap history
- `/play` review buttons collapse below 120px on desktop
- `/play` table scroller exceeds its card bounds
- `/play` shows blocking `Engine unavailable` in the seeded QA state
- header overlaps route content
- body horizontal overflow exceeds viewport width by more than 8px
- `/progress` contains raw `Back Home` text
- `/progress` backup action looks like a default blue underlined link
- `/progress` XP text does not match a `number / number XP` pattern
- `/story` lacks mission-oriented language
- `/story` still uses `Start Puzzle` on the landing surface
- `/clue-chess` mode selector is missing
- `/analytics` recommended actions are missing
- `/import-pgn` text area overflows the page

## Manual Review

After the latest passing run, screenshots were manually reviewed for:

- `/play` at 1366x768
- `/play` at 390x844
- `/progress` at 1366x768
- `/mirror` at 390x844

Manual result:

- the `/play` overlap reported by the user is gone
- review actions are readable buttons
- match history stays inside the right card on desktop and stacks on mobile
- `/progress` reads as a profile dashboard, not raw HTML
- nav is grouped and cleaner
- board regions stay contained at tested sizes

## Policy

Do not tag frontend layout milestones unless screenshots exist and bounding-box checks pass.
