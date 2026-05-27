import { useEffect } from 'react';
import { Board } from '../components/Board/Board';
import { useGameStore } from '../state/gameStore';
import { useSettingsStore } from '../state/settingsStore';

export default function Play() {
  const status = useGameStore((s) => s.status);
  const result = useGameStore((s) => s.result);
  const playerColor = useGameStore((s) => s.playerColor);
  const engineThinking = useGameStore((s) => s.engineThinking);
  const startGame = useGameStore((s) => s.startGame);
  const resign = useGameStore((s) => s.resign);
  const exportPgn = useGameStore((s) => s.exportPgn);
  const activeTheme = useSettingsStore((s) => s.activeTheme);
  const setActiveTheme = useSettingsStore((s) => s.setActiveTheme);

  useEffect(() => {
    if (status === 'idle') {
      startGame('random');
    }
  }, [status, startGame]);

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

  return (
    <div className="play">
      <aside className="play-sidebar">
        <h2 className="play-title">Match</h2>
        <dl className="play-meta">
          <dt>You play</dt>
          <dd>{playerColor === 'white' ? 'White' : 'Black'}</dd>
          <dt>Opponent</dt>
          <dd>Stockfish (depth 10)</dd>
          <dt>Theme</dt>
          <dd>{activeTheme === 'standard' ? 'Standard' : 'Kurukshetra'}</dd>
          <dt>Status</dt>
          <dd>
            {status === 'playing' && (engineThinking ? 'Engine thinking…' : 'Your move')}
            {status === 'game-over' && (result ?? 'Game over')}
            {status === 'idle' && 'Setting up…'}
          </dd>
        </dl>

        <div className="play-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setActiveTheme(activeTheme === 'standard' ? 'kurukshetra' : 'standard')}
          >
            Theme · {activeTheme === 'standard' ? 'Standard' : 'Kurukshetra'}
          </button>
          <button className="btn btn-secondary" onClick={() => startGame('white')}>
            New game · White
          </button>
          <button className="btn btn-secondary" onClick={() => startGame('black')}>
            New game · Black
          </button>
          <button className="btn btn-secondary" onClick={() => startGame('random')}>
            New game · Random
          </button>
          {status === 'playing' && (
            <button className="btn btn-warn" onClick={resign}>
              Resign
            </button>
          )}
          <button className="btn btn-ghost" onClick={handleDownloadPgn}>
            Download PGN
          </button>
        </div>

        <p className="play-note">
          Calibration is available from Home. The Mirror match arrives in the next phase.
        </p>
      </aside>

      <section className="play-board-wrap">
        <Board />
      </section>
    </div>
  );
}
