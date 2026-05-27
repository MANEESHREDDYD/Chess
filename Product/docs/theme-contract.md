# Theme Contract

This document defines the manifest contract for non-standard board themes.

## Scope

- Theme assets live under `Product/public/themes/<id>/`.
- The manifest lives at `Product/public/themes/<id>/theme.json`.
- `standard` is built in and does not require a manifest file.
- Consumers must treat `standard` as the default react-chessboard theme with no custom assets.

## Manifest shape

```json
{
  "id": "kurukshetra",
  "name": "Kurukshetra",
  "pieces": {
    "wP": "pieces/pandava-pawn-512.png",
    "wR": "pieces/pandava-rook-512.png",
    "wN": "pieces/pandava-knight-512.png",
    "wB": "pieces/pandava-bishop-512.png",
    "wQ": "pieces/pandava-queen-512.png",
    "wK": "pieces/pandava-king-512.png",
    "bP": "pieces/kaurava-pawn-512.png",
    "bR": "pieces/kaurava-rook-512.png",
    "bN": "pieces/kaurava-knight-512.png",
    "bB": "pieces/kaurava-bishop-512.png",
    "bQ": "pieces/kaurava-queen-512.png",
    "bK": "pieces/kaurava-king-512.png"
  },
  "board": {
    "lightSquare": "#hex",
    "darkSquare": "#hex",
    "background": "board/earth.png"
  },
  "fx": {
    "capture": {
      "dir": "fx/dissolve/",
      "frames": 16,
      "fps": 24
    }
  }
}
```

## Rules

- All asset paths are relative to `Product/public/themes/<id>/`.
- `pieces` must define all 12 standard chess piece slots.
- `board.background` must point to a single board background image.
- `fx.capture` is optional for theme consumers, but if present it must describe a dissolving capture sequence.
- Theme consumers should not infer any game logic from the manifest.

## Ownership

- Track A owns this contract.
- Track B must conform to it when producing assets and `theme.json`.