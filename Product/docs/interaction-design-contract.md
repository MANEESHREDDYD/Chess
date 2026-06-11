# MIRROR — Interaction Design Contract

Milestone: M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1

## Buttons

| Variant | Look | Use |
| --- | --- | --- |
| Primary | blue bg, white text, 14px radius, 44px height | the one main action per view |
| Secondary | monochrome card surface, subtle border | supporting actions |
| Ghost | transparent, soft gray hover | tertiary/quiet actions |
| Danger | red, only resign/delete/failure | destructive |
| Success | green, only solved/completed/safe | confirmation of progress |
| Story | bronze/gold tint, ONLY Story/rewards | rare reward accent |

Every button must respond on hover (≤120ms), show a visible focus ring, and render a clear
disabled state. Buttons never look like default browser buttons and never use random colors.
Classes: `ui-button--*` / `nova-btn--*` (legacy `.btn*` is remapped by the mono layer).

## Icons

One inline-SVG system (`src/components/ui/icons.tsx`): stroke-only, width 1.75, round
caps/joins, `currentColor`, sizes 16/18/20 only. No emoji, no raw plus signs, no mixed sets.
Required set (all present): Play, Mirror, Story, Clue, Analytics, Profile, More (dots),
ChevronDown, Board theme, Audio (volume/mute), Sun, Moon, Import, Coach, Calibration,
Diagnostics, Review, Warning, Check, Lock.

## Navigation

- 64px command bar: brand left (single line, 0.16em tracking), quiet text tabs center with
  blue active state, compact 36px triggers right (Board Theme, Audio, More).
- More menu: custom popover; chevron/dots icon; outside click + Escape close; menu items
  navigate; keyboard: Tab/Enter, focus visible.
- Board Theme: custom popover listbox (Classic / Kurukshetra); selection updates the board
  and the trigger chip immediately; persists to localStorage.
- Appearance: ONE icon-only fixed bottom-right switch showing the theme you can switch TO
  (moon in light, sun in dark). aria-label + title carry the text.
- Mobile: pill bottom nav (icon-only) + same right-side triggers; no horizontal overflow.

## Motion

| Interaction | Duration |
| --- | --- |
| Button hover | 120ms |
| Card hover | 160ms |
| Popover open | 140ms |
| Nav active state | 160ms |
| Theme toggle | 180ms |
| Board move | 180–250ms (180ms 2D default) |
| 3D capture effect | 300–450ms |

No bounce, no excessive glow, no slow cinematic animation during normal play.
`prefers-reduced-motion` collapses all of the above to near-zero and switches the 3D mode
to its static/2D fallback.

## Accessibility

Keyboard nav for every control; visible focus rings (`--focus-ring`); Escape closes all
popovers; modal promotion dialog traps focus; aria labels on all icon-only buttons;
no color-only meaning (status chips always carry text); contrast follows the Mono palette
(AA for text on both themes).
