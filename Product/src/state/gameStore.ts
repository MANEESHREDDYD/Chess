import { create } from 'zustand';
import { Chess } from 'chess.js';
import { getBestMove, stopThinking } from '../engine/stockfishBridge';

type Color = 'white' | 'black';
type Status = 'idle' | 'playing' | 'game-over';
type Result = 'You won' | 'You lost' | 'Draw' | 'Game ended' | null;

interface GameState {
  // Chess.js instance (not in state — it mutates; we expose .fen via fen).
  _game: Chess;

  fen: string;
  status: Status;
  result: Result;
  playerColor: Color;
  engineThinking: boolean;
  gameId: number;

  startGame: (color: Color | 'random') => void;
  makePlayerMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => boolean;
  triggerEngineMove: () => Promise<void>;
  resign: () => void;
  exportPgn: () => string;
}

function uciToMove(uci: string): { from: string; to: string; promotion?: string } {
  // UCI: 'e2e4' or 'e7e8q'
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length === 5 ? uci[4] : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}

function checkGameEnd(game: Chess, playerColor: Color): { status: Status; result: Result } {
  if (!game.isGameOver()) return { status: 'playing', result: null };

  if (game.isCheckmate()) {
    // The side TO MOVE was checkmated. Loser = side to move.
    const loser: Color = game.turn() === 'w' ? 'white' : 'black';
    if (loser === playerColor) return { status: 'game-over', result: 'You lost' };
    return { status: 'game-over', result: 'You won' };
  }

  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
    return { status: 'game-over', result: 'Draw' };
  }

  return { status: 'game-over', result: 'Game ended' };
}

export const useGameStore = create<GameState>((set, get) => ({
  _game: new Chess(),
  fen: new Chess().fen(),
  status: 'idle',
  result: null,
  playerColor: 'white',
  engineThinking: false,
  gameId: 0,

  startGame: (color) => {
    stopThinking();
    const game = new Chess();
    const playerColor: Color =
      color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : color;
    const gameId = get().gameId + 1;

    set({
      _game: game,
      fen: game.fen(),
      status: 'playing',
      result: null,
      playerColor,
      engineThinking: false,
      gameId,
    });

    // If the player is Black, the engine moves first.
    if (playerColor === 'black') {
      void get().triggerEngineMove();
    }
  },

  makePlayerMove: (from, to, promotion) => {
    const { _game, status, engineThinking, playerColor } = get();
    if (status !== 'playing' || engineThinking) return false;

    // Reject moves that are not the player's turn.
    const turn = _game.turn() === 'w' ? 'white' : 'black';
    if (turn !== playerColor) return false;

    let result;
    try {
      result = _game.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return false;
    }
    if (!result) return false;

    const end = checkGameEnd(_game, playerColor);
    set({ fen: _game.fen(), ...end });

    if (end.status === 'playing') {
      void get().triggerEngineMove();
    }
    return true;
  },

  triggerEngineMove: async () => {
    const { _game, playerColor, gameId } = get();
    if (_game.isGameOver()) return;

    set({ engineThinking: true });
    try {
      const uci = await getBestMove(_game.fen(), 10);
      const current = get();
      if (current.gameId !== gameId || current.status !== 'playing') return;
      if (!uci) {
        set({ engineThinking: false });
        return;
      }
      const move = uciToMove(uci);
      try {
        _game.move(move);
      } catch (err) {
        console.error('[gameStore] engine produced invalid move:', uci, err);
        set({ engineThinking: false });
        return;
      }
      const end = checkGameEnd(_game, playerColor);
      set({ fen: _game.fen(), engineThinking: false, ...end });
    } catch (err) {
      console.error('[gameStore] engine error:', err);
      if (get().gameId === gameId) {
        set({ engineThinking: false });
      }
    }
  },

  resign: () => {
    stopThinking();
    set({
      status: 'game-over',
      result: 'You lost',
      engineThinking: false,
      gameId: get().gameId + 1,
    });
  },

  exportPgn: () => {
    const { _game, playerColor } = get();
    _game.header(
      'Event',
      'MIRROR free play',
      'White',
      playerColor === 'white' ? 'Player' : 'Stockfish (depth 10)',
      'Black',
      playerColor === 'black' ? 'Player' : 'Stockfish (depth 10)',
      'Date',
      new Date().toISOString().slice(0, 10)
    );
    return _game.pgn();
  },
}));
