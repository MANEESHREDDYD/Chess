# MIRROR Apple Mono — Visual System

Milestone: M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1
Implementation: `Product/src/styles/mirrorAppleMono.css` (loaded LAST; single palette authority)

## Principle

Premium design is subtraction: **85% black/white/gray · 10% soft glass/surface depth ·
5% functional accent.** The light theme looks like apple.com (white, soft gray, black text,
clean depth). The dark theme is agent-owned graphite: true black pages, glass cards, silver
text, blue action.

## Core palette

Black · white · graphite · silver gray · ONE blue primary accent · green = success only ·
amber = warning only · red = danger only · bronze/gold = tiny Story/Kurukshetra accent only.

### Dark theme — Mono Black

```css
--bg-page: #000000;          --bg-page-soft: #070708;
--bg-shell: rgba(10, 10, 12, 0.86);
--bg-surface: #111113;
--bg-card: rgba(255, 255, 255, 0.055);
--bg-card-hover: rgba(255, 255, 255, 0.085);
--bg-elevated: rgba(255, 255, 255, 0.12);
--text-primary: #F5F5F7;     --text-secondary: #D2D2D7;   --text-muted: #8E8E93;
--border-subtle: rgba(255, 255, 255, 0.10);
--border-strong: rgba(255, 255, 255, 0.22);
--accent-primary: #0A84FF;   --accent-primary-hover: #409CFF;
--accent-success: #30D158;   --accent-warning: #FFD60A;
--accent-danger: #FF453A;    --accent-story: #B8872F;
--focus-ring: rgba(10, 132, 255, 0.44);
```

### Light theme — Mono White

```css
--bg-page: #F5F5F7;          --bg-page-soft: #FFFFFF;
--bg-shell: rgba(255, 255, 255, 0.90);
--bg-surface: #FFFFFF;
--bg-card: rgba(255, 255, 255, 0.90);
--bg-card-hover: #FFFFFF;    --bg-elevated: #FFFFFF;
--text-primary: #1D1D1F;     --text-secondary: #3A3A3C;   --text-muted: #6E6E73;
--border-subtle: rgba(0, 0, 0, 0.10);
--border-strong: rgba(0, 0, 0, 0.18);
--accent-primary: #0071E3;   --accent-primary-hover: #0077ED;
--accent-success: #248A3D;   --accent-warning: #B56A00;
--accent-danger: #D70015;    --accent-story: #8A5A16;
--focus-ring: rgba(0, 113, 227, 0.34);
```

## Cascade architecture (why this works)

The repo carries four CSS generations (tokens.css → global.css → designSystem.css →
mirrorNova.css). `mirrorAppleMono.css` loads after all of them and:

1. Defines the source palette as `--mono-*` per theme on `html[data-ui-theme]`.
2. Re-points EVERY legacy token generation (`--bg/--paper/--ink`, `--mirror-*`, `--color-*`,
   `--nova-*`, and the shell-scoped Aura `--accent-*`/`--bg-*` block) at the `--mono-*`
   source, **including the high-specificity `.app-shell-v2.ui-theme-*` selectors** that
   would otherwise win inside the shell.
3. Overrides component-level warm/parchment rules (route hero, cards, chips, buttons,
   progress bars, promotion dialog, board frame).

Result: one palette, regardless of which historical class a component still uses.

## Hard rules

- App shell can never be beige/gold/brown; no global parchment; no low-contrast cream cards.
- Primary buttons are blue. Story bronze is rare and scoped (`--accent-story`).
- Warm sand/clay may appear ONLY inside board squares / the 3D battlefield scene.
- No raw blue links; no default browser buttons; no native selects in the header.
- Board sizing tokens: desktop `min(max(68vh, 500px), 680px)`, tablet
  `min(max(64vh, 480px), 620px)`, mobile `min(92vw, 520px)` — height-aware with a floor so
  short windows still get a real board.

## Fonts (Phase 4)

```css
--font-ui:      -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
                "Segoe UI Variable", "Segoe UI", Roboto, Inter, system-ui, sans-serif;
--font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display",
                "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
--font-story:   "New York", "Iowan Old Style", Georgia, serif;
--font-mono:    "SFMono-Regular", "Cascadia Code", Consolas, monospace;
```

UI/nav/buttons/body/cards/analytics/profile/review/import/coach = `--font-ui`.
Page titles = `--font-display`. `--font-story` serif appears ONLY in Story mission titles.
No serif buttons, nav, or controls. Legacy `--font-body` (Lora) is remapped to `--font-ui`.
