import { create } from 'zustand';
import { Chess } from 'chess.js';
import { getBestMove, stopThinking } from '../engine/stockfishBridge';
import { putLocalMatchRecord, getOrCreateDefaultPlayer } from '../data/db';
import { usePlayerStore } from './playerStore';

type Color = 'white' | 'black';
type Status = 'idle' | 'playing' | 'game-over';
type ResultLabel = 'white_win' | 'black_win' | 'draw' | 'resigned' | 'abandoned';
type Result = 'You won' | 'You lost' | 'Draw' | 'Game ended' | null;
export type Difficulty = 'Beginner' | 'Casual' | 'Club' | 'Strong';

interface GameState {
  _game: Chess;
  fen: string;
  status: Status;
  result: Result;
  resultLabel: ResultLabel | null;
  playerColor: Color;
  selectedSide: 'white' | 'black' | 'random';
  engineThinking: boolean;
  engineError: string | null;
  gameId: number;
  savedMatchId: number | null;
  savedRecordId: string | null;
  difficulty: Difficulty;
  history: string[];

  startGame: (side: 'white' | 'black' | 'random', difficulty?: Difficulty) => void;
  makePlayerMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => boolean;
  triggerEngineMove: () => Promise<void>;
  resign: () => void;
  claimDraw: () => void;
  clearEngineError: () => void;
  exportPgn: () => string;
}

function uciToMove(uci: string): { from: string; to: string; promotion?: string } {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length === 5 ? uci[4] : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}

function checkGameEnd(game: Chess, playerColor: Color): { status: Status; result: Result; resultLabel: ResultLabel | null } {
  if (!game.isGameOver()) return { status: 'playing', result: null, resultLabel: null };

  if (game.isCheckmate()) {
    const loser: Color = game.turn() === 'w' ? 'white' : 'black';
    if (loser === playerColor) return { status: 'game-over', result: 'You lost', resultLabel: playerColor === 'white' ? 'black_win' : 'white_win' };
    return { status: 'game-over', result: 'You won', resultLabel: playerColor === 'white' ? 'white_win' : 'black_win' };
  }

  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
    return { status: 'game-over', result: 'Draw', resultLabel: 'draw' };
  }

  return { status: 'game-over', result: 'Game ended', resultLabel: 'abandoned' };
}

async function saveLocalMatch(game: Chess, selectedSide: 'white'|'black'|'random', playerColor: Color, difficulty: Difficulty, resultLabel: ResultLabel) {
  let playerId = usePlayerStore.getState().activePlayerId;
  if (!playerId) {
    const defaultPlayer = await getOrCreateDefaultPlayer();
    await usePlayerStore.getState().setActivePlayer(defaultPlayer.id);
    playerId = defaultPlayer.id;
  }

  const record = {
    id: `local-match-${Date.now()}`,
    player_id: playerId,
    mode: 'computer' as const,
    side: selectedSide,
    actual_side: playerColor,
    difficulty,
    result: resultLabel,
    result_label: resultLabel,
    pgn: game.pgn(),
    move_count: game.history().length,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString()
  };
  useGameStore.setState({ savedRecordId: record.id });
  putLocalMatchRecord(record).catch(err => console.error('Failed to save local match:', err));
}

export const useGameStore = create<GameState>((set, get) => ({
  _game: new Chess(),
  fen: new Chess().fen(),
  status: 'idle',
  result: null,
  resultLabel: null,
  playerColor: 'white',
  selectedSide: 'white',
  engineThinking: false,
  engineError: null,
  gameId: 0,
  savedMatchId: null,
  savedRecordId: null,
  difficulty: 'Club',
  history: [],

  clearEngineError: () => set({ engineError: null }),

  startGame: (side, difficulty = 'Club') => {
    stopThinking();
    const game = new Chess();
    const playerColor: Color =
      side === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : side;
    const gameId = get().gameId + 1;

    set({
      _game: game,
      fen: game.fen(),
      status: 'playing',
      result: null,
      resultLabel: null,
      playerColor,
      selectedSide: side,
      engineThinking: false,
      engineError: null,
      gameId,
      savedMatchId: null,
      savedRecordId: null,
      difficulty,
      history: []
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
    if (end.status === 'game-over' && end.resultLabel && get().savedMatchId !== get().gameId) {
      saveLocalMatch(_game, get().selectedSide, playerColor, get().difficulty, end.resultLabel);
      set({ savedMatchId: get().gameId });
    }
    set({ fen: _game.fen(), history: _game.history(), engineError: null, ...end });

    if (end.status === 'playing') {
      void get().triggerEngineMove();
    }
    return true;
  },

  triggerEngineMove: async () => {
    const { _game, playerColor, gameId, difficulty } = get();
    if (_game.isGameOver()) return;

    set({ engineThinking: true });
    try {
      let depth = 10;
      switch (difficulty) {
        case 'Beginner': depth = 1; break;
        case 'Casual': depth = 5; break;
        case 'Club': depth = 10; break;
        case 'Strong': depth = 15; break;
      }
      const uci = await getBestMove(_game.fen(), depth);
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
      if (end.status === 'game-over' && end.resultLabel && get().savedMatchId !== gameId) {
        saveLocalMatch(_game, get().selectedSide, playerColor, difficulty, end.resultLabel);
        set({ savedMatchId: gameId });
      }
      set({ fen: _game.fen(), history: _game.history(), engineThinking: false, engineError: null, ...end });
    } catch (err) {
      console.error('[gameStore] engine error:', err);
      if (get().gameId === gameId) {
        set({ engineThinking: false, engineError: 'Engine error. Please try again.' });
      }
    }
  },

  resign: () => {
    stopThinking();
    const game = get()._game;
    if (get().savedMatchId !== get().gameId) {
      saveLocalMatch(game, get().selectedSide, get().playerColor, get().difficulty, 'resigned');
      set({ savedMatchId: get().gameId });
    }
    set({
      status: 'game-over',
      result: 'You lost',
      resultLabel: 'resigned',
      engineThinking: false,
    });
  },

  claimDraw: () => {
    const game = get()._game;
    const isLegalDraw = game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial();
    
    if (!isLegalDraw) {
      set({ engineError: 'No legal draw can be claimed in this position.' });
      return;
    }

    stopThinking();
    if (get().savedMatchId !== get().gameId) {
      saveLocalMatch(game, get().selectedSide, get().playerColor, get().difficulty, 'draw');
      set({ savedMatchId: get().gameId });
    }
    set({
      status: 'game-over',
      result: 'Draw',
      resultLabel: 'draw',
      engineThinking: false,
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
