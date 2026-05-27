import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { BoardView } from '../Board/BoardView';
import { TaskButtonGrid } from './TaskButtonGrid';
import { pieceIcon } from './pieceIcons';
import type { ThemeManifest } from '../../lib/theme';
import { getMoralChessTask } from './taskData';

type PlyState = {
  fen: string;
  move?: string;
};

type Task5MoralChessProps = {
  themeManifest?: ThemeManifest | null;
  onComplete?: (result: { selectedChoice: string; revealedPlies: number; outcome: string }) => void;
};

export function Task5MoralChess({ themeManifest = null, onComplete }: Task5MoralChessProps) {
  const task = getMoralChessTask();
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [plyStates, setPlyStates] = useState<PlyState[]>([]);
  const [plyIndex, setPlyIndex] = useState(0);
  const [outcome, setOutcome] = useState<string>('Choose a move.');
  const [phase, setPhase] = useState<'idle' | 'revealing' | 'resolved' | 'complete'>('idle');

  useEffect(() => {
    if (phase !== 'revealing' || plyIndex >= Math.max(0, plyStates.length - 1)) return;

    const timer = window.setTimeout(() => {
      setPlyIndex((previous) => Math.min(previous + 1, Math.max(0, plyStates.length - 1)));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [phase, plyIndex, plyStates.length]);

  useEffect(() => {
    if (phase !== 'revealing' || plyStates.length === 0) return;
    if (plyIndex < plyStates.length - 1) return;

    setPhase('resolved');
    setOutcome(selectedChoice === 'swindle' ? 'The trap depends on the reply.' : 'Patient conversion keeps the edge.')
    const timer = window.setTimeout(() => {
      setPhase('complete');
      onComplete?.({
        selectedChoice: selectedChoice ?? 'unknown',
        revealedPlies: Math.max(0, plyStates.length - 1),
        outcome: selectedChoice === 'swindle' ? 'swindle' : 'principled',
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [onComplete, phase, plyIndex, plyStates.length, selectedChoice]);

  const currentFen = plyStates[plyIndex]?.fen ?? task?.fen ?? '8/8/8/8/8/8/8/8 w - - 0 1';

  const options = useMemo(() => {
    if (!task) return [];

    return task.choices.map((choice, index) => ({
      id: choice.id,
      label: choice.label,
      description: index === 0 ? 'Long and certain.' : 'Short and dependent on error.',
      icon: pieceIcon(index === 0 ? 'wQ' : 'bQ'),
      selected: selectedChoice === choice.id,
    }));
  }, [selectedChoice, task]);

  if (!task) return null;
  const moralTask = task;

  function buildLine(choiceId: string): PlyState[] {
    const start = new Chess(moralTask.fen);
    const states: PlyState[] = [{ fen: start.fen() }];

    const branch = moralTask.choices.find((choice) => choice.id === choiceId);
    if (!branch) return states;

    const firstMove = branch.move;
    applyMove(start, firstMove);
    states.push({ fen: start.fen(), move: firstMove });

    const nextMoves =
      choiceId === 'swindle'
        ? moralTask.swindle_line.slice(1, 3)
        : firstLegalLine(start, 2);

    for (const move of nextMoves) {
      if (!applyMove(start, move)) break;
      states.push({ fen: start.fen(), move });
    }

    return states;
  }

  function applyMove(game: Chess, move: string): boolean {
    try {
      const result = game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] as 'q' | 'r' | 'b' | 'n' | undefined });
      return Boolean(result);
    } catch {
      return false;
    }
  }

  function firstLegalLine(game: Chess, plies: number): string[] {
    const line: string[] = [];
    for (let index = 0; index < plies; index += 1) {
      const legalMove = game.moves({ verbose: true })[0];
      if (!legalMove) break;
      const uci = `${legalMove.from}${legalMove.to}${legalMove.promotion ?? ''}`;
      if (!applyMove(game, uci)) break;
      line.push(uci);
    }
    return line;
  }

  function selectChoice(choiceId: string): void {
    const line = buildLine(choiceId);
    setSelectedChoice(choiceId);
    setPlyStates(line);
    setPlyIndex(0);
    setOutcome('Revealing the line...');
    setPhase('revealing');
  }

  return (
    <section className="calibration-task-shell" data-task-name="Task 5 · Moral chess">
      <header className="calibration-task-header">
        <div>
          <p className="calibration-task-eyebrow">Task 5 · Moral chess</p>
          <h2>Choose the patient conversion or the swindle.</h2>
        </div>
        <dl className="calibration-task-stats">
          <div>
            <dt>Choice</dt>
            <dd>{selectedChoice ?? 'None'}</dd>
          </div>
          <div>
            <dt>Ply</dt>
            <dd>{plyIndex}</dd>
          </div>
          <div>
            <dt>Outcome</dt>
            <dd>{outcome}</dd>
          </div>
        </dl>
      </header>

      <TaskButtonGrid
        title="Pick a labeled move"
        subtitle="One line is long and certain. The other only works if the opponent blunders soon."
        columns={2}
        options={options}
        onChoose={selectChoice}
      />

      <BoardView
        fen={currentFen}
        playerColor="white"
        status={phase === 'complete' ? 'game-over' : 'playing'}
        engineThinking={false}
        onPieceDrop={() => false}
        onPromotionCheck={() => false}
        onPromotionPieceSelect={() => false}
        themeManifest={themeManifest}
      />

      <footer className="calibration-task-footer">
        <span>{moralTask.source}</span>
        <span>{phase === 'resolved' || phase === 'complete' ? 'Ready to continue in 1s' : 'Step through 3 plies'}</span>
      </footer>
    </section>
  );
}
