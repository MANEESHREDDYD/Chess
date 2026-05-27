import calibrationPositions from '../../data/calibrationPositions.json';

export type TacticalTaskPosition = {
  id: string;
  fen: string;
  expected_best_move: string;
  motif?: string;
  candidate_moves?: string[];
  source?: string;
  source_lichess_puzzle_id?: string;
};

type TacticalTask = {
  id: number;
  positions?: TacticalTaskPosition[];
};

export function getTacticalTaskPositions(taskId: number): TacticalTaskPosition[] {
  const task = calibrationPositions.tasks.find((entry) => entry.id === taskId) as TacticalTask | undefined;
  return task?.positions ?? [];
}
