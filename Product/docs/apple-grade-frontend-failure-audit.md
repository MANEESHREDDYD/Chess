# Apple-Grade Frontend Failure Audit

Milestone: **M-APPLE-GRADE-FRONTEND-RESTART-1**
Design language being introduced: **MIRROR Nova**
Date: 2026-06-10
Base: current working tree after the attempted premium UI work (treated as failed WIP). v1.19.8 is **not** tagged and must not be tagged until this milestone passes.

This audit is grounded in the actual source, with `file:line` references. It is the gate for Phases 2-24. Nothing downstream proceeds until the root causes below are understood.

---

## 0. Executive summary

The frontend does not feel premium and several controls do not work because the styling layer is **three or four overlapping generations of CSS stacked on top of each other** with duplicate selectors, dead rules, and four competing token systems. The React logic for the menus is actually mostly correct; the failures are in the cascade and in stacking/containment, plus one genuine markup violation (a native `<select>` left in the header).

| Symptom (user-reported) | Root cause | Layer |
| --- | --- | --- |
| 1. More button "does not work" | Popover opens in state, but renders **behind route content** (stacking) and competes with 3 conflicting `.app-nav-v2__secondary` rules | CSS cascade + stacking |
| 2. Board Theme "does not work" | Same stacking problem **plus** a real native `<select>` left in the header DOM | CSS stacking + markup |
| 3. Buttons inconsistent | `ui-button` + 5 hand-rolled control styles spread across 3 CSS generations | CSS |
| 4. Icons look random/basic | **No icon library**; "icons" are CSS pseudo-element shapes + a unicode `+` | Markup |
| 5/6. Not premium / styled-not-designed | No single design system; 4 token sets fighting | CSS tokens |
| 7. Controls present but unreliable | Decorative fallbacks (native select, `+` glyph) | Markup |
| 8. Light theme beige/flat | `tokens.css` parchment palette bleeds in under the light theme | CSS tokens |
| 9. Header weak | One-row brand+nav+toolbar, border-only styling, text audio button + range slider | Layout |

**Resolution strategy:** hard reset. Introduce `mirrorNova.css` as a single new token + surface system, rebuild the shell/header/nav and the broken controls with new non-colliding `nova-*` classes and a real inline-SVG icon system, and progressively migrate routes. Legacy classes stay only until each route is migrated, then their CSS is removed.

---

## 1. Why the More button does not work

File: [AppNav.tsx](../src/components/layout/AppNav.tsx) + [designSystem.css](../src/styles/designSystem.css)

The React is fine: `AppNav` ([AppNav.tsx:20-90](../src/components/layout/AppNav.tsx#L20-L90)) toggles `isMoreOpen`, registers outside-`pointerdown` + `Escape` handlers, and renders the panel with `hidden={!isMoreOpen}`. Clicking the button **does** flip the attribute. The panel still doesn't appear usefully because of two CSS faults:

1. **Stacking — the panel opens behind the page.** `.app-nav-v2__secondary` is `position:absolute; z-index:var(--z-dropdown)` (=80) at [designSystem.css:2873-2887](../src/styles/designSystem.css#L2873-L2887). It lives inside `.app-header-v2`, which sets `backdrop-filter: blur(...)` at [designSystem.css:2769-2775](../src/styles/designSystem.css#L2769-L2775). `backdrop-filter` **creates a stacking context** on the header, so the panel's `z-index:80` is confined *inside the header's context*. The header itself has no elevation over `.app-main-v2`, and main content comes later in the DOM, so the route content (cards, board) paints **on top of** the dropdown where it overhangs into the page. Net effect: the menu "opens" but is covered.
2. **Three conflicting definitions of the same selector.** `.app-nav-v2__secondary` is declared as an inline flex row at [:275](../src/styles/designSystem.css#L275) (`display:flex; overflow-x:auto`), then as an absolute grid popover at [:1481](../src/styles/designSystem.css#L1481), then again at [:2873](../src/styles/designSystem.css#L2873). All have equal specificity (`0,1,0`), so the cascade is decided purely by source order and is fragile. Leftover `overflow-x:auto` from the first definition still applies to the popover.

There are also **dead rules** from a previous `<details>/<summary>` implementation — `.app-nav-v2__more summary`, `.app-nav-v2__more[open] summary`, `summary::-webkit-details-marker` at [:1439-1479](../src/styles/designSystem.css#L1439-L1479). The current JSX uses a `<button>`, so these never match and just add noise.

**Fix:** rebuild as `MoreMenu` on a real `NovaPopover` with a header that is an elevated sticky stacking context (`position:sticky; z-index` above main), `overflow:visible`, a single source of truth in `mirrorNova.css`, and no dead `<details>` CSS.

## 2. Why the Board Theme control does not work

File: [AppHeader.tsx:65-146](../src/components/layout/AppHeader.tsx#L65-L146)

Two faults:

1. **Same stacking bug.** `.app-board-theme__menu` is `position:absolute; z-index:80` ([designSystem.css:2967-2981](../src/styles/designSystem.css#L2967-L2981)) inside the same `backdrop-filter` header, so it also opens behind route content.
2. **A real native `<select>` is left in the header.** [AppHeader.tsx:111-123](../src/components/layout/AppHeader.tsx#L111-L123) renders a `<select className="app-board-theme__native-fallback">` next to the custom button. It is shrunk to 1px and `opacity:0` via [designSystem.css:2957-2965](../src/styles/designSystem.css#L2957-L2965), but it is still a native select in the header DOM — a direct violation of the milestone rule "no native select controls in the header," and a second click target competing with the custom popover.

Note the control is wired correctly to state — selecting calls `setActiveTheme` ([AppHeader.tsx:94-97](../src/components/layout/AppHeader.tsx#L94-L97)), which writes to `settingsStore` (persisted under `mirror-settings`, [settingsStore.ts:15-34](../src/state/settingsStore.ts#L15-L34)). The data path is sound; the presentation is broken.

**Fix:** rebuild as `BoardThemeMenu` on `NovaPopover`, delete the native `<select>`, reuse `settingsStore.setActiveTheme` so persistence is preserved, and ensure the header chip label updates from the same store value.

## 3. Why the current buttons look inconsistent

The app has **one** `Button` component ([Button.tsx](../src/components/ui/Button.tsx)) but **at least five hand-rolled control styles** beside it, each with different heights/paddings/radii/typography:

- nav links / more-button: `min-height:34px`, font `13px/760` ([:2824-2846](../src/styles/designSystem.css#L2824-L2846))
- board-theme button: `min-height:40px`, two-line grid ([:2928-2955](../src/styles/designSystem.css#L2928-L2955))
- appearance toggle buttons: `min-height:34px`, font `12px/760` ([:3025-3039](../src/styles/designSystem.css#L3025-L3039))
- audio toggle: a `Button` rendering the **text** "Audio on" / "Audio off" ([AppHeader.tsx:36-45](../src/components/layout/AppHeader.tsx#L36-L45)) instead of an icon
- the `ui-button` styles themselves are defined across multiple generations of the file

Result: no two clickable things share a height, radius, weight, or focus treatment.

**Fix:** one `NovaButton` with fixed sizes (`md`/`lg`), variants (primary/secondary/ghost/danger/selected), one focus ring, used everywhere.

## 4. Why the icons look wrong

There is **no icon library** in `package.json` ([package.json:20-51](../package.json#L20-L51) — no `lucide-react`, no `@heroicons`, nothing). The "icons" today are:

- The More affordance is a unicode `+` in a circle ([AppNav.tsx:62](../src/components/layout/AppNav.tsx#L62) styled at [:2862-2871](../src/styles/designSystem.css#L2862-L2871)).
- The appearance toggle moon/sun/system are **CSS pseudo-element shapes** (`::before`/`::after`) at [:3057-3088](../src/styles/designSystem.css#L3057-L3088).
- The audio control is plain text.

These don't share stroke width, sizing, or optical alignment, so they read as "random/basic."

**Fix:** a single inline-SVG icon set (`icons.tsx`) — consistent `1.75` stroke, sizes 16/18/20, `currentColor`, covering Play, Mirror, Story, Clue, Analytics, Profile, More, Import, Coach, Calibration, Diagnostics, Sun, Moon, ChevronDown, Volume, Mute, Board, Review, Warning, Success.

## 5. Why the header still feels weak

[AppHeader.tsx:25-62](../src/components/layout/AppHeader.tsx#L25-L62) packs brand + full nav + a "CommandBar" (Local-first chip, board-theme combo, text audio button, **range slider**) into one row. Styling is border-led ([:2769-2855](../src/styles/designSystem.css#L2769-L2855)) with no clear command hierarchy, and a raw `<input type=range>` for volume sits in the chrome. It reads as a toolbar, not a product shell.

**Fix:** a compact (84px) header — brand left, pill nav center, command cluster right (board-theme, audio icon button, More), volume tucked inside the audio popover, single elevated stacking context.

## 6. Why Clue / Story / Play do not feel premium

- **Four token systems collide.** `tokens.css` defines a **serif parchment** system (`--font-display:'Cormorant Garamond'`, `--font-body:'Lora'`, `--bg:#f5f0e6`) at [tokens.css:34-61](../src/styles/tokens.css#L34-L61). `designSystem.css` then defines a gen-1 `:root` ([:19-62](../src/styles/designSystem.css#L19-L62)) and a gen-3 Apple-style dark/light pair ([:2591-2727](../src/styles/designSystem.css#L2591-L2727)). Routes pull from a mix, so contrast and type are unpredictable.
- **Light theme is beige/flat** because the parchment `--bg`/`--paper` tokens and warm light tokens stack with low-contrast text — the milestone calls this out explicitly (clue cards = beige text on beige cards).
- The routes are styled with bespoke per-route CSS rather than shared surface/typography primitives, so each looks "decorated" rather than "designed."

**Fix:** Phases 12-17 rebuild each route on the Nova hero/card/button/surface primitives with the exact Obsidian (dark) / Ivory (light) palettes and contrast rules.

## 7. Controls that are decorative but not functional / unreliable

- Native `<select>` fallback in the header — decorative (1px, opacity 0) and a markup violation ([AppHeader.tsx:111-123](../src/components/layout/AppHeader.tsx#L111-L123)).
- More `+` glyph — decorative unicode, not an icon ([AppNav.tsx:62](../src/components/layout/AppNav.tsx#L62)).
- Pseudo-element sun/moon/system icons — decorative CSS, inconsistent ([:3057-3088](../src/styles/designSystem.css#L3057-L3088)).
- Both popovers are functionally wired but visually fail (open behind content) — present but unreliable.

## 8. CSS / components that must be deleted or replaced

**Delete (markup):**
- Native `<select>` in [AppHeader.tsx:111-123](../src/components/layout/AppHeader.tsx#L111-L123).
- Unicode `+` affordance in [AppNav.tsx:62](../src/components/layout/AppNav.tsx#L62).

**Delete / supersede (CSS):**
- Dead `<details>/<summary>` rules: [designSystem.css:1439-1479](../src/styles/designSystem.css#L1439-L1479).
- Duplicate `.app-nav-v2__secondary` / `.app-header-v2` / `.app-nav-v2` generations: [:266-323](../src/styles/designSystem.css#L266-L323), [:1374-1520](../src/styles/designSystem.css#L1374-L1520).
- Header/nav/board-theme/appearance blocks superseded by Nova: [:2769-3088](../src/styles/designSystem.css#L2769-L3088).
- Serif UI fonts in [tokens.css:34-37](../src/styles/tokens.css#L34-L37) (serif is allowed for brand/story display only, never UI/body/buttons/nav).

**Replace (components):**
- `AppHeader`, `AppNav`, `AppShell` (shell rebuild).
- `Button` → `NovaButton` (new, additive).
- New: `icons.tsx`, `NovaPopover`, `MoreMenu`, `BoardThemeMenu`, `AppearanceToggle`, `NovaHero`.

**Migration safety:** `mirrorNova.css` is imported **after** `designSystem.css`/`global.css`, new components use non-colliding `nova-*` classes, and the shell keeps `app-shell-v2 ui-theme-*` classes until every route is migrated so legacy route tokens keep resolving. Legacy CSS is removed per route as routes are rebuilt.

## 9. Routes affected

All routes share the shell, so all are affected by the header/nav/toggle fixes. Routes needing full visual rebuilds (Phases 12-17):

| Route | File | Phase |
| --- | --- | --- |
| /play | [Play.tsx](../src/routes/Play.tsx) | 12 |
| /clue-chess | [ClueChess.tsx](../src/routes/ClueChess.tsx) | 13 |
| /story | [Story.tsx](../src/routes/Story.tsx) | 14 |
| /progress (Profile) | [Progress.tsx](../src/routes/Progress.tsx) | 15 |
| /analytics | [AnalyticsDashboard.tsx](../src/routes/AnalyticsDashboard.tsx) | 16 |
| /mirror | [Mirror.tsx](../src/routes/Mirror.tsx) | 17 |
| /review/:type/:id | [GameReview.tsx](../src/routes/GameReview.tsx) | 17 |
| /import-pgn | [PgnImport.tsx](../src/routes/PgnImport.tsx) | 17 |
| /coach-preview | [CoachPreview.tsx](../src/routes/CoachPreview.tsx) | 17 |
| /stockfish-diagnostics | [StockfishDiagnostics.tsx](../src/routes/StockfishDiagnostics.tsx) | 17 |

---

## 10. Conclusion — root causes documented

The frontend's problems are **systemic CSS debt** (3-4 overlapping generations, 5000+ lines across `tokens.css`/`global.css`/`designSystem.css`, duplicate selectors, dead rules, four token systems) plus **one markup violation** (native select) and **fragile popover stacking**. The interaction logic is largely correct; the presentation layer is the failure. A hard reset to a single MIRROR Nova system — not another patch layer — is the correct path. Phases 2-24 may proceed.
