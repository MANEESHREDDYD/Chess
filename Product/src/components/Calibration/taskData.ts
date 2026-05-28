// Content-loading pattern (the content seam — docs/ARCHITECTURE.md §B.5):
//
//   src/data/<content>.json      ← authored static JSON, build-time import
//   src/.../taskData.ts          ← thin typed accessors, no runtime fetch
//
// Future content types (story dialogue, task definitions, lessons) should
// follow the same shape: a JSON file under src/data/ and a typed accessor
// module next to its consumers. If a content file grows past ~100 KB, switch
// from a top-level `import` to a lazy `await import(...)` so it stays out of
// the main bundle. Do not build a generic content registry until two
// non-calibration content types exist.

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

type EndgameTask = {
  id: number;
  fen: string;
  source?: string;
  success?: string;
  partial?: string;
};

type MoralChessTask = {
  id: number;
  fen: string;
  choices: Array<{ id: string; move: string; label: string; depth14_cp: number }>;
  swindle_line: string[];
  source?: string;
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

export function getEndgameTechniqueTask(): EndgameTask | null {
  const task = calibrationPositions.tasks.find((entry) => entry.id === 3) as EndgameTask | undefined;
  return task ?? null;
}

export function getMoralChessTask(): MoralChessTask | null {
  const task = calibrationPositions.tasks.find((entry) => entry.id === 5) as MoralChessTask | undefined;
  return task ?? null;
}
