import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { BoardView } from '../Board/BoardView';
import { init as initCalibrationOpponent, move as moveCalibrationOpponent, dispose as disposeCalibrationOpponent } from '../../engine/calibrationOpponent';
import type { ThemeManifest } from '../../lib/theme';
import { getEndgameTechniqueTask } from './taskData';

function computeStrength(moves: number): number {
  return Math.max(0, 100 - moves * 4);
}

function evaluateUserOutcome(game: Chess, userPromoted: boolean): 'user_won' | 'draw' | 'continuing' {
  if (userPromoted) return 'user_won';
  if (game.isCheckmate()) {
    // Side TO MOVE has just been mated. User mated the opponent iff Black is to move.
    return game.turn() === 'b' ? 'user_won' : 'draw';
  }
  if (game.isDraw()) return 'draw';
  return 'continuing';
}

function evaluateEngineOutcome(game: Chess): 'user_lost' | 'draw' | 'continuing' {
  if (game.isCheckmate()) {
    // Engine just moved. If White is now to move and in mate, the engine mated the user.
    return game.turn() === 'w' ? 'user_lost' : 'continuing';
  }
  if (game.isDraw()) return 'draw';
  return 'continuing';
}

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
  const [endgameStrength, setEndgameStrength] = useState(0);
  const mountedRef = useRef(true);
  const statusRef = useRef(status);
  const completionSentRef = useRef(false);

  const completeOnce = useCallback(
    (resultPayload: { endgame_strength: number; moveCount: number; success: boolean }): void => {
      if (completionSentRef.current) return;
      completionSentRef.current = true;
      onComplete?.(resultPayload);
    },
    [onComplete]
  );

  useEffect(() => {
    void initCalibrationOpponent({ depth: 6, skillLevel: 8 });
    return () => {
      mountedRef.current = false;
      disposeCalibrationOpponent();
    };
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (moveCount >= 25 && status === 'playing') {
      setStatus('game-over');
      setResult('Conversion budget exhausted');
      completeOnce({ endgame_strength: computeStrength(moveCount), moveCount, success: false });
    }
  }, [completeOnce, moveCount, status]);

  useEffect(() => {
    setEndgameStrength(Math.max(0, 100 - moveCount * 4));
  }, [moveCount]);

  const currentStatus = useMemo(() => status, [status]);

  const playEngineReply = async (nextMoveCount: number): Promise<void> => {
    const reply = await moveCalibrationOpponent(game.fen(), { depth: 6, skillLevel: 8 });
    if (!mountedRef.current || statusRef.current !== 'playing') return;
    setEngineThinking(false);

    if (reply) {
      const engineMove = game.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] as 'q' | 'r' | 'b' | 'n' | undefined });
      if (engineMove) {
        setFen(game.fen());
      }
    }

    const engineOutcome = evaluateEngineOutcome(game);
    if (engineOutcome !== 'continuing') {
      setStatus('game-over');
      setResult(engineOutcome === 'user_lost' ? 'You were mated' : 'Game ended without conversion');
      completeOnce({ endgame_strength: 0, moveCount: nextMoveCount, success: false });
    }

    return;
  };

  const completeUserMove = (nextMoveCount: number, userPromoted: boolean): boolean => {
    setFen(game.fen());
    setMoveCount(nextMoveCount);

    const userOutcome = evaluateUserOutcome(game, userPromoted);
    if (userOutcome !== 'continuing') {
      setStatus('game-over');
      const userSuccess = userOutcome === 'user_won';
      setResult(userSuccess ? 'Conversion complete' : 'Game ended without conversion');
      completeOnce({
        endgame_strength: userSuccess ? computeStrength(nextMoveCount) : 0,
        moveCount: nextMoveCount,
        success: userSuccess,
      });
      return true;
    }

    setEngineThinking(true);
    void playEngineReply(nextMoveCount);
    return true;
  };

  const handleDrop = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n'): boolean => {
    if (currentStatus !== 'playing' || engineThinking) return false;

    let move;
    try {
      move = game.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return false;
    }

    if (!move) return false;

    return completeUserMove(moveCount + 1, Boolean(move.promotion));
  };

  const handlePromotionCheck = (sourceSquare: string, targetSquare: string, piece: string): boolean => {
    return Boolean(sourceSquare && targetSquare && piece);
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
        onPieceDrop={handleDrop}
        onPromotionCheck={handlePromotionCheck}
        onPromotionPieceSelect={() => false}
        themeManifest={themeManifest}
      />

      <footer className="calibration-task-footer">
        <span>{task.source}</span>
        <span>{task.success}</span>
      </footer>
    </section>
  );
}
