import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { BoardView } from '../Board/BoardView';
import { init as initCalibrationOpponent, move as moveCalibrationOpponent, dispose as disposeCalibrationOpponent } from '../../engine/calibrationOpponent';
import type { ThemeManifest } from '../../lib/theme';
import { getEndgameTechniqueTask } from './taskData';

type PendingPromotion = {
  from: string;
  to: string;
} | null;

type Task3EndgameTechniqueProps = {
  themeManifest?: ThemeManifest | null;
  onComplete?: (result: { endgame_strength: number; moveCount: number; success: boolean }) => void;
};

export function Task3EndgameTechnique({ themeManifest = null, onComplete }: Task3EndgameTechniqueProps) {
  const task = getEndgameTechniqueTask();
  const [game] = useState(() => new Chess(task?.fen));
  const [fen, setFen] = useState(() => game.fen());
  const [moveCount, setMoveCount] = useState(0);
  const [status, setStatus] = useState<'playing' | 'game-over'>('playing');
  const [result, setResult] = useState<string | null>(null);
  const [engineThinking, setEngineThinking] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion>(null);
  const [endgameStrength, setEndgameStrength] = useState(0);

  useEffect(() => {
    void initCalibrationOpponent({ depth: 6, skillLevel: 8 });
    return () => disposeCalibrationOpponent();
  }, []);

  useEffect(() => {
    if (moveCount >= 25 && status === 'playing') {
      setStatus('game-over');
      setResult('Conversion budget exhausted');
      onComplete?.({ endgame_strength: endgameStrength, moveCount, success: false });
    }
  }, [endgameStrength, moveCount, onComplete, status]);

  useEffect(() => {
    setEndgameStrength(Math.max(0, 100 - moveCount * 4));
  }, [moveCount]);

  const currentStatus = useMemo(() => status, [status]);

  const handleDrop = async (from: string, to: string): Promise<boolean> => {
    if (currentStatus !== 'playing' || engineThinking) return false;

    let move;
    try {
      move = game.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }

    if (!move) return false;

    setFen(game.fen());
    setMoveCount((previous) => previous + 1);

    if (game.isGameOver()) {
      setStatus('game-over');
      setResult('Conversion complete');
      onComplete?.({ endgame_strength: endgameStrength, moveCount: moveCount + 1, success: true });
      return true;
    }

    setEngineThinking(true);
    const reply = await moveCalibrationOpponent(game.fen(), { depth: 6, skillLevel: 8 });
    setEngineThinking(false);

    if (reply) {
      const engineMove = game.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] as 'q' | 'r' | 'b' | 'n' | undefined });
      if (engineMove) {
        setFen(game.fen());
      }
    }

    if (game.isGameOver()) {
      setStatus('game-over');
      setResult('Conversion complete');
      onComplete?.({ endgame_strength: endgameStrength, moveCount: moveCount + 1, success: true });
    }

    return true;
  };

  const handlePromotionCheck = (sourceSquare: string, targetSquare: string, piece: string): boolean => {
    if (piece[1] !== 'P') return false;
    const targetRank = targetSquare[1];
    const isPromotion = (piece[0] === 'w' && targetRank === '8') || (piece[0] === 'b' && targetRank === '1');
    if (!isPromotion) return false;
    setPendingPromotion({ from: sourceSquare, to: targetSquare });
    return true;
  };

  const handlePromotionPieceSelect = async (piece?: string): Promise<boolean> => {
    if (!piece || !pendingPromotion) {
      setPendingPromotion(null);
      return false;
    }

    const promotion = piece[1].toLowerCase() as 'q' | 'r' | 'b' | 'n';
    let move;
    try {
      move = game.move({ ...pendingPromotion, promotion });
    } catch {
      setPendingPromotion(null);
      return false;
    }
    setPendingPromotion(null);
    if (!move) return false;

    setFen(game.fen());
    setMoveCount((previous) => previous + 1);
    return true;
  };

  if (!task) return null;

  return (
    <section className="calibration-task-shell" data-task-name="Task 3 · Endgame technique">
      <header className="calibration-task-header">
        <div>
          <p className="calibration-task-eyebrow">Task 3 · Endgame technique</p>
          <h2>Convert the Lucena-style endgame under a 25-move budget.</h2>
        </div>
        <dl className="calibration-task-stats">
          <div>
            <dt>Moves</dt>
            <dd>{moveCount}</dd>
          </div>
          <div>
            <dt>Endgame strength</dt>
            <dd>{endgameStrength}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{currentStatus === 'playing' ? 'Playing' : result ?? 'Game over'}</dd>
          </div>
        </dl>
      </header>

      <BoardView
        fen={fen}
        playerColor="white"
        status={currentStatus}
        engineThinking={engineThinking}
        onPieceDrop={(from, to) => {
          void handleDrop(from, to);
          return true;
        }}
        onPromotionCheck={handlePromotionCheck}
        onPromotionPieceSelect={(piece) => {
          void handlePromotionPieceSelect(piece);
          return true;
        }}
        themeManifest={themeManifest}
      />

      <footer className="calibration-task-footer">
        <span>{task.source}</span>
        <span>{task.success}</span>
      </footer>
    </section>
  );
}
