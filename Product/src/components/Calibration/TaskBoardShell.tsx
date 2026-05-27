import { useEffect, useMemo, useRef, useState } from 'react';
import { BoardView } from '../Board/BoardView';
import type { ThemeManifest } from '../../lib/theme';
import type { TacticalTaskPosition } from './taskData';

type TaskBoardShellProps = {
  taskName: string;
  taskSubtitle: string;
  positions: TacticalTaskPosition[];
  softTimeLimitMs?: number;
  hardTimeLimitMs?: number;
  themeManifest?: ThemeManifest | null;
  onComplete?: (result: {
    taskName: string;
    correctCount: number;
    missedPositions: string[];
    timePressureBlunderRate: number;
    timedOut: boolean;
  }) => void;
};

export function TaskBoardShell({
  taskName,
  taskSubtitle,
  positions,
  softTimeLimitMs,
  hardTimeLimitMs,
  themeManifest = null,
  onComplete,
}: TaskBoardShellProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [missedPositions, setMissedPositions] = useState<string[]>([]);
  const [timedOut, setTimedOut] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const startedAtRef = useRef(Date.now());
  const completionSentRef = useRef(false);

  const currentPosition = positions[currentIndex] ?? null;
  const finished = timedOut || currentIndex >= positions.length;
  const elapsedMs = now - startedAtRef.current;
  const softRemainingMs = softTimeLimitMs == null ? null : Math.max(0, softTimeLimitMs - elapsedMs);
  const hardRemainingMs = hardTimeLimitMs == null ? null : Math.max(0, hardTimeLimitMs - elapsedMs);

  useEffect(() => {
    startedAtRef.current = Date.now();
    setNow(Date.now());
  }, [currentIndex]);

  useEffect(() => {
    if (!currentPosition || finished) return;

    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [currentPosition, finished]);

  useEffect(() => {
    if (hardRemainingMs !== 0 || !currentPosition || timedOut) return;

    setTimedOut(true);
    setMissedPositions((previous) => [...previous, currentPosition.id]);
  }, [currentPosition, hardRemainingMs, timedOut]);

  useEffect(() => {
    if (!finished || completionSentRef.current) return;

    completionSentRef.current = true;
    onComplete?.({
      taskName,
      correctCount,
      missedPositions,
      timePressureBlunderRate: positions.length === 0 ? 0 : missedPositions.length / positions.length,
      timedOut,
    });
  }, [correctCount, finished, missedPositions, onComplete, positions.length, taskName, timedOut]);

  const taskSummary = useMemo(() => {
    if (!currentPosition) return 'No positions loaded.';
    return `${currentIndex + 1} / ${positions.length} · ${currentPosition.id}`;
  }, [currentIndex, currentPosition, positions.length]);

  const handlePieceDrop = (sourceSquare: string, targetSquare: string, promotion?: string): boolean => {
    if (!currentPosition || finished) return false;

    const attemptedMove = `${sourceSquare}${targetSquare}${promotion ?? ''}`;
    if (attemptedMove !== currentPosition.expected_best_move) {
      setMissedPositions((previous) => [...previous, currentPosition.id]);
      return false;
    }

    setCorrectCount((previous) => previous + 1);
    if (currentIndex + 1 >= positions.length) {
      setCurrentIndex(positions.length);
      return true;
    }

    completionSentRef.current = false;
    setCurrentIndex((previous) => previous + 1);
    return true;
  };

  return (
    <section className="calibration-task-shell" data-task-name={taskName}>
      <header className="calibration-task-header">
        <div>
          <p className="calibration-task-eyebrow">{taskName}</p>
          <h2>{taskSubtitle}</h2>
        </div>
        <dl className="calibration-task-stats">
          <div>
            <dt>Correct</dt>
            <dd>{correctCount}</dd>
          </div>
          <div>
            <dt>Misses</dt>
            <dd>{missedPositions.length}</dd>
          </div>
          <div>
            <dt>Time left</dt>
            <dd>{softRemainingMs == null ? '—' : `${Math.ceil(softRemainingMs / 1000)}s`}</dd>
          </div>
        </dl>
      </header>

      <p className="calibration-task-progress">{taskSummary}</p>

      <BoardView
        fen={currentPosition?.fen ?? '8/8/8/8/8/8/8/8 w - - 0 1'}
        playerColor="white"
        status={finished ? 'game-over' : 'playing'}
        engineThinking={false}
        onPieceDrop={handlePieceDrop}
        onPromotionCheck={() => false}
        onPromotionPieceSelect={() => false}
        themeManifest={themeManifest}
      />

      <footer className="calibration-task-footer">
        <span>{hardRemainingMs == null ? 'No hard timer' : `Hard stop in ${Math.ceil(hardRemainingMs / 1000)}s`}</span>
        <span>{timedOut ? 'Timed out' : 'Active'}</span>
      </footer>
    </section>
  );
}
