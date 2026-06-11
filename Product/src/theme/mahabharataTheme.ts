import type { ThemeManifest, PieceKey } from '../lib/theme';

function createSvgDataUri(svgContent: string): string {
  // Replace newlines and encode for data URI
  const encoded = encodeURIComponent(svgContent.trim());
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

const PANDAVA_COLOR = '#fef5e7';
const PANDAVA_BORDER = '#bfa15f';
const KAURAVA_COLOR = '#3a1313';
const KAURAVA_BORDER = '#1a0505';

function getPandavaPieceSvg(glyph: string): string {
  return createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M 15,15 L 85,15 L 85,45 C 85,80 50,95 50,95 C 50,95 15,80 15,45 Z" fill="${PANDAVA_COLOR}" stroke="${PANDAVA_BORDER}" stroke-width="6" stroke-linejoin="round"/>
  <text x="50" y="68" font-size="55" font-family="Arial, sans-serif" text-anchor="middle" fill="#333">${glyph}</text>
</svg>
  `);
}

function getKauravaPieceSvg(glyph: string): string {
  return createSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="42" fill="${KAURAVA_COLOR}" stroke="${KAURAVA_BORDER}" stroke-width="6"/>
  <text x="50" y="68" font-size="55" font-family="Arial, sans-serif" text-anchor="middle" fill="#f0d9b5">${glyph}</text>
</svg>
  `);
}

// Using outline glyphs for white, solid glyphs for black for extra clarity
const glyphs: Record<PieceKey, { side: 'w'|'b', glyph: string }> = {
  wP: { side: 'w', glyph: '♙' },
  wR: { side: 'w', glyph: '♖' },
  wN: { side: 'w', glyph: '♘' },
  wB: { side: 'w', glyph: '♗' },
  wQ: { side: 'w', glyph: '♕' },
  wK: { side: 'w', glyph: '♔' },
  bP: { side: 'b', glyph: '♟' },
  bR: { side: 'b', glyph: '♜' },
  bN: { side: 'b', glyph: '♞' },
  bB: { side: 'b', glyph: '♝' },
  bQ: { side: 'b', glyph: '♛' },
  bK: { side: 'b', glyph: '♚' },
};

const pieces = Object.fromEntries(
  Object.entries(glyphs).map(([key, data]) => [
    key,
    data.side === 'w' ? getPandavaPieceSvg(data.glyph) : getKauravaPieceSvg(data.glyph)
  ])
) as Record<PieceKey, string>;

export const mahabharataManifest: ThemeManifest = {
  id: 'mahabharata',
  name: 'Kurukshetra',
  pieces,
  board: {
    // Mono Signal restraint: warm tones live ONLY in the board squares and are
    // desaturated sand/clay, not rust red, so Kurukshetra never dominates the
    // monochrome app shell around it.
    lightSquare: '#dcc9a3', // Restrained sand
    darkSquare: '#967052',  // Restrained clay
    background: '', // We can use a CSS class or data URI for the background, but for now we'll just leave it empty or use CSS directly
  },
  fx: {
    capture: {
      dir: 'pulse', // We will implement this programmatically
      frames: 1,
      fps: 30,
    }
  }
};
