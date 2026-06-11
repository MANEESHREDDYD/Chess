/**
 * MIRROR Apple Mono guards (M-MIRROR-FULL-FRONTEND-3D-BATTLEFIELD-EXPECTATION-LOOP-1).
 *
 * 1. The chessboard is hosted inside a `.board-stage` node whose width is
 *    CSS-determined (the stable measurement target that prevents the board
 *    resize feedback loop that cropped/overflowed the board).
 * 2. The Classic board uses tournament-neutral squares, not brown/parchment.
 * 3. The app header is a minimal command bar (no status-chip noise, no
 *    two-row brand block, no native select).
 * 4. Token lint: no beige/warm-ivory hardcoded surfaces remain in the style
 *    layers, and primary buttons resolve to the blue accent, never gold.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from '../components/layout/AppHeader';
import { BoardView } from '../components/Board/BoardView';

// Read style layers from disk: vitest's CSS pipeline intercepts even `?raw`
// imports and returns empty modules, which would make these guards vacuous.
const stylesDir = path.resolve(__dirname, '../styles');
const readCss = (file: string) => readFileSync(path.join(stylesDir, file), 'utf8');
const monoCss = readCss('mirrorAppleMono.css');
const designSystemCss = readCss('designSystem.css');
const globalCss = readCss('global.css');
const novaCss = readCss('mirrorNova.css');
const tokensCss = readCss('tokens.css');

type ChessboardMockProps = {
  customDarkSquareStyle?: { backgroundColor?: string };
  customLightSquareStyle?: { backgroundColor?: string };
};

const chessboardMock = vi.hoisted(
  (): { props: ChessboardMockProps | undefined } => ({ props: undefined })
);

vi.mock('react-chessboard', () => ({
  Chessboard: (props: ChessboardMockProps) => {
    chessboardMock.props = props;
    return <div data-testid="chessboard" />;
  },
}));

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as never;

function renderBoardView() {
  return render(
    <BoardView
      fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      playerColor="white"
      status="playing"
      engineThinking={false}
      onPieceDrop={() => true}
      onPromotionCheck={() => true}
      onPromotionPieceSelect={() => false}
      themeManifest={null}
    />
  );
}

describe('board stage (Phase 4)', () => {
  it('hosts the chessboard inside a .board-stage measurement node', () => {
    const { container } = renderBoardView();
    const stage = container.querySelector('.board-stage');
    expect(stage).not.toBeNull();
    expect(stage?.querySelector('.board-frame')).not.toBeNull();
    expect(stage?.querySelector('[data-testid="chessboard"]')).not.toBeNull();
  });
});

describe('classic board colors (Phase 9)', () => {
  it('uses tournament-neutral squares, not brown/parchment', () => {
    renderBoardView();
    const dark = chessboardMock.props?.customDarkSquareStyle?.backgroundColor ?? '';
    const light = chessboardMock.props?.customLightSquareStyle?.backgroundColor ?? '';
    expect(dark.toLowerCase()).toBe('#a8b4c0');
    expect(light.toLowerCase()).toBe('#e8eaed');
    // Regression guard: the old brown defaults must not return.
    expect([dark, light]).not.toContain('#6f4c33');
    expect([dark, light]).not.toContain('#eadfc8');
  });
});

describe('minimal command bar (Phase 5)', () => {
  const headerProps = {
    activeTheme: 'standard',
    setActiveTheme: vi.fn(),
    audioEnabled: false,
    setAudioEnabled: vi.fn(),
    audioVolume: 0.5,
    setAudioVolume: vi.fn(),
  };

  it('has no status-chip noise, no two-row brand, and no native select', () => {
    const { container } = render(
      <MemoryRouter>
        <AppHeader {...headerProps} />
      </MemoryRouter>
    );
    expect(screen.queryByText('Local-first')).toBeNull();
    expect(container.querySelector('.nova-brand__sub')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
  });
});

describe('token lint (Phase 11)', () => {
  const layers: Array<[string, string]> = [
    ['mirrorAppleMono.css', monoCss],
    ['designSystem.css', designSystemCss],
    ['global.css', globalCss],
    ['mirrorNova.css', novaCss],
  ];

  it('no warm-ivory/beige hardcoded surfaces remain in any style layer', () => {
    for (const [file, css] of layers) {
      expect(css, `${file} must not use warm ivory rgba(255, 248, 232)`).not.toMatch(/rgba\(\s*255,\s*248,\s*232/);
      expect(css, `${file} must not use warm ivory rgba(255, 250, 240)`).not.toMatch(/rgba\(\s*255,\s*250,\s*240/);
      expect(css, `${file} must not use the beige page wash`).not.toMatch(/#ebe4d4|#e8dfcf|#f5f0e6/i);
    }
  });

  it('primary buttons resolve to the blue accent, never gold', () => {
    const primaryBlock = monoCss.match(
      /\.ui-button--primary,\s*\.btn-primary,\s*\.nova-btn--primary\s*\{[^}]+\}/
    )?.[0];
    expect(primaryBlock).toBeTruthy();
    expect(primaryBlock).toContain('var(--accent-primary)');
    expect(primaryBlock).not.toMatch(/gold|#b8872f|#8a5a16/i);
  });

  it('the board theme class no longer warms the app shell', () => {
    const mahabharata = tokensCss.match(/\.theme-mahabharata\s*\{[^}]*\}/)?.[0] ?? '';
    expect(mahabharata).not.toMatch(/#c8a379|#dac4a8|--rule/);
  });
});
