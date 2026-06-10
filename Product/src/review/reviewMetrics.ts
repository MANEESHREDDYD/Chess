import type { GamePhase, MoveClassification, MoveReview, PhaseQuality, PhaseSummary } from './reviewTypes';

const PHASES: GamePhase[] = ['opening', 'middlegame', 'endgame'];
const COUNTED_CLASSIFICATIONS: MoveClassification[] = [
  'best',
  'excellent',
  'good',
  'inaccuracy',
  'mistake',
  'blunder',
  'missed_win',
];

export interface SideReviewMetrics {
  side: 'white' | 'black' | 'both';
  move_count: number;
  average_cp_loss: number;
  accuracy_estimate: number;
  best_count: number;
  excellent_count: number;
  good_count: number;
  inaccuracy_count: number;
  mistake_count: number;
  blunder_count: number;
  missed_win_count: number;
  turning_point_count: number;
}

export interface ReviewMetrics {
  white: SideReviewMetrics;
  black: SideReviewMetrics;
  total: SideReviewMetrics;
  phase_summary: PhaseSummary;
}

export function computeReviewMetrics(moves: MoveReview[]): ReviewMetrics {
  const white = computeSideMetrics(moves.filter((move) => move.side === 'white'), 'white');
  const black = computeSideMetrics(moves.filter((move) => move.side === 'black'), 'black');
  const total = {
    ...computeSideMetrics(moves, 'white'),
    side: 'both' as const,
  };

  return {
    white,
    black,
    total,
    phase_summary: computePhaseSummary(moves),
  };
}

export function computeSideMetrics(
  moves: MoveReview[],
  side: 'white' | 'black' | 'both'
): SideReviewMetrics {
  const countedMoves = moves.filter((move) => isCounted(move.classification));
  const losses = countedMoves
    .map((move) => move.cp_loss)
    .filter((loss): loss is number => typeof loss === 'number' && Number.isFinite(loss));
  const averageCpLoss = losses.length > 0 ? round(mean(losses), 2) : 0;

  return {
    side,
    move_count: moves.length,
    average_cp_loss: averageCpLoss,
    accuracy_estimate: estimateAccuracyFromCpLoss(averageCpLoss),
    best_count: countClassification(moves, 'best'),
    excellent_count: countClassification(moves, 'excellent'),
    good_count: countClassification(moves, 'good'),
    inaccuracy_count: countClassification(moves, 'inaccuracy'),
    mistake_count: countClassification(moves, 'mistake'),
    blunder_count: countClassification(moves, 'blunder'),
    missed_win_count: countClassification(moves, 'missed_win'),
    turning_point_count: moves.filter((move) => move.is_turning_point).length,
  };
}

export function computePhaseSummary(moves: MoveReview[]): PhaseSummary {
  const qualities = Object.fromEntries(
    PHASES.map((phase) => [phase, computePhaseQuality(phase, moves.filter((move) => move.phase === phase))])
  ) as Record<GamePhase, PhaseQuality>;

  const populated = PHASES.map((phase) => qualities[phase]).filter((row) => row.moves > 0);
  const weakest = populated.length > 0
    ? [...populated].sort((a, b) => b.average_cp_loss - a.average_cp_loss || b.blunder_count - a.blunder_count)[0].phase
    : 'insufficient_data';

  return {
    opening: qualities.opening,
    middlegame: qualities.middlegame,
    endgame: qualities.endgame,
    weakest_phase: weakest,
    summary: weakest === 'insufficient_data'
      ? 'Not enough reviewed moves to identify a phase weakness.'
      : `Largest MIRROR internal CP-loss came in the ${weakest}.`,
  };
}

export function estimateAccuracyFromCpLoss(averageCpLoss: number): number {
  if (!Number.isFinite(averageCpLoss)) return 0;
  return round(clamp(100 - averageCpLoss * 0.45, 0, 100), 1);
}

function computePhaseQuality(phase: GamePhase, moves: MoveReview[]): PhaseQuality {
  const losses = moves
    .map((move) => move.cp_loss)
    .filter((loss): loss is number => typeof loss === 'number' && Number.isFinite(loss));
  const averageCpLoss = losses.length > 0 ? round(mean(losses), 2) : 0;
  const blunders = countClassification(moves, 'blunder');
  const mistakes = countClassification(moves, 'mistake');
  const inaccuracies = countClassification(moves, 'inaccuracy');

  return {
    phase,
    moves: moves.length,
    average_cp_loss: averageCpLoss,
    blunder_count: blunders,
    mistake_count: mistakes,
    inaccuracy_count: inaccuracies,
    summary: moves.length === 0
      ? `No ${phase} moves reviewed.`
      : `${phase} reviewed: ${averageCpLoss} average CP loss, ${blunders} blunder(s), ${mistakes} mistake(s).`,
  };
}

function countClassification(moves: MoveReview[], classification: MoveClassification): number {
  return moves.filter((move) => move.classification === classification).length;
}

function isCounted(classification: MoveClassification): boolean {
  return COUNTED_CLASSIFICATIONS.includes(classification);
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
