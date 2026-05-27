import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { BoardView } from '../Board/BoardView';
import { init as initCalibrationOpponent, move as moveCalibrationOpponent, dispose as disposeCalibrationOpponent } from '../../engine/calibrationOpponent';
import type { ThemeManifest } from '../../lib/theme';
import { pickVyasaLine, type VyasaLine } from './vyasaLines';

const BASE_CLOCK_MS = 5 * 60 * 1000;
const INCREMENT_MS = 3 * 1000;

type Task8VyasaMatchProps = {
  themeManifest?: ThemeManifest | null;
  onComplete?: (result: { line: string; status: string; moveCount: number }) => void;
};

export function Task8VyasaMatch({ themeManifest = null, onComplete }: Task8VyasaMatchProps) {
  const [game] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [moveCount, setMoveCount] = useState(0);
  const [status, setStatus] = useState<'playing' | 'game-over'>('playing');
  const [result, setResult] = useState<string>('Playing');
  const [engineThinking, setEngineThinking] = useState(false);
  const [whiteClockMs, setWhiteClockMs] = useState(BASE_CLOCK_MS);
  const [blackClockMs, setBlackClockMs] = useState(BASE_CLOCK_MS);
  const [vyasaLine, setVyasaLine] = useState<VyasaLine>(pickVyasaLine(initialSnapshot()));
  const activeSideRef = useRef<'white' | 'black'>('white');
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    void initCalibrationOpponent({ depth: 6, skillLevel: 8 });
    return () => disposeCalibrationOpponent();
  }, []);

  useEffect(() => {
    if (status !== 'playing') return;

    const interval = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;

      if (activeSideRef.current === 'white') {
        setWhiteClockMs((previous) => Math.max(0, previous - elapsed));
      } else {
        setBlackClockMs((previous) => Math.max(0, previous - elapsed));
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (whiteClockMs === 0 || blackClockMs === 0) {
      setStatus('game-over');
      setResult('Time out');
    }
  }, [blackClockMs, whiteClockMs]);

  useEffect(() => {
    if (status === 'game-over') {
      onComplete?.({ line: vyasaLine.line, status: result, moveCount });
    }
  }, [moveCount, onComplete, result, status, vyasaLine.line]);

  const lineText = useMemo(() => vyasaLine.line, [vyasaLine.line]);

  function updateLine(snapshotOverrides: Partial<ReturnType<typeof initialSnapshot>> = {}): void {
    setVyasaLine(pickVyasaLine({ ...initialSnapshot(), ...snapshotOverrides }));
  }

  function initialSnapshot() {
    return {
      materialBalance: 0,
      moveCount,
      phase: moveCount < 8 ? 'opening' : 'middlegame',
      timePressure: whiteClockMs < 20_000 || blackClockMs < 20_000,
      afterBlunder: false,
      afterBrilliancy: false,
      queensExchanged: false,
      gameOver: status === 'game-over',
    } as const;
  }

  function applyMove(uci: string): boolean {
    try {
      const resultMove = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as 'q' | 'r' | 'b' | 'n' | undefined });
      return Boolean(resultMove);
    } catch {
      return false;
    }
  }

  const handleDrop = (from: string, to: string): boolean => {
    if (status !== 'playing' || engineThinking) return false;

    const uci = `${from}${to}`;
    if (!applyMove(uci)) return false;

    const now = Date.now();
    const elapsed = now - lastTickRef.current;
    lastTickRef.current = now;
    setWhiteClockMs((previous) => Math.max(0, previous - elapsed + INCREMENT_MS));
    activeSideRef.current = 'black';
    setMoveCount((previous) => previous + 1);
    setFen(game.fen());
    updateLine({ moveCount: moveCount + 1, phase: moveCount + 1 < 8 ? 'opening' : 'middlegame' });

    if (game.isGameOver()) {
      setStatus('game-over');
      setResult('Game over');
      return true;
    }

    setEngineThinking(true);
    void (async () => {
      const reply = await moveCalibrationOpponent(game.fen(), { depth: 6, skillLevel: 8 });
      setEngineThinking(false);
      if (!reply) return;

      if (applyMove(reply)) {
        const engineNow = Date.now();
        const engineElapsed = engineNow - lastTickRef.current;
        lastTickRef.current = engineNow;
        setBlackClockMs((previous) => Math.max(0, previous - engineElapsed + INCREMENT_MS));
        activeSideRef.current = 'white';
        setMoveCount((previous) => previous + 1);
        setFen(game.fen());
        updateLine({ moveCount: moveCount + 2, phase: moveCount + 2 < 8 ? 'opening' : 'middlegame' });
      }

      if (game.isGameOver()) {
        setStatus('game-over');
        setResult('Game over');
      }
    })();

    return true;
  };

  return (
    <section className="calibration-task-shell" data-task-name="Task 8 · Vyasa match">
      <header className="calibration-task-header">
        <div>
          <p className="calibration-task-eyebrow">Task 8 · Vyasa match</p>
          <h2>Play the match and listen when the position calls for it.</h2>
        </div>
        <dl className="calibration-task-stats">
          <div>
            <dt>White clock</dt>
            <dd>{formatClock(whiteClockMs)}</dd>
          </div>
          <div>
            <dt>Black clock</dt>
            <dd>{formatClock(blackClockMs)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{result}</dd>
          </div>
        </dl>
      </header>

      <BoardView
        fen={fen}
        playerColor="white"
        status={status}
        engineThinking={engineThinking}
        onPieceDrop={handleDrop}
        onPromotionCheck={() => false}
        onPromotionPieceSelect={() => false}
        themeManifest={themeManifest}
      />

      <footer className="calibration-task-footer">
        <span>{lineText}</span>
        <span>{moveCount === 0 ? 'Moves 8 / 16 / 24 trigger interventions' : `Move ${moveCount}`}</span>
      </footer>
    </section>
  );
}

function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
