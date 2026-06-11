# MIRROR Signal — Color & Type System

Design language: **MIRROR Signal**. A calm AI chess training operating system —
simple, useful, consistent, sticky, high-performance, and original.

## Color strategy
- **60%** neutral base (page + shell)
- **30%** elevated surfaces (cards, panels)
- **10%** accent

| Role | Color | Where it is allowed |
|------|-------|---------------------|
| Primary action | **Blue** | CTAs, selected state, focus, links/actions, nav active |
| Success / progress | **Green** | solved puzzles, progress, best/excellent moves, safe status |
| Rare warm accent | **Gold / bronze** | Story campaign, Kurukshetra identity, achievements, rewards |
| Danger | **Red** | resign, blunder, engine failure, destructive, critical warning |

Forbidden: gold for every button, beige as full background, brown as the main interface
color, pale-yellow cards, washed-out ivory text, low-contrast story cards.

## Theme: Signal Dark
```
--bg-page:        #080A0F
--bg-shell:       rgba(12, 14, 20, 0.88)
--bg-surface:     #11141C
--bg-card:        rgba(255, 255, 255, 0.055)
--bg-card-hover:  rgba(255, 255, 255, 0.085)
--bg-elevated:    rgba(255, 255, 255, 0.105)
--text-primary:   #F5F7FA
--text-secondary: #C9D1DC
--text-muted:     #8E98A8
--border-subtle:  rgba(255, 255, 255, 0.10)
--border-strong:  rgba(255, 255, 255, 0.18)
--accent-primary: #4F8CFF
--accent-primary-hover: #6EA1FF
--accent-success: #32D583
--accent-warning: #FDB022
--accent-danger:  #F97066
--accent-story:   #C79A43
--focus-ring:     rgba(79, 140, 255, 0.45)
```
Graphite/blue, never black/gold. Dark glass cards with readable text. Blue = action,
green = training/progress, gold = Story only, red = rare.

## Theme: Signal Light
```
--bg-page:        #F7F9FC
--bg-shell:       rgba(255, 255, 255, 0.88)
--bg-surface:     #FFFFFF
--bg-card:        rgba(255, 255, 255, 0.92)
--bg-card-hover:  #FFFFFF
--bg-elevated:    #FFFFFF
--text-primary:   #111827
--text-secondary: #344054
--text-muted:     #667085
--border-subtle:  rgba(16, 24, 40, 0.10)
--border-strong:  rgba(16, 24, 40, 0.18)
--accent-primary: #2563EB
--accent-primary-hover: #1D4ED8
--accent-success: #039855
--accent-warning: #DC6803
--accent-danger:  #D92D20
--accent-story:   #9A6A1F
--focus-ring:     rgba(37, 99, 235, 0.32)
```
Clean cool-white workspace (iOS/Google feel), not parchment. Crisp readable cards,
blue primary, green success, gold for Story/rewards only.

## How it is wired (implementation)
MIRROR carries layered CSS token generations. Signal is applied to **all of them** so the
whole app re-themes from the appearance toggle:

- **Nova shell** (`src/styles/mirrorNova.css`): `--nova-*` tokens, keyed on
  `html[data-ui-theme="dark"|"light"]`. Header, nav, popovers, appearance toggle, buttons.
- **Route content** (`src/styles/designSystem.css`):
  - `--mirror-*` and `--color-*` (`:root` = dark default, `html[data-ui-theme="light"]` override).
  - **Aura v2** `.app-shell-v2.ui-theme-dark` / `.ui-theme-light` — the most specific
    (active) layer; `--color-primary` now resolves to **blue**, `--bg-page` to the Signal
    neutrals, and legacy `--mirror-gold` accent usages resolve to blue. Genuine warmth lives
    in `--accent-gold` / `--mirror-warm` (Story/Kurukshetra only).
- Board-theme selection (Classic/Kurukshetra) affects **the board only** — the page-level
  `.theme-mahabharata` beige wash was removed.

## Type system
```
--font-ui:      -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
                "Segoe UI Variable", "Segoe UI", Roboto, Inter, system-ui, sans-serif;
--font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display",
                "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
--font-story:   "New York", "Iowan Old Style", Georgia, serif;
--font-mono:    "SFMono-Regular", "Cascadia Code", Consolas, monospace;
```
- UI, nav, buttons, analytics, cards → `--font-ui`.
- Page titles / brand → `--font-display` (sans; the previous serif title was removed).
- Story mission titles only → `--font-story`.
- Diagnostics / code values → `--font-mono`.
- No serif in nav, buttons, controls, or body.

Scale: body 16/1.55 · caption 13 · button 14/650 · card title 17/700 · section 22/720 ·
page title 44/760 desktop (32 mobile) · brand 26/760, letter-spacing 0.16em.

## Button system
| Variant | Background | Text | Use |
|---------|-----------|------|-----|
| Primary | blue | white | main action (44px, radius 14) |
| Secondary | card/surface | text-primary | subtle border, hover elevation |
| Ghost | transparent | text-secondary | soft hover |
| Success | green | dark | completed/progress/safe only |
| Story | gold/bronze (soft) | gold | Story / achievements / rewards only |
| Danger | soft red | red | destructive only |
| Selected | blue 20% | text-primary | blue border |

No beige buttons, no gold-everywhere, no gray "disabled-looking" active controls,
no raw links as actions.
