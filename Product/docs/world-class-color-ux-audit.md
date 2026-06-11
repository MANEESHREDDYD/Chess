# World-Class Color & UX Audit — M-WORLD-CLASS-COLOR-UX-SYSTEM-1

Design language: **MIRROR Signal** — a calm AI chess training operating system.

This document studies the product-design principles behind the companies whose
interfaces feel premium, then derives the rules MIRROR applies. We do not copy
any brand; we adopt the underlying discipline and build MIRROR's own identity.

## 1. Principles studied

### Apple / iOS
- Content first; chrome recedes so the work (the board) is the hero.
- Clarity and restraint — few colors, generous spacing, no decoration for its own sake.
- High-quality system typography (SF / Segoe); no shipped font files.
- Subtle material depth (translucency, soft shadows) instead of heavy skeuomorphism.
- Motion only to clarify interaction.

**MIRROR applies:** system font stacks, one accent, generous spacing, board-as-hero,
translucent surfaces, 120–180ms motion, `prefers-reduced-motion` respected.

### Google / Material
- Clear visual hierarchy and a strong type scale.
- Accessible color relationships and meaningful color *states* (hover/selected/focus).
- Action-focused components; adaptive layouts.

**MIRROR applies:** explicit type scale (Phase 5), token-driven hover/selected/focus
states, responsive grids verified across 7 viewports.

### Microsoft / Fluent
- Neutral palette first, brand color second.
- Clear, consistent focus states; calm productivity; comfortable density.

**MIRROR applies:** 60% neutral / 30% surface / 10% accent budget; one focus-ring
token per theme; consistent control system across every route.

### Meta / social products
- Fast recognition, low cognitive load, simple navigation.
- Sticky loops through clear "next action" affordances; familiar controls; emotional comfort.

**MIRROR applies:** six familiar primary nav tabs, "recommended next actions" cards,
familiar popover/menu patterns, comfortable long-session contrast.

### NVIDIA / high-performance product signal
- Dark, professional surfaces; a sharp accent used sparingly (their green = performance).
- Not neon everywhere.

**MIRROR applies:** graphite Signal Dark; green reserved as a *sharp* success/progress
accent, never a wash.

## 2. Color psychology adopted
- **Neutral backgrounds** reduce eye fatigue over long training sessions → 60% neutral base.
- **Blue** communicates trust, calm, intelligence, analysis → primary action color.
- **Green** communicates progress, correctness, growth → success/training accent.
- **Amber/gold** communicates reward and warmth → rare Story/Kurukshetra/achievement accent.
- **Red** is alarming → reserved for resign/blunder/engine-failure/destructive only.
- Too much gold/beige reads old and heavy; too much low-contrast dark is tiring; too many
  accents create chaos. The budget enforces discipline.

## 3. Reproduced issues (before)
The product carried **three overlapping CSS token generations** that had drifted gold/beige:

1. `--mirror-*` (route content) — gold accent, dark-only.
2. `--color-*` (second generation) — cream `--color-surface: #f7f2e8` (beige cards).
3. **Aura v2** `.app-shell-v2.ui-theme-dark/light` (most specific, active shell layer) —
   set `--color-primary: var(--accent-gold)` (gold primary CTAs) and, in light,
   `--bg-page: #f7f2e8` (full beige page wash). The winning `.ui-button--primary` was a
   **gold gradient**, and page titles used a **serif** `--font-display`.

Net effect: gold primary buttons everywhere, beige/parchment light theme, decorative
gold borders/glows, serif titles — exactly the "beige fantasy / heavy gold skin" the
milestone forbids.

## 4. Root cause
Premium feel was lost not to layout but to **palette discipline**: gold was used as the
*primary* identity instead of a *rare accent*, light theme was parchment, and the accent
budget was unbounded. The fix is a token-level reskin, applied to **all three generations
plus the nova shell**, to neutral-first + blue primary + green success, with gold demoted
to a rare Story accent — in both a true Signal Dark and a true Signal Light theme.

See `mirror-signal-color-system.md` for the exact palette and `world-class-color-ux-scorecard.md`
for the route-by-route result.
