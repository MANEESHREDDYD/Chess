import { describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';

describe('gameStore', () => {
  it('starts a white game without invoking the engine first', () => {
    useGameStore.getState().startGame('white');

    const state = useGameStore.getState();
    expect(state.status).toBe('playing');
    expect(state.playerColor).toBe('white');
    expect(state.engineThinking).toBe(false);
    expect(state.fen).toContain(' w ');
  });

  it('marks the game as lost when the player resigns', () => {
    useGameStore.getState().startGame('white');
    useGameStore.getState().resign();

    const state = useGameStore.getState();
    expect(state.status).toBe('game-over');
    expect(state.result).toBe('You lost');
    expect(state.engineThinking).toBe(false);
  });

  it('exports a PGN with event and player headers', () => {
    useGameStore.getState().startGame('white');

    const pgn = useGameStore.getState().exportPgn();
    expect(pgn).toContain('[Event "MIRROR free play"]');
    expect(pgn).toContain('[White "Player"]');
    expect(pgn).toContain('[Black "Stockfish (depth 10)"]');
  });
});
