import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BoardView } from '../components/Board/BoardView';
import { useGameStore, type Difficulty } from '../state/gameStore';
import { useSettingsStore } from '../state/settingsStore';
import { getLocalMatchesForPlayer, type LocalMatchRecord } from '../data/db';
import { getStockfishDiagnostics } from '../engine/stockfishBridge';
import { isStandardTheme, loadThemeManifest } from '../lib/theme';
import { usePlayerStore } from '../state/playerStore';
import { AnalysisPanel } from '../components/Analysis/AnalysisPanel';
import { useAudioFx } from '../audio/useAudioFx';

declare global {
  interface Window {
    __MIRROR_PLAY_TEST__?: {
      startGame: (side: 'white' | 'black' | 'random', difficulty?: Difficulty) => void;
      makePlayerMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => boolean;
      getState: () => {
        status: string;
        playerColor: string;
        engineThinking: boolean;
        enginePhase: string;
        engineError: string | null;
        history: string[];
        fen: string;
        diagnostics: ReturnType<typeof getStockfishDiagnostics>;
      };
    };
  }
}

export default function Play() {
  const status = useGameStore((s) => s.status);
  const result = useGameStore((s) => s.result);
  const playerColor = useGameStore((s) => s.playerColor);
  const engineThinking = useGameStore((s) => s.engineThinking);
  const enginePhase = useGameStore((s) => s.enginePhase);
  const engineError = useGameStore((s) => s.engineError);
  const engineErrorDetails = useGameStore((s) => s.engineErrorDetails);
  const startGame = useGameStore((s) => s.startGame);
  const resign = useGameStore((s) => s.resign);
  const claimDraw = useGameStore((s) => s.claimDraw);
  const exportPgn = useGameStore((s) => s.exportPgn);
  const makePlayerMove = useGameStore((s) => s.makePlayerMove);
  const fen = useGameStore((s) => s.fen);
  const history = useGameStore((s) => s.history);
  const currentDifficulty = useGameStore((s) => s.difficulty);

  useAudioFx(history);

  const activeTheme = useSettingsStore((s) => s.activeTheme);
  const setActiveTheme = useSettingsStore((s) => s.setActiveTheme);
  const activePlayerId = usePlayerStore((s) => s.activePlayerId);

  const [themeManifest, setThemeManifest] = useState<Awaited<ReturnType<typeof loadThemeManifest>>>(null);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [localMatches, setLocalMatches] = useState<LocalMatchRecord[]>([]);

  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('Club');

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('stockfishBootCheck')) return;

    window.__MIRROR_PLAY_TEST__ = {
      startGame,
      makePlayerMove,
      getState: () => {
        const state = useGameStore.getState();
        return {
          status: state.status,
          playerColor: state.playerColor,
          engineThinking: state.engineThinking,
          enginePhase: state.enginePhase,
          engineError: state.engineError,
          history: [...state.history],
          fen: state.fen,
          diagnostics: getStockfishDiagnostics(),
        };
      },
    };

    return () => {
      delete window.__MIRROR_PLAY_TEST__;
    };
  }, [makePlayerMove, startGame]);

  useEffect(() => {
    if (status === 'idle') {
      startGame('random', selectedDifficulty);
    }
  }, [status, startGame, selectedDifficulty]);

  useEffect(() => {
    let cancelled = false;
    async function loadTheme() {
      if (isStandardTheme(activeTheme)) {
        setThemeManifest(null);
        setThemeError(null);
        return;
      }
      try {
        const manifest = await loadThemeManifest(activeTheme);
        if (!cancelled) {
          setThemeManifest(manifest);
          setThemeError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setThemeManifest(null);
          setThemeError(error instanceof Error ? error.message : 'Failed to load theme.');
        }
      }
    }
    void loadTheme();
    return () => { cancelled = true; };
  }, [activeTheme]);

  useEffect(() => {
    if (status === 'game-over' && activePlayerId) {
      getLocalMatchesForPlayer(activePlayerId).then(matches => {
        setLocalMatches(matches);
      });
    }
  }, [status, activePlayerId]);

  useEffect(() => {
    if (activePlayerId && status === 'idle') {
      getLocalMatchesForPlayer(activePlayerId).then(matches => {
        setLocalMatches(matches);
      });
    }
  }, [activePlayerId, status]);



  const handleDownloadPgn = () => {
    const pgn = exportPgn();
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mirror-game-${Date.now()}.pgn`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleExportJson = (match: LocalMatchRecord) => {
    const exportRecord = {
      id: match.id,
      mode: match.mode,
      side: match.side,
      actual_side: match.actual_side,
      difficulty: match.difficulty,
      result: match.result,
      pgn: match.pgn,
      move_count: match.move_count,
      created_at: match.created_at,
      completed_at: match.completed_at,
      engine_settings: {
        difficulty: match.difficulty,
      }
    };
    const json = JSON.stringify(exportRecord, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${match.id}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePromotionCheck = (sourceSquare: string, targetSquare: string, piece: string): boolean => {
    if (piece[1] !== 'P') return false;
    const isWhitePromotion = piece[0] === 'w' && targetSquare[1] === '8';
    const isBlackPromotion = piece[0] === 'b' && targetSquare[1] === '1';
    if (!isWhitePromotion && !isBlackPromotion) return false;
    // For now we always promote to Queen to avoid blocking UI with a promotion modal.
    makePlayerMove(sourceSquare, targetSquare, 'q');
    return true; // We handled it
  };

  return (
    <div className="play">
      <aside className="play-sidebar">
        <h2 className="play-title">Match</h2>
        <dl className="play-meta">
          <dt>You play</dt>
          <dd>{playerColor === 'white' ? 'White' : 'Black'}</dd>
          <dt>Opponent</dt>
          <dd>Stockfish ({currentDifficulty})</dd>
          <dt>Theme</dt>
          <dd>{activeTheme === 'standard' ? 'Standard' : 'Kurukshetra'}</dd>
          <dt>Status</dt>
          <dd>
            {status === 'playing' && (
              enginePhase === 'unavailable' || enginePhase === 'retry-failed'
                ? 'Engine unavailable'
                : engineThinking
                ? enginePhase === 'starting'
                  ? 'Engine starting...'
                  : enginePhase === 'restarting'
                    ? 'Engine restarting...'
                    : 'Engine thinking...'
                : 'Your move'
            )}
            {status === 'game-over' && (result ?? 'Game over')}
            {status === 'idle' && 'Setting up...'}
          </dd>
        </dl>

        {engineError && (
          <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.9rem', padding: '0.5rem', background: '#ffebee', borderRadius: '4px' }}>
            <div>{engineError}</div>
            {import.meta.env.DEV && engineErrorDetails && (
              <details style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
                <summary>Debug details</summary>
                <div>{engineErrorDetails}</div>
              </details>
            )}
          </div>
        )}

        <div className="play-actions">
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['Beginner', 'Casual', 'Club', 'Strong'] as Difficulty[]).map(d => (
              <button 
                key={d} 
                className={`btn ${selectedDifficulty === d ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedDifficulty(d)}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => setActiveTheme(activeTheme === 'standard' ? 'kurukshetra' : 'standard')}
          >
            Theme · {activeTheme === 'standard' ? 'Standard' : 'Kurukshetra'}
          </button>
          <button className="btn btn-secondary" onClick={() => startGame('white', selectedDifficulty)}>
            New game · White
          </button>
          <button className="btn btn-secondary" onClick={() => startGame('black', selectedDifficulty)}>
            New game · Black
          </button>
          <button className="btn btn-secondary" onClick={() => startGame('random', selectedDifficulty)}>
            New game · Random
          </button>
          {status === 'game-over' && (
            <div style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>
              Game Over - {result}
            </div>
          )}
          {status === 'playing' && (
            <>
              <button className="btn btn-warn" onClick={resign}>
                Resign
              </button>
              <button className="btn btn-ghost" onClick={claimDraw}>
                Claim Draw
              </button>
            </>
          )}
          <button className="btn btn-ghost" onClick={handleDownloadPgn}>
            Download PGN
          </button>
        </div>

        {history.length > 0 && (
          <div style={{ marginTop: '1rem', maxHeight: '200px', overflowY: 'auto', background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0' }}>Move History</h3>
            <ol style={{ paddingLeft: '1.5rem', margin: 0, fontSize: '0.9rem' }}>
              {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => (
                <li key={i}>
                  {history[i * 2]} {history[i * 2 + 1] || ''}
                </li>
              ))}
            </ol>
          </div>
        )}

      </aside>

      <section className="play-board-wrap">
        <BoardView
          fen={fen}
          playerColor={playerColor}
          status={status}
          engineThinking={engineThinking}
          onPieceDrop={(from, to) => makePlayerMove(from, to)}
          onPromotionCheck={handlePromotionCheck}
          onPromotionPieceSelect={() => false}
          themeManifest={themeManifest}
          themeError={themeError}
        />
        
        {status === 'game-over' && activePlayerId && useGameStore.getState().savedRecordId && (
          <>
            <AnalysisPanel
              pgn={exportPgn()}
              playerId={activePlayerId}
              matchId={useGameStore.getState().savedRecordId!}
              matchType="computer"
            />
            <p className="play-note" style={{ marginTop: '0.75rem' }}>
              <Link to={`/review/local_match/${useGameStore.getState().savedRecordId}`}>Open Game Review Pro</Link>
            </p>
          </>
        )}
        
        {localMatches.length > 0 && (
          <div style={{ marginTop: '2rem', borderTop: '1px solid #ccc', paddingTop: '1rem' }}>
            <h3>Local Match History</h3>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>Side</th>
                  <th>Difficulty</th>
                  <th>Moves</th>
                  <th>Result</th>
                  <th>Export</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {localMatches.slice(0, 10).map(match => (
                  <tr key={match.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem 0' }}>{new Date(match.created_at).toLocaleDateString()}</td>
                    <td>{match.mode}</td>
                    <td>{match.side}</td>
                    <td>{match.difficulty}</td>
                    <td>{match.move_count}</td>
                    <td>{match.result}</td>
                    <td>
                      <button className="btn btn-ghost" style={{ padding: '0.2rem 0.5rem' }} onClick={() => handleExportJson(match)}>
                        JSON
                      </button>
                    </td>
                    <td>
                      <Link to={`/review/local_match/${match.id}`}>Review</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
