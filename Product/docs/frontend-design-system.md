# Frontend Design System

## Purpose

`M-FRONTEND-PRODUCTION-REDESIGN-1` adds a real frontend foundation so MIRROR stops looking like stacked feature demos and starts behaving like a cohesive product.

The design system is intentionally lightweight: CSS tokens plus shared React components. It does not add a new UI dependency or product feature.

## Tokens

Primary token file:

```text
src/styles/designSystem.css
```

Required token groups now include:

- colors: `--color-bg`, `--color-surface`, `--color-surface-elevated`, `--color-border`, `--color-text`, `--color-text-muted`
- actions: `--color-primary`, `--color-primary-hover`, `--color-danger`, `--color-success`, `--color-warning`
- shadows: `--shadow-card`, `--shadow-board`
- radii: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`
- spacing: `--space-1` through `--space-8`
- board sizing, focus rings, responsive breakpoints, and z-index layers

## Shared Layout Components

- `AppShell`: one consistent product shell for the app.
- `AppHeader`: brand, compact toolbar, theme selector, audio controls.
- `AppNav`: primary product modes, secondary tools, and system diagnostics.
- `PageFrame`: route-width and spacing contract.
- `PageHeader`: title, eyebrow, description, and actions.
- `ResponsiveGrid`: reusable grid primitive for route sections.

## Shared UI Components

- `Button` / `ButtonLink`
- `Card`
- `Panel`
- `Badge`
- `MetricCard`
- `SegmentedControl`
- `ActionLink`
- `EmptyState`
- `TableCard`

Route files should compose these primitives instead of hand-rolling large layout scaffolds.

## Navigation Contract

Primary nav:

- Play
- Mirror
- Story
- Clue
- Analytics
- Profile

Secondary nav:

- Import games
- Coach
- Calibration
- About

System/debug:

- Engine diagnostics

System diagnostics remain accessible but are visually separated from player-facing product modes.

## Route Layout Rules

- Chess screens are board-first.
- Primary layout regions must use CSS grid or flex with explicit containment.
- Tables must live inside `TableCard` or an equivalent overflow-aware card.
- Product pages should not expose raw blue underlined links or default browser buttons.
- Buttons and links must have visible hover, active, disabled, selected, and focus states.
- Body-level horizontal overflow is treated as a QA failure.

## Accessibility Baseline

Implemented baseline:

- visible `:focus-visible` rings
- readable contrast for product text and controls
- practical click targets for core actions
- `aria-label` on compact icon-like toolbar button
- reduced-motion media query support
- keyboard-reachable navigation and route controls

This is not a full WCAG audit, but it moves MIRROR out of prototype territory.

## Visual Honesty

The current Kurukshetra experience remains a 2D placeholder theme. The app and docs should not claim realistic 3D battlefield visuals until the future 3D milestones implement them.

## MIRROR Apple Mono (M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1, 2026-06-11)

The shell now runs the **MIRROR Apple Mono** black/white/graphite system —
`src/styles/mirrorAppleMono.css`, loaded LAST, is the single palette authority. It defines
the spec dark/light tokens (`--mono-*`) and re-points every older token generation
(tokens.css parchment, designSystem `--mirror-*`/`--color-*`, mirrorNova `--nova-*`, and the
shell-scoped Aura block) at them. Blue is the only primary action color; green = success,
amber = warning, red = danger, bronze/gold = rare Story/Kurukshetra accent. Fonts are the
system stack (no shipped Apple fonts, no Google-Fonts CDN); serif appears only in Story
mission titles. Buttons: 44px / 12px radius / weight 650; primary is solid blue.
Board sizing tokens are height-aware with a 480–500px floor; the board never crops, and
warm sand/clay tones exist only inside board squares or the 3D battlefield scene.
See `mirror-apple-mono-visual-system.md`, `interaction-design-contract.md`, and
`page-by-page-frontend-contract.md` for the full contracts.
