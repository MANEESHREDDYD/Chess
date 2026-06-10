import { classificationSeverity } from './moveClassifier';
import type { KeyMoment, MoveReview } from './reviewTypes';

export function detectKeyMoments(moves: MoveReview[]): KeyMoment[] {
  const moments: KeyMoment[] = [];
  const largestLoss = [...moves]
    .filter((move) => typeof move.cp_loss === 'number')
    .sort((a, b) => (b.cp_loss ?? 0) - (a.cp_loss ?? 0))[0];

  if (largestLoss && (largestLoss.cp_loss ?? 0) > 60) {
    moments.push(momentFromMove(largestLoss, 'largest_cp_loss', 'Largest CP-loss move in the reviewed game.'));
  }

  const firstMajorBlunder = moves.find((move) => move.classification === 'blunder');
  if (firstMajorBlunder) {
    moments.push(momentFromMove(firstMajorBlunder, 'first_major_blunder', 'First major blunder detected by deterministic CP-loss thresholds.'));
  }

  const missedWin = moves.find((move) => move.classification === 'missed_win');
  if (missedWin) {
    moments.push(momentFromMove(missedWin, 'missed_win', 'A strong advantage was available before this move, but the played move gave most of it back.'));
  }

  const swing = moves.find(
    (move) =>
      typeof move.eval_before === 'number' &&
      typeof move.eval_after === 'number' &&
      Math.sign(move.eval_before) !== Math.sign(move.eval_after) &&
      Math.abs(move.eval_before - move.eval_after) >= 180
  );
  if (swing) {
    moments.push(momentFromMove(swing, 'swing_move', 'The evaluation changed sides or swung sharply after this move.'));
  }

  const repeated = repeatedPatternMoment(moves);
  if (repeated) moments.push(repeated);

  const criticalEndgame = moves.find(
    (move) =>
      move.phase === 'endgame' &&
      (move.classification === 'mistake' ||
        move.classification === 'blunder' ||
        move.classification === 'missed_win')
  );
  if (criticalEndgame) {
    moments.push(momentFromMove(criticalEndgame, 'critical_endgame', 'A late-phase mistake changed the quality of the endgame.'));
  }

  return dedupeMoments(moments).map((moment) => ({
    ...moment,
    suggested_retry: moment.best_move
      ? `Retry from move ${moment.move_number} and look for ${moment.best_move}.`
      : `Retry from move ${moment.move_number} and compare your move to the reviewed best line.`,
  }));
}

export function markTurningPoints(moves: MoveReview[], keyMoments: KeyMoment[]): MoveReview[] {
  const turningPly = new Set(keyMoments.map((moment) => moment.ply));
  return moves.map((move) => ({
    ...move,
    is_turning_point: turningPly.has(move.ply) || classificationSeverity(move.classification) >= 4,
  }));
}

function repeatedPatternMoment(moves: MoveReview[]): KeyMoment | null {
  const mistakeMoves = moves.filter(
    (move) =>
      classificationSeverity(move.classification) >= 3 &&
      move.motif_tags.some((tag) => tag !== 'unknown')
  );
  const counts = new Map<string, MoveReview[]>();

  for (const move of mistakeMoves) {
    for (const motif of move.motif_tags) {
      if (motif === 'unknown') continue;
      counts.set(motif, [...(counts.get(motif) ?? []), move]);
    }
  }

  const repeated = [...counts.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
  if (!repeated) return null;

  const [motif, rows] = repeated;
  const representative = rows.sort((a, b) => classificationSeverity(b.classification) - classificationSeverity(a.classification))[0];
  return {
    ...momentFromMove(representative, 'repeated_pattern', `Repeated tactical pattern: ${motif}.`),
    evidence: [
      `${rows.length} reviewed move(s) shared the ${motif} tag.`,
      ...representative.evidence.slice(0, 2),
    ],
  };
}

function momentFromMove(move: MoveReview, type: KeyMoment['type'], reason: string): KeyMoment {
  return {
    id: `${type}-${move.ply}`,
    type,
    ply: move.ply,
    move_number: move.move_number,
    san: move.san,
    classification: move.classification,
    phase: move.phase,
    reason,
    evidence: [
      `Move ${move.move_number}${move.side === 'black' ? '...' : '.'} ${move.san}`,
      typeof move.cp_loss === 'number' ? `CP loss: ${move.cp_loss}` : 'CP loss unavailable',
      ...move.evidence.slice(0, 3),
    ],
    suggested_retry: '',
    cp_loss: move.cp_loss,
    best_move: move.best_move,
  };
}

function dedupeMoments(moments: KeyMoment[]): KeyMoment[] {
  const seen = new Set<string>();
  const unique: KeyMoment[] = [];
  for (const moment of moments) {
    const key = `${moment.type}:${moment.ply}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(moment);
  }
  return unique.slice(0, 6);
}
