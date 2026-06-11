# MIRROR Nova — Design System

**Design language:** MIRROR Nova
**Style:** Premium AI chess operating system — “AI chess cockpit with Kurukshetra-inspired warmth.”
**Mood:** minimal · confident · futuristic · calm · high-trust · cinematic · useful.
**Status:** Foundation shipped & verified. Route migrations (Play/Story/Clue/Profile/Analytics/Mirror/Review/Import/Coach/Diagnostics) in progress.

This is MIRROR's own system. It adapts principles from best-in-class product design without copying any brand: Apple-level restraint and type clarity, Google-style adaptive theming with controlled expressive color, Microsoft-grade component consistency and accessibility, and Meta-style spatial depth on command surfaces.

## Where it lives

- **Tokens + component CSS:** [`src/styles/mirrorNova.css`](../src/styles/mirrorNova.css) — single source of truth, imported **after** `designSystem.css`/`global.css`.
- **Isolation rule:** every token is `--nova-*` prefixed and every class is `nova-*`. This guarantees zero collision with the 5,000+ lines of legacy CSS during migration (the collision was the root cause documented in the [failure audit](./apple-grade-frontend-failure-audit.md)). Legacy CSS is deleted per-route as routes migrate.
- **Components:** `src/components/ui/{icons,NovaButton,NovaPopover}.tsx`, `src/components/layout/{AppShell,AppHeader,AppNav,MoreMenu,BoardThemeMenu,AudioControl,AppearanceToggle}.tsx`.

## Theming

Appearance is keyed off `html[data-ui-theme="dark" | "light"]`, set by `AppShell` and persisted to `localStorage["mirror-ui-theme"]`. The legacy `data-mirror-ui-theme` + `.app-shell-v2.ui-theme-*` classes are kept only so not-yet-migrated routes keep their tokens during migration.

System appearance is intentionally **deferred** until both themes are perfect; the bottom toggle offers Dark/Light only.

## Font system

| Token | Stack | Use |
| --- | --- | --- |
| `--nova-font-ui` | -apple-system, BlinkMacSystemFont, "SF Pro Text/Display", "Segoe UI Variable", Segoe UI, Roboto, Inter, system-ui | All UI controls, nav, body |
| `--nova-font-display` | "New York", "Iowan Old Style", Georgia, "Times New Roman", serif | Brand wordmark, route/story titles **only** |
| `--nova-font-mono` | SFMono-Regular, "Cascadia Code", Consolas, monospace | Diagnostics / code |

Rules enforced: serif is never used for buttons, nav, or body paragraphs. No Apple font files are shipped (system stacks only).

**Type scale:** 12 / 14 / 16 / 18 / 22 / 28 / 36 / 52 / 64 px (`--nova-text-xs … --nova-text-5xl`).
**Weights:** 400 regular · 500 medium · 650 semibold · 760 bold.
**Line heights:** UI 1.1 · body 1.55 · headings 1.05 · cards 1.35.
**Letter spacing:** brand 0.26em · eyebrow 0.14em · nav −0.01em · body normal.

## Color system

Two complete palettes. Contrast rule: dark cards + ivory text in dark; ivory/white cards + dark text in light. No washed-out pair; no beige-on-beige.

### Dark — Obsidian Nova
page-bg `#05070d` · page-bg-2 `#090d16` · shell-bg `rgba(9,12,20,.86)` · surface-1/2/3 `rgba(255,255,255,.055/.082/.12)` · surface-solid `#111622` · text-1/2/3 `#f8f4eb / #d9cfbd / #a79b89` · border-1 `rgba(255,255,255,.10)` · border-2 `rgba(232,190,99,.32)` · gold-1/2/3 `#f2d28a / #c7953e / #7b5522` · blue-1/2 `#9fc4ff / #3478f6` · green-1/2 `#83e0a8 / #1f9d61` · red-1/2 `#ff7b86 / #d7374a` · warning `#ffcc66`.

### Light — Ivory Nova
page-bg `#f7f3ea` · page-bg-2 `#fffaf0` · shell-bg `rgba(255,251,242,.88)` · surface-1/2/3 `rgba(255,255,255,.72/.90/1)` · surface-solid `#fffbf3` · text-1/2/3 `#17130e / #4e4335 / #746855` · border-1 `rgba(58,43,24,.13)` · border-2 `rgba(153,103,38,.34)` · gold-1/2/3 `#9b661e / #c6923e / #f2d48d` · blue-1/2 `#245da8 / #0a66d8` · green-1/2 `#16794a / #0f8c52` · red-1/2 `#b42332 / #d92d45` · warning `#8f5f00`.

Primary buttons keep **dark, readable** text on a gold gradient in both modes. In light mode the gradient runs gold-3→gold-2 (bright enough that dark text stays high-contrast); in dark mode gold-1→gold-2.

## Surface & depth

**Radii:** sm 10 · md 14 · lg 20 · xl 28 · 2xl 36 · pill 999.
**Shadows:** soft `0 14px 40px /.18`, floating `0 24px 70px /.26`, board `0 30px 90px /.30`, gold `0 10px 30px rgba(199,149,62,.22)`.
**Surfaces:** `.nova-card` (glass, 1px border, 28px radius, soft shadow); `--strong`/`--solid`/`--selected`/`--interactive` modifiers. Shell uses glass + blur with a `surface-solid` `@supports` fallback. No huge dark overlays over text; no border-only “design”.

## Button system — `NovaButton`

Base: height md 44 / lg 52 / sm 36 / icon square; padding 0 18 (md); pill radius; `--nova-font-ui` 650–760 weight; 14px (md) / 16px (lg); letter-spacing −0.01em; inline-flex, gap 8, centered; 160ms ease; visible focus ring; active `scale(.99)`.

Variants: **primary** (gold gradient, dark text, gold shadow, hover lift), **secondary** (surface-2 → surface-3), **ghost** (transparent → surface-1), **danger** (red soft → solid red), **selected** (gold-soft surface + gold border + inner glow), **disabled** (opacity .45, no transform, not-allowed).

Never: gray browser-style buttons, serif button text, all-caps on large buttons, mismatched icon sizes.

## Icon system — `icons.tsx`

One inline-SVG family (no dependency): stroke-only, width 1.75, `currentColor`, sizes 16/18/20 only. Covers Play, Mirror, Story, Clue, Analytics, Profile, More, Import, Coach, Calibration, Diagnostics, Sun, Moon, ChevronDown, Volume, Mute, Board, Review, Warning, Success, Check, Lock, Info. No emoji / unicode for primary controls; More uses the dots icon, audio uses Volume/Mute, theme uses Sun/Moon.

## App shell & header

`.nova-header` is a **sticky, elevated stacking context** (z 100, `overflow: visible`) so popovers always paint above route content — this structurally fixes the “menu opens behind content” failure. Desktop: brand left · pill nav center · command cluster right (Board Theme · Audio · More) · height 84px (96 max). Mobile (≤900px): compact 64px top row, primary nav becomes a floating bottom pill bar (icon-only), More stays reachable.

## Popovers, More & Board Theme

`NovaPopover` mounts its panel **only when open** (never an always-present `hidden` node), with outside-`pointerdown` close, `Escape` close + focus return, and focus-into-panel on open. Both the **More** menu (Import/Coach/Calibration/About/Engine diagnostics) and **Board Theme** menu (Classic / Kurukshetra) are built on it; Board Theme reuses `settingsStore` so selection persists and the header chip + board update immediately. No native `<select>` exists anywhere in the header.

## Appearance toggle

`.nova-appearance` — fixed bottom-right (safe-area aware), pill with Dark (Moon) / Light (Sun) segments, selected segment highlighted with the gold gradient, `aria-label="Switch appearance"`, persists to `localStorage`, 180ms transition, z-index below popovers/modals and above content. On mobile it floats above the bottom nav; ≤480px it collapses to icon-only.

## Motion

Tokens: fast 140ms · standard 160ms · slow 180ms · ease `cubic-bezier(.2,0,0,1)`. Interactive cards lift `translateY(-2px)`; buttons press `scale(.99)`; nav/segments transition 160–180ms; popovers fade/scale 140ms; non-clickable cards do not animate. A global `@media (prefers-reduced-motion: reduce)` block nulls animations/transitions.

## Accessibility baseline

Visible focus rings on all interactive elements; `aria-expanded`/`aria-haspopup` on popover triggers; `role="menu"/"listbox"` + `aria-selected` in panels; icon-only controls carry `aria-label`s; mobile nav links keep accessible names even when labels are visually hidden.
