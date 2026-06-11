# Kurukshetra Battlefield Mode — 3D Visual Specification

Milestone: M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1

## Stack

- `three` + `@react-three/fiber` (+ `@react-three/drei` where useful)
- glTF/GLB **local** assets only (none shipped yet) + **procedural low-poly fallback
  assets built in code** (current state)
- Stable 2D board fallback (`BoardView`) for no-WebGL / reduced-motion / mobile / errors
- Lazy-loaded: three never enters the main bundle; 2D users pay zero cost

## Target quality bar (user-provided references, 2026-06-11)

The user's reference imagery shows AAA-grade Mahabharata-era units: a realistic archer
warrior (leather cuirass, dhoti, recurve bow, quiver), horse archers, war-elephant archers,
minister's and king's war chariots — full PBR materials, grounded lighting, cinematic
presentation — plus PUBG-style impact feedback on captures (non-gory in MIRROR, always) and
a believable battleground.

**What this requires (and why it is not in this milestone):** that bar is reached with
licensed or commissioned **rigged, animated glTF/GLB character models** and PBR texture
sets — they are *assets*, not code. No license-clean source for that quality is available
in-repo today, and the milestone forbids unlicensed/copyrighted models. The renderer,
animation system, board mapping, fallback, and asset-manifest pipeline shipped in this
milestone are deliberately built so those models can be dropped in (`assetManifest.ts` +
`assets/3d/asset-manifest.json`) without reworking the scene. Until then the battlefield
runs the documented procedural placeholder set below.

## Honesty statement

The current implementation is a **procedural low-poly battlefield placeholder**: stylized
soldiers, cavalry, chariots, commanders, rocks, trees, and banners built from primitive
geometry with hand-tuned materials. It is documented as such everywhere. It must NOT be
described as a realistic battlefield until licensed/authored models replace the procedural
set and screenshots prove the quality bar.

## Environment

- Sand ground plane with warm dust tones (sand/clay lives ONLY inside the 3D scene/board)
- Uneven terrain feel at the edges (displaced ring), rocks near board corners
- Sparse low-poly trees; tall banner poles with Pandava (blue) / Kaurava (maroon) cloth
- Distant camp silhouettes (low boxes/tents) on the horizon line, soft fog
- Soft dust particles drifting; cinematic directional sunlight + hemisphere fill; subtle
  contact shadows
- The 8×8 grid must stay instantly readable; scenery never occludes squares

## Board

- 8×8 board embedded in the ground; alternating restrained sand/clay squares
- Selected square: glowing halo ring (blue)
- Legal moves: small rings on empty squares, larger ring on capture squares
- Last move: soft blue tint on from/to squares
- Check: pulsing red ring under the checked king
- Checkmate: light focus + result overlay (DOM layer, not 3D text)

## Piece identity

| Chess role | Battlefield identity | Procedural silhouette |
| --- | --- | --- |
| Pawn | foot soldier | body + head + round shield (spear stub) |
| Knight | horse cavalry | horse neck/head arc on a base |
| Bishop | advisor / standard bearer | robed cone + staff with pennant |
| Rook | chariot / war tower | hull + four wheels + tower |
| Queen | commander | tall robed figure + shoulder mantle + small crown ring |
| King | royal commander | tallest figure + standard (flag) + crown |

- Pandava/white: ivory + steel materials, subtle blue cloth accents
- Kaurava/black: graphite + blackened-metal materials, subtle maroon cloth accents
- Readability beats realism: roles must be identifiable at a glance from the default camera
- Elephants/horses/extra chariots may appear as edge props; they never sit on the board

## Weapons & props (procedural now, asset-ready later)

Shields, spears, staffs/banners, chariot wheels, rocks, trees, camp silhouettes, boundary
markers. Future licensed assets may add bows, maces (gada), swords, drums — each must be
listed in `Product/assets/3d/asset-manifest.json` before use.

## Movement

- Pawn/bishop/queen/king: smooth glide (ease-out), 180–250ms
- Knight: small parabolic leap arc
- Rook/chariot: heavy linear glide (slight start/stop weight)
- Captured piece: dissolve/fade into a dust puff, 300–450ms, no gore
- No animation may block input for longer than its duration; chess always stays fast

## Effects

- Capture: dust burst + quick flash + fade-out. No blood, no dismemberment, ever.
- Check: king-square pulse; optional low audio cue through the existing audio system
- Checkmate: brightness focus on the king + DOM result banner
- Kids mode (Clue) inherits reduced intensity automatically via shorter/softer effects

## Cultural treatment

Mahabharata-era inspiration is handled respectfully: martial iconography only, no sacred
imagery as decoration, no religious parody, names used descriptively (Pandava/Kaurava sides).

## Performance budget

- Desktop 55–60 FPS, laptop 45+; shared geometries/materials (module-level caches)
- No scene remount per move; piece meshes animate in place
- Mobile (<900px) defaults to 2D; reduced-motion forces 2D/static
- All assets local; **no external CDN**; procedural set adds ~0 bytes of binary assets
- Dispose of geometries/materials on unmount; lazy chunk keeps main bundle clean

## Authority

3D owns NOTHING about chess. It renders FEN, raycasts square clicks, and calls the same
legal-move pipeline (`gameStore.makePlayerMove` → chess.js). Game state remains in
`gameStore`/`BoardView` land; promotion in 3D auto-queens (documented limitation) until the
3D promotion picker ships.
