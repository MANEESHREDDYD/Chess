import { TaskBoardShell } from './TaskBoardShell';
import { getTacticalTaskPositions } from './taskData';

export function Task1Tactical() {
  return (
    <TaskBoardShell
      taskName="Task 1 · Tactical sight"
      taskSubtitle="Find the honest move in each position."
      positions={getTacticalTaskPositions(1)}
      softTimeLimitMs={12000}
      hardTimeLimitMs={18000}
    />
  );
}
