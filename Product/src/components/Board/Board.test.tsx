import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from './Board';

type Color = 'white' | 'black';
type Status = 'idle' | 'playing' | 'game-over';
type Promotion = 'q' | 'r' | 'b' | 'n';

type BoardStoreState = {
  fen: string;
  playerColor: Color;
  status: Status;
  engineThinking: boolean;
  makePlayerMove: (from: string, to: string, promotion?: Promotion) => boolean;
};

type PlayerMove = {
  from: string;
  to: string;
  promotion?: Promotion;
};

type MockChessboardProps = {
  position: string;
  boardOrientation: Color;
  boardWidth: number;
  arePremovesAllowed: boolean;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
};

const storeMock = vi.hoisted(
  (): { moves: PlayerMove[]; state: BoardStoreState } => ({
    moves: [],
    state: {
      fen: 'start-fen',
      playerColor: 'white',
      status: 'idle',
      engineThinking: false,
      makePlayerMove: () => false,
    },
  })
);

const chessboardMock = vi.hoisted(
  (): { props: MockChessboardProps | undefined } => ({ props: undefined })
);

vi.mock('../../state/gameStore', () => ({
  useGameStore: <T,>(selector: (state: BoardStoreState) => T): T => selector(storeMock.state),
}));

vi.mock('react-chessboard', () => ({
  Chessboard: (props: MockChessboardProps) => {
    chessboardMock.props = props;
    return (
      <div
        data-testid="chessboard"
        data-position={props.position}
        data-orientation={props.boardOrientation}
        data-width={props.boardWidth}
      />
    );
  },
}));

function renderBoard(): MockChessboardProps {
  chessboardMock.props = undefined;
  renderToStaticMarkup(<Board />);
  const props = chessboardMock.props;
  if (!props) {
    throw new Error('Board did not render the chessboard mock');
  }
  return props;
}

describe('Board', () => {
  beforeEach(() => {
    storeMock.moves.length = 0;
    storeMock.state = {
      fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      playerColor: 'white',
      status: 'playing',
      engineThinking: false,
      makePlayerMove: (from, to, promotion) => {
        storeMock.moves.push({ from, to, promotion });
        return true;
      },
    };
  });

  it('passes the current position and player orientation to the chessboard', () => {
    storeMock.state.playerColor = 'black';

    const props = renderBoard();

    expect(props.position).toBe(storeMock.state.fen);
    expect(props.boardOrientation).toBe('black');
    expect(props.boardWidth).toBe(480);
    expect(props.arePremovesAllowed).toBe(false);
  });

  it('delegates legal player drops to the game store', () => {
    const props = renderBoard();

    expect(props.onPieceDrop('e2', 'e4')).toBe(true);
    expect(storeMock.moves).toEqual([{ from: 'e2', to: 'e4', promotion: undefined }]);
  });

  it('blocks player drops while the engine is thinking', () => {
    storeMock.state.engineThinking = true;

    const props = renderBoard();

    expect(props.onPieceDrop('e2', 'e4')).toBe(false);
    expect(storeMock.moves).toEqual([]);
  });
});
