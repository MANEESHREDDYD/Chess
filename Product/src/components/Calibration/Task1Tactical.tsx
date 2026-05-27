import type { ThemeManifest } from '../../lib/theme';
import { TaskBoardShell } from './TaskBoardShell';
import { getTacticalTaskPositions } from './taskData';

type Task1TacticalProps = {
  themeManifest?: ThemeManifest | null;
  onComplete?: (result: {
    taskName: string;
    correctCount: number;
    missedPositions: string[];
    timePressureBlunderRate: number;
    timedOut: boolean;
  }) => void;
};

export function Task1Tactical({ themeManifest = null, onComplete }: Task1TacticalProps) {
  return (
    <TaskBoardShell
      taskName="Task 1 · Tactical sight"
      taskSubtitle="Find the honest move in each position."
      positions={getTacticalTaskPositions(1)}
      softTimeLimitMs={60000}
      hardTimeLimitMs={90000}
      themeManifest={themeManifest}
      onComplete={onComplete}
    />
  );
}
