import type { StyleVector } from '../../ml/styleVector';

export function generateSummary(vector: StyleVector): string {
  const opening = openingSummary(vector);
  const tempo = tempoSummary(vector);
  const endgame = endgameSummary(vector);
  const swindle = vector.swindle_preference === 'swindle' ? 'You are willing to tempt fate when the board invites it.' : vector.swindle_preference === 'principled' ? 'You prefer the cleaner line even when the trap looks tempting.' : 'Your moral preference is still undecided.';

  return `${opening} ${tempo} ${endgame} ${swindle}`.replace(/\s+/g, ' ').trim();
}

function openingSummary(vector: StyleVector): string {
  const whiteOpen = vector.opening_white_top3[0] ?? 'unknown';
  const blackOpen = vector.opening_black_top3[0] ?? 'unknown';
  return `As White you lean toward ${whiteOpen}, and as Black you answer with ${blackOpen}.`;
}

function tempoSummary(vector: StyleVector): string {
  if (vector.avg_move_time_ms >= 15_000) return 'Your moves are patient and deliberate.';
  if (vector.avg_move_time_ms >= 7_000) return 'Your pace is measured without being slow.';
  return 'You are direct and quick to commit.';
}

function endgameSummary(vector: StyleVector): string {
  if (vector.endgame_strength >= 0.75) return 'The endgame looks like a place where you know what to do.';
  if (vector.endgame_strength >= 0.4) return 'The endgame is usable, but not yet a certainty.';
  return 'The endgame is still a weak point.';
}
