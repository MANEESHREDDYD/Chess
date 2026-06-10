import type { StyleVector } from '../ml/styleVector';
import type { KeyMoment, MoveReview, PersonalizedReviewSummary, RecommendedAction } from './reviewTypes';

export interface PersonalizationContext {
  styleVector?: StyleVector | null;
  importedEvidence?: string[];
  clueWeakMotif?: string | null;
  mirrorTraceEvidence?: string[];
}

export function buildStyleVectorNote(
  move: MoveReview,
  context: PersonalizationContext = {}
): { note?: string; evidence: string[] } {
  const vector = context.styleVector;
  if (!vector) {
    return {
      note: 'Insufficient personal evidence; complete calibration or import more games for StyleVector notes.',
      evidence: ['No StyleVector was available for this review.'],
    };
  }

  const evidence: string[] = [];

  if (move.motif_tags.some((tag) => tag in vector.motif_blindness)) {
    const motif = move.motif_tags.find((tag) => Number(vector.motif_blindness[tag as keyof typeof vector.motif_blindness]) >= 0.35);
    if (motif) {
      const value = vector.motif_blindness[motif as keyof typeof vector.motif_blindness];
      evidence.push(`StyleVector motif blindness for ${motif}: ${value.toFixed(2)}.`);
      return {
        note: `This is related to your local motif evidence around ${motif}.`,
        evidence,
      };
    }
  }

  if (move.motif_tags.includes('capture') && vector.exchange_willingness >= 0.6) {
    evidence.push(`StyleVector exchange willingness: ${vector.exchange_willingness.toFixed(2)}.`);
    return {
      note: 'This matches your exchange-willingness tendency.',
      evidence,
    };
  }

  if (move.motif_tags.includes('queen_move_early') && vector.exchange_willingness >= 0.55) {
    evidence.push(`Early queen move plus exchange willingness ${vector.exchange_willingness.toFixed(2)}.`);
    return {
      note: 'MIRROR sees a forcing-attacking preference here, but the engine evidence suggests this move needs review.',
      evidence,
    };
  }

  if (move.motif_tags.includes('time_pressure_proxy') && vector.time_pressure_blunder_rate >= 0.55) {
    evidence.push(`StyleVector time-pressure blunder rate: ${vector.time_pressure_blunder_rate.toFixed(2)}.`);
    return {
      note: 'This move looks like a time-pressure risk, but no clock data is available for this exact move.',
      evidence,
    };
  }

  if (move.phase === 'endgame' && vector.endgame_strength < 0.45) {
    evidence.push(`StyleVector endgame strength: ${vector.endgame_strength.toFixed(2)}.`);
    return {
      note: 'This connects to your local endgame-strength signal.',
      evidence,
    };
  }

  return {
    note: 'No strong StyleVector pattern was attached to this move; the explanation relies on Stockfish evidence.',
    evidence: ['StyleVector was available, but no matching local pattern crossed the note threshold.'],
  };
}

export function buildPersonalizedSummary(
  moves: MoveReview[],
  keyMoments: KeyMoment[],
  context: PersonalizationContext = {}
): PersonalizedReviewSummary {
  const evidence: string[] = [];
  const insufficientData: string[] = [];
  const notes: string[] = [];

  if (!context.styleVector) {
    insufficientData.push('stylevector_missing');
  } else {
    evidence.push(`StyleVector Elo band: ${context.styleVector.elo_band}.`);
    evidence.push(`Exchange willingness: ${context.styleVector.exchange_willingness.toFixed(2)}.`);
  }

  if (context.importedEvidence?.length) {
    evidence.push(...context.importedEvidence.slice(0, 3));
  }
  if (context.mirrorTraceEvidence?.length) {
    evidence.push(...context.mirrorTraceEvidence.slice(0, 3));
  }

  const major = moves.filter((move) => ['inaccuracy', 'mistake', 'blunder', 'missed_win'].includes(move.classification));
  const motifCounts = motifCount(major);
  const topMotif = [...motifCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];

  if (topMotif && topMotif !== 'unknown') {
    notes.push(`Most repeated review tag: ${topMotif}.`);
    evidence.push(`${motifCounts.get(topMotif)} reviewed issue(s) carried the ${topMotif} tag.`);
  }

  if (context.clueWeakMotif) {
    notes.push(`Clue history also points at ${context.clueWeakMotif}.`);
    evidence.push(`Weak clue motif: ${context.clueWeakMotif}.`);
  }

  if (keyMoments.length > 0) {
    const first = keyMoments[0];
    notes.push(`Start with move ${first.move_number}: ${first.reason}`);
  }

  if (notes.length === 0) {
    notes.push('No major personal pattern was detected; review the key engine moments first.');
  }

  return {
    headline: topMotif && topMotif !== 'unknown'
      ? `Review focus: ${topMotif}`
      : 'Review focus: engine-identified turning points',
    notes,
    evidence: evidence.length > 0 ? evidence : ['No local personal evidence crossed the reporting threshold.'],
    insufficient_data: insufficientData,
  };
}

export function buildRecommendedActions(
  moves: MoveReview[],
  keyMoments: KeyMoment[],
  personalizedSummary: PersonalizedReviewSummary
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const retryMove = keyMoments.find((moment) => moment.best_move) ?? keyMoments[0];
  if (retryMove) {
    actions.push({
      id: `retry-${retryMove.ply}`,
      type: 'retry',
      title: `Retry move ${retryMove.move_number}`,
      description: retryMove.suggested_retry,
      evidence: retryMove.evidence,
      priority: 'high',
    });
  }

  const motif = topProblemMotif(moves);
  if (motif) {
    actions.push({
      id: `clue-${motif}`,
      type: 'clue',
      title: `Practice ${motif}`,
      description: `Open Clue Chess with this motif in mind, then return to the reviewed position.`,
      route: '/clue-chess',
      evidence: [`${motif} appeared in reviewed issue tags.`],
      priority: 'high',
    });
  }

  if (personalizedSummary.insufficient_data.length > 0) {
    actions.push({
      id: 'import-or-calibrate',
      type: 'import',
      title: 'Add more personal evidence',
      description: 'Import more valid PGNs or complete calibration so future reviews can cite stronger StyleVector evidence.',
      route: '/import-pgn',
      evidence: personalizedSummary.insufficient_data,
      priority: 'medium',
    });
  }

  actions.push({
    id: 'mirror-rematch',
    type: 'mirror',
    title: 'Play a Mirror rematch',
    description: 'Test whether the reviewed habit appears against your personalized Mirror opponent.',
    route: '/mirror',
    evidence: ['Mirror uses local StyleVector reranking, not runtime GenAI.'],
    priority: actions.length > 0 ? 'medium' : 'high',
  });

  return actions.slice(0, 4);
}

function topProblemMotif(moves: MoveReview[]): string | null {
  const counts = motifCount(
    moves.filter((move) => ['inaccuracy', 'mistake', 'blunder', 'missed_win'].includes(move.classification))
  );
  return [...counts.entries()]
    .filter(([motif]) => motif !== 'unknown' && motif !== 'capture')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

function motifCount(moves: MoveReview[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const move of moves) {
    for (const motif of move.motif_tags.length > 0 ? move.motif_tags : ['unknown']) {
      counts.set(motif, (counts.get(motif) ?? 0) + 1);
    }
  }
  return counts;
}
