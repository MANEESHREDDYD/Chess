import type { MoveClassification } from './reviewTypes';

export const MATE_SCORE_BOUND = 10000;

export interface EngineScoreLike {
  cp?: number | null;
  mate?: number | null;
}

export interface MoveClassificationInput {
  cpLoss?: number | null;
  bestEvalForMover?: number | null;
  playedEvalForMover?: number | null;
  legalCandidateCount?: number;
  isBook?: boolean;
}

export function engineScoreToCentipawns(score: EngineScoreLike | null | undefined): number | null {
  if (!score) return null;
  if (score.mate !== undefined && score.mate !== null) {
    return score.mate > 0
      ? MATE_SCORE_BOUND - Math.min(Math.abs(score.mate), MATE_SCORE_BOUND)
      : -MATE_SCORE_BOUND + Math.min(Math.abs(score.mate), MATE_SCORE_BOUND);
  }
  if (score.cp !== undefined && score.cp !== null && Number.isFinite(score.cp)) {
    return Math.round(score.cp);
  }
  return null;
}

export function normalizePlayedEvalForMover(afterMoveScore: EngineScoreLike | null | undefined): number | null {
  const afterEvalForSideToMove = engineScoreToCentipawns(afterMoveScore);
  return afterEvalForSideToMove === null ? null : -afterEvalForSideToMove;
}

export function calculateCpLoss(
  bestEvalForMover: number | null | undefined,
  playedEvalForMover: number | null | undefined
): number | null {
  if (bestEvalForMover === null || bestEvalForMover === undefined) return null;
  if (playedEvalForMover === null || playedEvalForMover === undefined) return null;
  if (!Number.isFinite(bestEvalForMover) || !Number.isFinite(playedEvalForMover)) return null;
  return Math.min(MATE_SCORE_BOUND, Math.max(0, Math.round(bestEvalForMover - playedEvalForMover)));
}

export function classifyMove(input: MoveClassificationInput): MoveClassification {
  if (input.isBook) return 'book';
  if (input.legalCandidateCount === 1) return 'forced';

  const cpLoss = input.cpLoss;
  if (cpLoss === null || cpLoss === undefined || !Number.isFinite(cpLoss)) return 'unknown';

  if (isMissedWin(input.bestEvalForMover, input.playedEvalForMover, cpLoss)) return 'missed_win';

  if (cpLoss <= 10) return 'best';
  if (cpLoss <= 25) return 'excellent';
  if (cpLoss <= 60) return 'good';
  if (cpLoss <= 120) return 'inaccuracy';
  if (cpLoss <= 250) return 'mistake';
  return 'blunder';
}

export function isMissedWin(
  bestEvalForMover: number | null | undefined,
  playedEvalForMover: number | null | undefined,
  cpLoss: number
): boolean {
  if (bestEvalForMover === null || bestEvalForMover === undefined) return false;
  if (playedEvalForMover === null || playedEvalForMover === undefined) return false;
  return bestEvalForMover >= 600 && playedEvalForMover < 250 && cpLoss >= 250;
}

export function classificationSeverity(classification: MoveClassification): number {
  switch (classification) {
    case 'blunder':
      return 6;
    case 'missed_win':
      return 5;
    case 'mistake':
      return 4;
    case 'inaccuracy':
      return 3;
    case 'good':
      return 2;
    case 'excellent':
      return 1;
    case 'best':
    case 'book':
    case 'forced':
      return 0;
    default:
      return -1;
  }
}

export function classificationLabel(classification: MoveClassification): string {
  return classification.replace(/_/g, ' ');
}
