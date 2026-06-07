import { describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';

describe('gameStore', () => {
  it('starts a game with side and difficulty', () => {
    useGameStore.getState().startGame('white', 'Casual');
    const state = useGameStore.getState();
    expect(state.status).toBe('playing');
    expect(state.selectedSide).toBe('white');
    expect(state.playerColor).toBe('white');
    expect(state.difficulty).toBe('Casual');
    expect(state.engineThinking).toBe(false);
  });

  it('side=random resolves correctly to white or black actual_side', () => {
    useGameStore.getState().startGame('random', 'Club');
    const state = useGameStore.getState();
    expect(state.selectedSide).toBe('random');
    expect(['white', 'black']).toContain(state.playerColor);
    expect(state.status).toBe('playing');
  });

  it('player cannot move while engineThinking', () => {
    useGameStore.getState().startGame('white');
    useGameStore.setState({ engineThinking: true });
    
    const moved = useGameStore.getState().makePlayerMove('e2', 'e4');
    expect(moved).toBe(false);
    expect(useGameStore.getState().history.length).toBe(0);
  });

  it('player cannot move after game over', () => {
    useGameStore.getState().startGame('white');
    useGameStore.setState({ status: 'game-over' });
    
    const moved = useGameStore.getState().makePlayerMove('e2', 'e4');
    expect(moved).toBe(false);
    expect(useGameStore.getState().history.length).toBe(0);
  });

  it('resign ends game and updates resultLabel', () => {
    useGameStore.getState().startGame('white');
    useGameStore.getState().resign();

    const state = useGameStore.getState();
    expect(state.status).toBe('game-over');
    expect(state.resultLabel).toBe('resigned');
    expect(state.engineThinking).toBe(false);
  });

  it('move history updates after moves', () => {
    useGameStore.getState().startGame('white');
    const moved = useGameStore.getState().makePlayerMove('e2', 'e4');
    expect(moved).toBe(true);
    expect(useGameStore.getState().history).toEqual(['e4']);
  });

  it('draw claim does not fake a draw when position is not legally drawn', () => {
    useGameStore.getState().startGame('white');
    useGameStore.getState().claimDraw();

    const state = useGameStore.getState();
    expect(state.status).toBe('playing'); // Did not change
    expect(state.engineError).toBe('No legal draw can be claimed in this position.');
  });

  it('exports a PGN with event and player headers', () => {
    useGameStore.getState().startGame('white');

    const pgn = useGameStore.getState().exportPgn();
    expect(pgn).toContain('[Event "MIRROR free play"]');
    expect(pgn).toContain('[White "Player"]');
  });
});
