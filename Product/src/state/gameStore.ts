import { create } from 'zustand';
import { Chess } from 'chess.js';
import {
  getBestMove,
  getStockfishDiagnostics,
  stopThinking,
  StockfishEngineError,
  subscribeStockfishEngineState,
  type StockfishEngineState,
} from '../engine/stockfishBridge';
import { putLocalMatchRecord, getOrCreateDefaultPlayer } from '../data/db';
import { usePlayerStore } from './playerStore';

type Color = 'white' | 'black';
type Status = 'idle' | 'playing' | 'game-over';
type ResultLabel = 'white_win' | 'black_win' | 'draw' | 'resigned' | 'abandoned';
type Result = 'You won' | 'You lost' | 'Draw' | 'Game ended' | null;
export type Difficulty = 'Beginner' | 'Casual' | 'Club' | 'Strong';
type EnginePhase = 'idle' | 'starting' | 'thinking' | 'restarting' | 'unavailable' | 'retry-failed';

interface GameState {
  _game: Chess;
  fen: string;
  status: Status;
  result: Result;
  resultLabel: ResultLabel | null;
  playerColor: Color;
  selectedSide: 'white' | 'black' | 'random';
  engineThinking: boolean;
  enginePhase: EnginePhase;
  engineError: string | null;
  engineErrorDetails: string | null;
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

let unsubscribeStockfishState: (() => void) | null = null;

function ensureStockfishStateSubscription(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState
): void {
  if (unsubscribeStockfishState) return;

  unsubscribeStockfishState = subscribeStockfishEngineState((state) => {
    const current = get();
    if (!current.engineThinking) return;

    const phase = enginePhaseFromStockfishState(state, current.enginePhase);
    if (phase) {
      set({ enginePhase: phase });
    }
  });
}

function enginePhaseFromStockfishState(
  state: StockfishEngineState,
  currentPhase: EnginePhase
): EnginePhase | null {
  if (state === 'booting') return 'starting';
  if (state === 'searching') return currentPhase === 'starting' ? 'starting' : 'thinking';
  if (state === 'restarting') return 'restarting';
  if (state === 'crashed') return 'unavailable';
  return null;
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

function formatEngineFailure(failure: StockfishEngineError | null, fallback: unknown): { message: string; details: string | null } {
  const diagnostics = getStockfishDiagnostics();
  const code = failure?.code ?? 'ENGINE_UNAVAILABLE';
  const phase =
    diagnostics.bootTimeline.length > 0
      ? diagnostics.bootTimeline[diagnostics.bootTimeline.length - 1].phase
      : 'unknown';
  const base =
    code === 'ENGINE_RETRY_FAILED'
      ? 'Engine unavailable after one automatic restart.'
      : 'Engine unavailable while preparing Stockfish.';
  const action =
    phase === 'worker_constructing' || phase === 'worker_booted'
      ? 'Worker startup failed; reload once or use Stockfish Diagnostics.'
      : phase === 'stockfish_script_loaded' || phase === 'uciok_received' || phase === 'readyok_received'
        ? 'The worker started but Stockfish did not finish its ready handshake.'
        : 'Use Stockfish Diagnostics to copy the boot timeline if this repeats.';

  return {
    message: `${base} ${code}${phase !== 'unknown' ? ` at ${phase}` : ''}. ${action}`,
    details: failure
      ? `${failure.code}: ${failure.message}${failure.details ? `\n${failure.details}` : ''}`
      : fallback instanceof Error
        ? fallback.message
        : String(fallback),
  };
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

export const useGameStore = create<GameState>((set, get) => {
  ensureStockfishStateSubscription(set, get);

  return {
  _game: new Chess(),
  fen: new Chess().fen(),
  status: 'idle',
  result: null,
  resultLabel: null,
  playerColor: 'white',
  selectedSide: 'white',
  engineThinking: false,
  enginePhase: 'idle',
  engineError: null,
  engineErrorDetails: null,
  gameId: 0,
  savedMatchId: null,
  savedRecordId: null,
  difficulty: 'Club',
  history: [],

  clearEngineError: () => set({ engineError: null, engineErrorDetails: null, enginePhase: 'idle' }),

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
      enginePhase: 'idle',
      engineError: null,
      engineErrorDetails: null,
      gameId,
      savedMatchId: null,
      savedRecordId: null,
      difficulty,
      history: []
    });

    // If the player is Black, the engine moves first.
    if (playerColor === 'black') {
      set({ enginePhase: 'starting', engineThinking: true });
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

    set({
      engineThinking: true,
      enginePhase: get().enginePhase === 'starting' ? 'starting' : 'thinking',
      engineError: null,
      engineErrorDetails: null,
    });
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
        throw new StockfishEngineError(
          'ENGINE_TIMEOUT',
          'Stockfish did not return a legal move.',
          'The worker became ready but did not produce a move before the timeout.'
        );
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
      set({
        fen: _game.fen(),
        history: _game.history(),
        engineThinking: false,
        enginePhase: 'idle',
        engineError: null,
        engineErrorDetails: null,
        ...end,
      });
    } catch (err) {
      console.error('[gameStore] engine error:', err);
      if (get().gameId === gameId) {
        const failure = err instanceof StockfishEngineError ? err : null;
        const retryExhausted = Boolean(failure?.code === 'ENGINE_RETRY_FAILED');
        const formatted = formatEngineFailure(failure, err);
        set({
          engineThinking: false,
          enginePhase: retryExhausted ? 'retry-failed' : 'unavailable',
          engineError: formatted.message,
          engineErrorDetails: formatted.details,
        });
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
      enginePhase: 'idle',
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
      enginePhase: 'idle',
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
  };
});
