import { Chess, type Square } from 'chess.js';
import { seedPuzzles, type CluePuzzle } from '../data/cluePuzzles';
import {
  getClueAttemptsForPlayer,
  getCurrentStyleVectorRecord,
  getGameReviewsForPlayer,
  openMirrorDb,
  type PuzzleReviewRecord,
  type StyleVector,
} from '../data/db';
import type { GameReviewRecord, MoveReview } from '../review/reviewTypes';
import type {
  AdaptiveClue,
  AdaptiveClueContext,
  AdaptiveClueSelection,
  BossPuzzleSequence,
  ClueEvidenceSource,
  ClueLevel,
  ClueScoreInput,
  ClueScoreResult,
  ClueVariant,
  SolutionExplanation,
  StreakState,
  ClueMode,
} from './clueTypes';

const CLUE_LEVELS: ClueLevel[] = [1, 2, 3, 4, 5];
const CORE_MOTIFS = ['fork', 'pin', 'skewer', 'removing_the_defender'] as const;

export async function buildAdaptiveClueContext(
  playerId: string,
  options: { requestedMotif?: string | null; analyticsWeakMotif?: string | null; dbName?: string } = {}
): Promise<AdaptiveClueContext> {
  const db = await openMirrorDb(options.dbName);
  const [styleVector, clueAttempts, puzzleReviews, gameReviews] = await Promise.all([
    getCurrentStyleVectorRecord(playerId, options.dbName),
    getClueAttemptsForPlayer(playerId, undefined, options.dbName),
    db.getAllFromIndex('puzzle_reviews', 'player_id', playerId),
    getGameReviewsForPlayer(playerId, undefined, options.dbName),
  ]);

  return {
    player_id: playerId,
    style_vector: styleVector,
    clue_attempts: clueAttempts,
    puzzle_reviews: puzzleReviews,
    game_reviews: gameReviews,
    analytics_weak_motif: options.analyticsWeakMotif ?? null,
    requested_motif: options.requestedMotif ?? null,
    due_review_motifs: Array.from(new Set(puzzleReviews.filter(isDue).map((review) => review.motif))).sort(),
    generated_at: new Date().toISOString(),
  };
}

export function selectAdaptiveCluePuzzle(
  context: AdaptiveClueContext,
  mode: ClueMode = 'adaptive',
  options: { requestedMotif?: string | null; reviewRequested?: boolean } = {}
): AdaptiveClueSelection {
  const weakMotif = options.requestedMotif
    ?? context.requested_motif
    ?? context.analytics_weak_motif
    ?? inferWeakMotif(context)
    ?? undefined;
  const sourceBadges = evidenceSourcesForContext(context, weakMotif);
  const dueReviews = context.puzzle_reviews.filter(isDue);
  const dueReview = mode === 'review' || options.reviewRequested;
  const reviewPuzzle = dueReview
    ? pickDueReviewPuzzle(dueReviews, weakMotif)
    : null;

  const puzzle = reviewPuzzle
    ?? pickPuzzleForMotif(weakMotif, context, mode)
    ?? seedPuzzles[0];

  const startLevel = chooseStartingClueLevel(puzzle, context, mode, {
    dueReview: Boolean(reviewPuzzle),
    weakMotif,
  });
  const insufficient = sourceBadges.includes('Insufficient Data');

  return {
    puzzle,
    mode,
    start_level: startLevel,
    ...(weakMotif ? { recommended_motif: weakMotif } : {}),
    source_badges: sourceBadges,
    evidence: buildSelectionEvidence(context, puzzle, weakMotif, Boolean(reviewPuzzle)),
    insufficient_data: insufficient,
    due_review: Boolean(reviewPuzzle),
    reason: buildSelectionReason(puzzle, mode, weakMotif, Boolean(reviewPuzzle), insufficient),
  };
}

export function getClueLevels(): ClueLevel[] {
  return [...CLUE_LEVELS];
}

export function generateClueVariants(
  puzzle: CluePuzzle,
  level: ClueLevel,
  mode: ClueMode = 'adaptive'
): ClueVariant[] {
  const source = sourceForLevel(level);
  const kidFriendly = mode === 'kids';
  const base = buildLevelClueText(puzzle, level, false);
  const alternate = buildLevelClueText(puzzle, level, true);
  const reviewPrefix = mode === 'review' ? 'Recall: ' : '';
  const kidsPrefix = kidFriendly ? 'Try this: ' : '';

  return [base, alternate]
    .filter((text, index, texts) => texts.indexOf(text) === index)
    .map((text, index) => ({
      id: `${puzzle.id}:L${level}:v${index + 1}:${kidFriendly ? 'kids' : 'standard'}`,
      level,
      text: `${kidsPrefix}${reviewPrefix}${kidFriendly ? simplifyForKids(text) : text}`,
      source,
      kid_friendly: kidFriendly,
    }));
}

export function selectClueVariant(
  variants: ClueVariant[],
  seenVariantIds: string[],
  allowRepeat = false
): ClueVariant | null {
  if (variants.length === 0) return null;
  if (allowRepeat) return variants[0];
  return variants.find((variant) => !seenVariantIds.includes(variant.id)) ?? null;
}

export function buildAdaptiveClue(input: {
  puzzle: CluePuzzle;
  level: ClueLevel;
  mode: ClueMode;
  context: AdaptiveClueContext;
  seenVariantIds?: string[];
  allowRepeat?: boolean;
}): AdaptiveClue | null {
  const variants = generateClueVariants(input.puzzle, input.level, input.mode);
  const variant = selectClueVariant(variants, input.seenVariantIds ?? [], input.allowRepeat);
  if (!variant) return null;

  const weakMotif = input.context.requested_motif ?? input.context.analytics_weak_motif ?? inferWeakMotif(input.context);
  const insufficientData = evidenceSourcesForContext(input.context, weakMotif).includes('Insufficient Data');
  return {
    puzzle_id: input.puzzle.id,
    level: input.level,
    variant_id: variant.id,
    text: variant.text,
    source: variant.source,
    why: explainClueLevel(input.level, input.mode, input.puzzle, weakMotif, insufficientData),
    evidence: buildSelectionEvidence(input.context, input.puzzle, weakMotif ?? undefined, false),
    insufficient_data: insufficientData,
  };
}

export function chooseStartingClueLevel(
  puzzle: CluePuzzle,
  context: AdaptiveClueContext,
  mode: ClueMode,
  options: { dueReview?: boolean; weakMotif?: string } = {}
): ClueLevel {
  if (mode === 'kids') return 2;
  if (mode === 'review' || options.dueReview) return 2;
  if (mode === 'boss') return 2;
  if (mode === 'streak') return 3;

  const weakMotif = options.weakMotif ?? inferWeakMotif(context);
  const puzzleAttempts = context.clue_attempts.filter((attempt) => attempt.puzzle_id === puzzle.id);
  const motifAttempts = context.clue_attempts.filter((attempt) => attempt.motif === puzzle.motif);
  const motifFailures = motifAttempts.filter((attempt) => !attempt.solved).length;
  const quickSolves = motifAttempts.filter(
    (attempt) => attempt.solved && (attempt.hints_used ?? 0) === 0 && (attempt.attempts_before_solve ?? attempt.attempted_moves.length) <= 1
  ).length;

  if (weakMotif === puzzle.motif || motifFailures >= 2 || puzzleAttempts.some((attempt) => !attempt.solved)) return 1;
  if (quickSolves >= 2) return 4;
  if (hasPersonalEvidence(context)) return 3;
  return 2;
}

export function buildFinalReveal(puzzle: CluePuzzle, kidsMode = false): SolutionExplanation {
  const firstMove = puzzle.solution_moves[0] ?? 'unknown';
  const moveText = kidsMode ? `The move to try is ${firstMove}.` : `Best move: ${firstMove}.`;
  const clueGoal = `The clues were trying to make you notice the ${formatMotif(puzzle.motif)} pattern.`;
  return {
    correct_move: firstMove,
    why_it_works: `${moveText} ${puzzle.explanation}`,
    motif: puzzle.motif,
    clue_goal: clueGoal,
    stylevector_connection: 'StyleVector connection appears only when local evidence supports it.',
    next_recommendation: `Try another ${formatMotif(puzzle.motif)} puzzle or open Analytics for the next training action.`,
    evidence: [`Puzzle ${puzzle.id} solution line is local seed data.`, `Motif: ${puzzle.motif}.`],
  };
}

export function buildSolutionExplanation(
  puzzle: CluePuzzle,
  context: AdaptiveClueContext,
  usedClues: AdaptiveClue[],
  kidsMode = false
): SolutionExplanation {
  const reveal = buildFinalReveal(puzzle, kidsMode);
  const weakMotif = inferWeakMotif(context);
  const styleConnection = weakMotif === puzzle.motif
    ? `Local evidence points to ${formatMotif(puzzle.motif)} as a current training focus.`
    : hasPersonalEvidence(context)
      ? `Local evidence does not mark ${formatMotif(puzzle.motif)} as the weakest motif right now.`
      : 'Insufficient personal evidence: this explanation uses the puzzle motif only.';

  return {
    ...reveal,
    clue_goal: usedClues.length > 0
      ? `The clue sequence moved from ${usedClues[0].source.toLowerCase()} toward calculation without using runtime GenAI.`
      : reveal.clue_goal,
    stylevector_connection: styleConnection,
    next_recommendation: weakMotif
      ? `Continue adaptive Clue Chess on ${formatMotif(weakMotif)} or open Analytics.`
      : 'Solve a few more puzzles or complete calibration to unlock personalization.',
  };
}

export function calculateClueScore(input: ClueScoreInput): ClueScoreResult {
  let score = input.solved ? 100 : 20;
  const evidence: string[] = [];

  if (!input.solved) {
    evidence.push('Puzzle was not solved, so only participation score applies.');
  }

  if (input.solved && !input.clue_level_used) {
    score += 40;
    evidence.push('Solved without a clue.');
  } else if (input.clue_level_used) {
    const cluePenalty = Math.max(0, input.clue_level_used - 1) * 8;
    score -= cluePenalty;
    evidence.push(`Highest clue level used: ${input.clue_level_used}.`);
  }

  score -= Math.max(0, input.attempts_used - 1) * 10;
  if (input.used_final_reveal) {
    score -= 35;
    evidence.push('Final reveal was used.');
  }
  if (input.due_review && input.solved) {
    score += 15;
    evidence.push('Due review solved.');
  }
  if (input.streak_count > 0 && input.solved) {
    score += Math.min(25, input.streak_count * 3);
    evidence.push(`Streak bonus: ${input.streak_count}.`);
  }
  if (input.boss_completed) {
    score += 25;
    evidence.push('Boss sequence cleared.');
  }
  if (input.time_spent_ms && input.time_spent_ms > 180000) {
    score -= 10;
    evidence.push('Long solve time reduced score slightly.');
  }

  const trainingScore = clamp(Math.round(score), 0, 180);
  return {
    training_score: trainingScore,
    score_delta: trainingScore,
    streak_count: input.solved ? input.streak_count + 1 : 0,
    boss_clear: input.boss_completed,
    review_success: input.due_review && input.solved && !input.used_final_reveal,
    evidence,
  };
}

export function updateStreakState(state: StreakState, solved: boolean): StreakState {
  if (!solved) return { count: 0, best: state.best, lives: Math.max(0, state.lives - 1) };
  const nextCount = state.count + 1;
  return {
    count: nextCount,
    best: Math.max(state.best, nextCount),
    lives: state.lives,
  };
}

export function buildBossPuzzleSequence(
  context: AdaptiveClueContext,
  motif = inferWeakMotif(context) ?? 'fork',
  limit = 5
): BossPuzzleSequence {
  const puzzles = seedPuzzles
    .filter((puzzle) => puzzle.motif === motif)
    .sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || a.id.localeCompare(b.id))
    .slice(0, clamp(limit, 3, 5));

  const fallback = [
    ...puzzles,
    ...seedPuzzles.filter((puzzle) => !puzzles.some((item) => item.id === puzzle.id)),
  ].slice(0, clamp(limit, 3, 5));
  return {
    id: `boss-${motif}-${fallback.map((puzzle) => puzzle.id).join('-')}`,
    motif,
    puzzle_ids: fallback.map((puzzle) => puzzle.id),
    current_index: 0,
    completed: false,
  };
}

export function inferWeakMotif(context: AdaptiveClueContext): string | null {
  const scores = new Map<string, number>();
  const add = (motif: string | undefined, value: number) => {
    if (!motif || motif === 'unknown') return;
    scores.set(motif, (scores.get(motif) ?? 0) + value);
  };

  if (context.analytics_weak_motif) add(context.analytics_weak_motif, 8);
  if (context.requested_motif) add(context.requested_motif, 10);

  for (const attempt of context.clue_attempts) {
    add(attempt.motif, attempt.solved ? -0.5 : 2);
  }
  for (const review of context.puzzle_reviews) {
    add(review.motif, review.lapses * 2 + (isDue(review) ? 3 : 0));
  }
  for (const move of context.game_reviews.flatMap((review) => review.move_reviews)) {
    if (!['inaccuracy', 'mistake', 'blunder', 'missed_win'].includes(move.classification)) continue;
    for (const motif of move.motif_tags) add(motif, 2);
  }
  for (const [motif, blindness] of Object.entries(context.style_vector?.vector.motif_blindness ?? {})) {
    add(motif, blindness * 4);
  }

  const sorted = Array.from(scores.entries())
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted[0]?.[0] ?? null;
}

export function inferStrongMotif(context: AdaptiveClueContext): string | null {
  const attemptsByMotif = new Map<string, { solved: number; total: number }>();
  for (const attempt of context.clue_attempts) {
    if (!attempt.motif || attempt.motif === 'unknown') continue;
    const row = attemptsByMotif.get(attempt.motif) ?? { solved: 0, total: 0 };
    row.total += 1;
    if (attempt.solved) row.solved += 1;
    attemptsByMotif.set(attempt.motif, row);
  }
  const sorted = Array.from(attemptsByMotif.entries())
    .filter(([, row]) => row.total >= 2)
    .sort((a, b) => (b[1].solved / b[1].total) - (a[1].solved / a[1].total) || b[1].solved - a[1].solved);
  return sorted[0]?.[0] ?? null;
}

function buildLevelClueText(puzzle: CluePuzzle, level: ClueLevel, alternate: boolean): string {
  const firstMove = puzzle.solution_moves[0] ?? '';
  const descriptor = describeFirstMove(puzzle, firstMove);
  const region = boardRegion(firstMove.slice(2, 4));

  if (level === 1) {
    return alternate
      ? `This position is about ${formatMotif(puzzle.motif)}.`
      : `Look for a ${formatMotif(puzzle.motif)}.`;
  }
  if (level === 2) {
    return alternate
      ? `Start by checking the ${region} side of the board.`
      : `${descriptor.pieceName} may have an active square.`;
  }
  if (level === 3) {
    return alternate
      ? `Notice which opponent target becomes loose after a forcing move.`
      : threatClueForMotif(puzzle.motif);
  }
  if (level === 4) {
    return alternate
      ? `Calculate the forcing move first, then check what material or mate threat remains.`
      : forcingClueForMove(descriptor);
  }
  return alternate
    ? `${descriptor.pieceName} is the piece to focus on; look for ${descriptor.tacticalVerb}.`
    : `The best move is a ${descriptor.pieceName.toLowerCase()} move${descriptor.givesCheck ? ' with check' : ''}.`;
}

function threatClueForMotif(motif: string): string {
  switch (motif) {
    case 'fork':
      return 'Two opponent targets may be vulnerable at the same time.';
    case 'pin':
      return 'One defender may be unable to move because something more valuable sits behind it.';
    case 'skewer':
      return 'A forcing attack may push a valuable piece away and expose another target.';
    case 'removing_the_defender':
      return 'A key defender can be challenged before the main target falls.';
    case 'mate':
      return 'The king has fewer escape squares than it first appears.';
    case 'hanging_piece':
      return 'One opponent piece may not be defended.';
    case 'endgame':
      return 'The endgame target is either the king activity or the promotion race.';
    case 'defense':
      return 'Find the move that reduces the opponent threat before it grows.';
    default:
      return 'Look for the most forcing target in the position.';
  }
}

function forcingClueForMove(descriptor: ReturnType<typeof describeFirstMove>): string {
  if (descriptor.givesCheck) return 'Start by calculating the forcing check.';
  if (descriptor.isCapture) return 'Start with the forcing capture before looking for quiet moves.';
  return 'Look for the quiet move that creates the strongest immediate threat.';
}

function describeFirstMove(puzzle: CluePuzzle, move: string): {
  pieceName: string;
  isCapture: boolean;
  givesCheck: boolean;
  tacticalVerb: string;
} {
  try {
    const chess = new Chess(puzzle.fen);
    const piece = chess.get(move.slice(0, 2) as Square);
    const madeMove = chess.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4],
    });
    return {
      pieceName: pieceName(piece?.type),
      isCapture: Boolean(madeMove?.captured),
      givesCheck: chess.isCheck(),
      tacticalVerb: madeMove?.captured ? 'a capture' : chess.isCheck() ? 'a check' : 'a forcing square',
    };
  } catch {
    return {
      pieceName: 'piece',
      isCapture: false,
      givesCheck: false,
      tacticalVerb: 'a forcing square',
    };
  }
}

function pieceName(type: string | undefined): string {
  switch (type) {
    case 'n':
      return 'knight';
    case 'b':
      return 'bishop';
    case 'r':
      return 'rook';
    case 'q':
      return 'queen';
    case 'k':
      return 'king';
    case 'p':
      return 'pawn';
    default:
      return 'piece';
  }
}

function boardRegion(square: string): string {
  if (!/^[a-h][1-8]$/.test(square)) return 'critical';
  const file = square[0];
  if (file <= 'c') return 'queenside';
  if (file >= 'f') return 'kingside';
  return 'center';
}

function pickDueReviewPuzzle(dueReviews: PuzzleReviewRecord[], motif?: string): CluePuzzle | null {
  const sorted = [...dueReviews]
    .filter((review) => !motif || review.motif === motif)
    .sort((a, b) => b.lapses - a.lapses || a.next_due_at.localeCompare(b.next_due_at));
  for (const review of sorted) {
    const puzzle = seedPuzzles.find((candidate) => candidate.id === review.puzzle_id);
    if (puzzle) return puzzle;
  }
  return null;
}

function pickPuzzleForMotif(motif: string | undefined, context: AdaptiveClueContext, mode: ClueMode): CluePuzzle | null {
  const attempted = new Set(context.clue_attempts.filter((attempt) => attempt.solved).map((attempt) => attempt.puzzle_id));
  const candidates = seedPuzzles
    .filter((puzzle) => !motif || puzzle.motif === motif)
    .filter((puzzle) => mode === 'review' || !attempted.has(puzzle.id))
    .sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || a.id.localeCompare(b.id));
  return candidates[0] ?? seedPuzzles.filter((puzzle) => !attempted.has(puzzle.id))[0] ?? seedPuzzles[0] ?? null;
}

function evidenceSourcesForContext(context: AdaptiveClueContext, motif?: string | null): ClueEvidenceSource[] {
  const sources = new Set<ClueEvidenceSource>();
  if (context.analytics_weak_motif || context.requested_motif) sources.add('Analytics');
  if (context.style_vector?.vector) sources.add('StyleVector');
  if (context.game_reviews.some((review) => review.move_reviews.some((move) => move.motif_tags.length > 0))) {
    sources.add('Game Review');
  }
  if (context.puzzle_reviews.some(isDue)) sources.add('Review Queue');
  if (context.clue_attempts.length > 0) sources.add('Puzzle History');
  if (motif && sources.size === 0) sources.add('Insufficient Data');
  if (!motif && !hasPersonalEvidence(context)) sources.add('Insufficient Data');
  return Array.from(sources);
}

function buildSelectionEvidence(
  context: AdaptiveClueContext,
  puzzle: CluePuzzle,
  motif?: string,
  dueReview = false
): string[] {
  const evidence: string[] = [`Puzzle ${puzzle.id} motif is ${puzzle.motif}.`];
  if (motif) evidence.push(`Training motif signal: ${motif}.`);
  if (dueReview) evidence.push('Puzzle was selected from due spaced-repetition reviews.');
  const failedMotifAttempts = context.clue_attempts.filter((attempt) => attempt.motif === puzzle.motif && !attempt.solved).length;
  if (failedMotifAttempts > 0) evidence.push(`${failedMotifAttempts} local failed attempt(s) for ${puzzle.motif}.`);
  const reviewMotifHits = getProblemMoves(context.game_reviews).filter((move) => move.motif_tags.includes(puzzle.motif)).length;
  if (reviewMotifHits > 0) evidence.push(`${reviewMotifHits} reviewed move issue(s) tagged ${puzzle.motif}.`);
  const blindness = motifBlindness(context.style_vector?.vector, puzzle.motif);
  if (blindness !== null) evidence.push(`StyleVector motif blindness for ${puzzle.motif}: ${round(blindness)}.`);
  if (evidence.length === 1) evidence.push('Insufficient personalization data; neutral clue sequence is used.');
  return evidence;
}

function buildSelectionReason(
  puzzle: CluePuzzle,
  mode: ClueMode,
  motif: string | undefined,
  dueReview: boolean,
  insufficient: boolean
): string {
  if (dueReview) return `Review mode prioritized due puzzle ${puzzle.id}.`;
  if (insufficient) return 'Personal evidence is thin, so MIRROR selected a balanced seed puzzle.';
  if (mode === 'boss') return `Boss mode built a focused ${formatMotif(motif ?? puzzle.motif)} challenge.`;
  if (mode === 'streak') return 'Streak mode selected a deterministic puzzle for a short training run.';
  return `Adaptive mode selected ${formatMotif(motif ?? puzzle.motif)} from local evidence.`;
}

function sourceForLevel(level: ClueLevel): ClueEvidenceSource {
  if (level === 1) return 'Analytics';
  if (level === 2) return 'StyleVector';
  if (level === 3) return 'Game Review';
  if (level === 4) return 'Puzzle History';
  return 'Review Queue';
}

function explainClueLevel(
  level: ClueLevel,
  mode: ClueMode,
  puzzle: CluePuzzle,
  weakMotif: string | null,
  insufficient: boolean
): string {
  if (insufficient) {
    return 'Insufficient personalization data, so this clue uses the puzzle motif and a neutral difficulty ramp.';
  }
  if (mode === 'review') return 'Review mode uses recall-style clues so the pattern is remembered without over-revealing.';
  if (mode === 'kids') return 'Kids Mode uses shorter clue wording and avoids harsh failure language.';
  if (weakMotif === puzzle.motif && level <= 2) {
    return `MIRROR starts easier because ${formatMotif(puzzle.motif)} has local weakness evidence.`;
  }
  return `Level ${level} is chosen to reveal the idea gradually without giving the exact SAN.`;
}

function hasPersonalEvidence(context: AdaptiveClueContext): boolean {
  return Boolean(context.style_vector)
    || context.clue_attempts.length > 0
    || context.puzzle_reviews.length > 0
    || context.game_reviews.length > 0
    || Boolean(context.analytics_weak_motif || context.requested_motif);
}

function getProblemMoves(reviews: GameReviewRecord[]): MoveReview[] {
  return reviews
    .flatMap((review) => review.move_reviews)
    .filter((move) => ['inaccuracy', 'mistake', 'blunder', 'missed_win'].includes(move.classification));
}

function motifBlindness(styleVector: StyleVector | undefined, motif: string): number | null {
  if (!styleVector || !CORE_MOTIFS.includes(motif as never)) return null;
  return styleVector.motif_blindness[motif as keyof StyleVector['motif_blindness']] ?? null;
}

function isDue(review: PuzzleReviewRecord): boolean {
  return new Date(review.next_due_at).getTime() <= Date.now();
}

function difficultyRank(difficulty: CluePuzzle['difficulty']): number {
  return { beginner: 1, casual: 2, club: 3, strong: 4 }[difficulty] ?? 2;
}

function simplifyForKids(text: string): string {
  return text
    .replace(/forcing/g, 'strong')
    .replace(/vulnerable/g, 'can be attacked')
    .replace(/opponent/g, 'other side')
    .replace(/fatal/g, 'very strong')
    .replace(/critical/g, 'important');
}

function formatMotif(motif: string): string {
  return motif.replace(/_/g, ' ');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
