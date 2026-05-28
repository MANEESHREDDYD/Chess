import type { ThemeManifest } from '../../lib/theme';
import { TaskBoardShell } from './TaskBoardShell';
import { getTacticalTaskPositions } from './taskData';

type Task4TacticalRaceProps = {
  themeManifest?: ThemeManifest | null;
  onComplete?: (result: {
    taskName: string;
    correctCount: number;
    missedPositions: string[];
    timePressureBlunderRate: number;
    timedOut: boolean;
  }) => void;
};

export function Task4TacticalRace({ themeManifest = null, onComplete }: Task4TacticalRaceProps) {
  return (
    <TaskBoardShell
      taskName="Task 4 · Tactical race"
      taskSubtitle="Same kind of question, less time on the clock."
      positions={getTacticalTaskPositions(4)}
      softTimeLimitMs={15000}
      hardTimeLimitMs={20000}
      themeManifest={themeManifest}
      onComplete={onComplete}
    />
  );
}
