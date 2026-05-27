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

type OpeningChoiceTask = {
  id: number;
  fen: string;
  choices: string[];
};

type BlackRepertoirePosition = {
  after_white: string;
  fen: string;
  choices: string[];
};

type ExchangePosition = {
  id: string;
  fen: string;
  accept: string;
  decline: string;
  accept_cp: number;
  decline_cp: number;
  kept_minor_accept: 'knight' | 'bishop';
  kept_minor_decline: 'knight' | 'bishop';
};

export function getTacticalTaskPositions(taskId: number): TacticalTaskPosition[] {
  const task = calibrationPositions.tasks.find((entry) => entry.id === taskId) as TacticalTask | undefined;
  return task?.positions ?? [];
}

export function getOpeningChoiceTask(): OpeningChoiceTask | null {
  const task = calibrationPositions.tasks.find((entry) => entry.id === 2) as OpeningChoiceTask | undefined;
  return task ?? null;
}

export function getBlackRepertoireTask(): BlackRepertoirePosition[] {
  const task = calibrationPositions.tasks.find((entry) => entry.id === 6) as
    | { positions?: BlackRepertoirePosition[] }
    | undefined;
  return task?.positions ?? [];
}

export function getExchangePositions(): ExchangePosition[] {
  const task = calibrationPositions.tasks.find((entry) => entry.id === 7) as
    | { positions?: ExchangePosition[] }
    | undefined;
  return task?.positions ?? [];
}
