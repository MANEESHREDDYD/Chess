import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardView } from './BoardView';

type ChessboardMockProps = {
  position: string;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  onPromotionCheck: (sourceSquare: string, targetSquare: string, piece: string) => boolean;
  onPromotionPieceSelect: (piece?: string) => boolean;
  onSquareClick?: (square: string) => void;
};

const chessboardMock = vi.hoisted(
  (): { props: ChessboardMockProps | undefined } => ({ props: undefined })
);

vi.mock('react-chessboard', () => ({
  Chessboard: (props: ChessboardMockProps) => {
    chessboardMock.props = props;
    return <div data-testid="chessboard" data-position={props.position} />;
  },
}));

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

describe('BoardView promotion guard', () => {
  beforeEach(() => {
    chessboardMock.props = undefined;
    globalThis.ResizeObserver = ResizeObserverMock as never;
  });

  it('blocks promotion UI for non-pawn pieces even when a route allows promotion', () => {
    const routePromotionCheck = vi.fn(() => true);
    render(
      <BoardView
        fen="4k3/8/8/8/8/8/8/RNBQKBNR w KQ - 0 1"
        playerColor="white"
        status="playing"
        engineThinking={false}
        onPieceDrop={() => true}
        onPromotionCheck={routePromotionCheck}
        onPromotionPieceSelect={() => false}
        themeManifest={null}
      />
    );

    expect(chessboardMock.props?.onPromotionCheck('b1', 'b8', 'wN')).toBe(false);
    expect(chessboardMock.props?.onPromotionCheck('c1', 'c8', 'wB')).toBe(false);
    expect(chessboardMock.props?.onPromotionCheck('a1', 'a8', 'wR')).toBe(false);
    expect(chessboardMock.props?.onPromotionCheck('d1', 'd8', 'wQ')).toBe(false);
    expect(chessboardMock.props?.onPromotionCheck('e1', 'e2', 'wK')).toBe(false);
    expect(routePromotionCheck).not.toHaveBeenCalled();
  });

  it('passes the selected promotion piece through the normal drop path for legal pawn promotion', () => {
    const drops: Array<{ from: string; to: string; promotion?: string }> = [];
    render(
      <BoardView
        fen="4k3/P7/8/8/8/8/8/4K3 w - - 0 1"
        playerColor="black"
        status="playing"
        engineThinking={false}
        onPieceDrop={(from, to, promotion) => {
          drops.push({ from, to, promotion });
          return true;
        }}
        onPromotionCheck={() => true}
        onPromotionPieceSelect={() => false}
        themeManifest={null}
      />
    );

    act(() => {
      expect(chessboardMock.props?.onPromotionCheck('a7', 'a8', 'wP')).toBe(true);
    });
    act(() => {
      expect(chessboardMock.props?.onPromotionPieceSelect('wN')).toBe(true);
    });

    expect(drops).toEqual([{ from: 'a7', to: 'a8', promotion: 'n' }]);
  });

  it('clears stale pending promotion after the position changes', () => {
    const drops: Array<{ from: string; to: string; promotion?: string }> = [];
    const { rerender } = render(
      <BoardView
        fen="4k3/P7/8/8/8/8/8/4K3 w - - 0 1"
        playerColor="white"
        status="playing"
        engineThinking={false}
        onPieceDrop={(from, to, promotion) => {
          drops.push({ from, to, promotion });
          return true;
        }}
        onPromotionCheck={() => true}
        onPromotionPieceSelect={() => false}
        themeManifest={null}
      />
    );

    act(() => {
      expect(chessboardMock.props?.onPromotionCheck('a7', 'a8', 'wP')).toBe(true);
    });
    rerender(
      <BoardView
        fen="4k3/8/P7/8/8/8/8/4K3 w - - 0 1"
        playerColor="white"
        status="playing"
        engineThinking={false}
        onPieceDrop={(from, to, promotion) => {
          drops.push({ from, to, promotion });
          return true;
        }}
        onPromotionCheck={() => true}
        onPromotionPieceSelect={() => false}
        themeManifest={null}
      />
    );

    act(() => {
      expect(chessboardMock.props?.onPromotionPieceSelect('wQ')).toBe(false);
    });

    expect(drops).toEqual([]);
  });
});
