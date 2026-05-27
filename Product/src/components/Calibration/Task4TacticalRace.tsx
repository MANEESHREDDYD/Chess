import { TaskBoardShell } from './TaskBoardShell';
import { getTacticalTaskPositions } from './taskData';

export function Task4TacticalRace() {
  return (
    <TaskBoardShell
      taskName="Task 4 · Tactical race"
      taskSubtitle="Same kind of question, less time on the clock."
      positions={getTacticalTaskPositions(4)}
      softTimeLimitMs={15000}
      hardTimeLimitMs={20000}
    />
  );
}
