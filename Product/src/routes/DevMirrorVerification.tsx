import { useEffect, useState, useRef } from 'react';
import { Chess } from 'chess.js';
import { createMirrorOpponent } from '../engine/mirrorOpponent';
import type { StyleVector } from '../ml/styleVector';
// removed MirrorDecisionTrace

const TEST_VECTOR: StyleVector = {
  schema_version: 1,
  detected_elo: 1200,
  elo_band: 'initiate',
  opening_white_top3: ['e4'],
  opening_black_top3: ['c5'],
  avg_move_time_ms: 2000,
  time_pressure_blunder_rate: 0.1,
  exchange_willingness: 0.5,
  preferred_minor: 'knight',
  motif_blindness: { fork: 0, pin: 0, skewer: 0, removing_the_defender: 0 },
  endgame_strength: 0.5,
  swindle_preference: 'principled',
};

type VerificationLog = { msg: string; type: 'info' | 'error' | 'success' };

export default function DevMirrorVerification() {
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const logsRef = useRef<VerificationLog[]>([]);

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    logsRef.current = [...logsRef.current, { msg, type }];
    setLogs(logsRef.current);
  };

  useEffect(() => {
    let active = true;

    async function playMatch(playerColor: 'white' | 'black') {
      addLog(`Starting Match: Mirror playing as ${playerColor === 'white' ? 'Black' : 'White'}`, 'info');
      
      const game = new Chess();
      const opponent = createMirrorOpponent(TEST_VECTOR);
      const traces: Array<Record<string, unknown>> = [];
      let moveNumber = 1;

      while (!game.isGameOver() && active) {
        const turnColor = game.turn() === 'w' ? 'white' : 'black';

        if (turnColor === playerColor) {
          // Player's turn: play a deterministic legal move so verification is reproducible.
          const moves = game.moves();
          const move = moves[(game.history().length + moveNumber) % moves.length];
          game.move(move);
          if (game.turn() === 'w') moveNumber++;
        } else {
          // Mirror's turn
          const fenBefore = game.fen();
          try {
            const mirrorMove = await opponent.getMoveWithTrace(fenBefore, { depth: 8, timeoutMs: 15_000 });
            if (!active) break;
            
            if (mirrorMove.move) {
              const from = mirrorMove.move.slice(0, 2);
              const to = mirrorMove.move.slice(2, 4);
              const promotion = mirrorMove.move.length === 5 ? mirrorMove.move[4] : undefined;
              
              const resMove = game.move({ from, to, promotion });
              
              if (mirrorMove.trace) {
                traces.push({
                  ...mirrorMove.trace,
                  moveNumber,
                  fenBefore,
                  san: resMove.san,
                  ply: game.history().length
                });
              }
            } else {
              addLog(`Mirror failed to produce a move.`, 'error');
              break;
            }
          } catch (err) {
            addLog(`Engine error: ${err}`, 'error');
            break;
          }
          if (game.turn() === 'w') moveNumber++;
        }
      }

      opponent.dispose?.();

      if (!active) return null;

      let resultLabel = 'Game ended';
      if (game.isCheckmate()) {
         resultLabel = game.turn() === 'w' ? 'Black won' : 'White won';
      } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
         resultLabel = 'Draw';
      }

      addLog(`Match complete. Result: ${resultLabel}. Traces: ${traces.length}`, 'success');

      return {
        id: `mirror-verification-${playerColor}`,
        player_id: 'dev-verification',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        pgn: game.pgn(),
        result: resultLabel,
        metadata: {
          style_vector_id: 'dev-test-vector',
          mirror_base: 'stockfish-limit-strength',
          mirror_moves: traces,
          played_as: playerColor
        }
      };
    }

    async function runVerification() {
      const whiteMatch = await playMatch('white');
      if (!active) return;
      const blackMatch = await playMatch('black');
      if (!active) return;

      // Expose globally for Puppeteer to scrape
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__VERIFICATION_RESULTS__ = {
        white: whiteMatch,
        black: blackMatch
      };
      
      addLog('Verification complete. Results available on window.__VERIFICATION_RESULTS__', 'success');
    }

    runVerification();

    return () => { active = false; };
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>M-MIRROR Verification</h1>
      <p>Technical fixture running controlled deterministic games...</p>
      <div style={{ background: '#f5f5f5', padding: '1rem', marginTop: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
        {logs.map((log, i) => (
          <div key={i} style={{ color: log.type === 'error' ? 'red' : log.type === 'success' ? 'green' : 'black' }}>
            {log.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
