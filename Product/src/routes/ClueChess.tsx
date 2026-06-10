import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BoardView } from '../components/Board/BoardView';
import {
  buildAdaptiveClue,
  buildAdaptiveClueContext,
  buildBossPuzzleSequence,
  buildSolutionExplanation,
  calculateClueScore,
  generateClueVariants,
  getClueLevels,
  selectAdaptiveCluePuzzle,
  updateStreakState,
} from '../clue/adaptiveClueEngine';
import { getSeenClueVariantIds, hasUnseenClueVariant, recordClueVariantShown } from '../clue/clueMemory';
import type {
  AdaptiveClue,
  AdaptiveClueContext,
  AdaptiveClueSelection,
  BossPuzzleSequence,
  ClueMode,
  ClueScoreResult,
  SolutionExplanation,
  StreakState,
} from '../clue/clueTypes';
import { seedPuzzles, type CluePuzzle } from '../data/cluePuzzles';
import {
  putClueAttempt,
  getClueStatsForPlayer,
  type ClueAttemptRecord,
} from '../data/db';
import { isStandardTheme, loadThemeManifest } from '../lib/theme';
import { usePlayerStore } from '../state/playerStore';
import { useSettingsStore } from '../state/settingsStore';
import { updatePuzzleReviewAfterAttempt } from '../training/spacedRepetition';
import { usePuzzleSequence } from '../training/usePuzzleSequence';

const MODE_OPTIONS: Array<{ id: ClueMode; label: string; description: string }> = [
  { id: 'adaptive', label: 'Adaptive Training', description: 'Personalized clue level from local evidence.' },
  { id: 'review', label: 'Review Mode', description: 'Due spaced-repetition puzzles first.' },
  { id: 'streak', label: 'Streak Mode', description: 'Short run with deterministic streak scoring.' },
  { id: 'boss', label: 'Boss Puzzle', description: 'Three to five puzzles around a weak motif.' },
  { id: 'kids', label: 'Kids Mode', description: 'Shorter, gentler wording.' },
];

const EMPTY_STREAK: StreakState = { count: 0, best: 0, lives: 3 };

export default function ClueChess() {
  const { activePlayer } = usePlayerStore();
  const { activeTheme } = useSettingsStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMotif = searchParams.get('motif');
  const reviewRequested = searchParams.get('review') === 'true';

  const [mode, setModeState] = useState<ClueMode>(() => parseMode(searchParams.get('mode')) ?? (searchParams.get('kids') === 'true' ? 'kids' : 'adaptive'));
  const [themeManifest, setThemeManifest] = useState<Awaited<ReturnType<typeof loadThemeManifest>>>(null);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [selection, setSelection] = useState<AdaptiveClueSelection | null>(null);
  const [context, setContext] = useState<AdaptiveClueContext | null>(null);
  const [puzzle, setPuzzle] = useState<CluePuzzle | null>(null);
  const [stats, setStats] = useState<{ attempt_count: number; solved_rate: number } | null>(null);
  const [attemptRecord, setAttemptRecord] = useState<Partial<ClueAttemptRecord> | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [shownClues, setShownClues] = useState<AdaptiveClue[]>([]);
  const [nextClueLevel, setNextClueLevel] = useState<number>(1);
  const [highestClueLevelUsed, setHighestClueLevelUsed] = useState<number | undefined>();
  const [variantIdsSeen, setVariantIdsSeen] = useState<string[]>([]);
  const [usedFinalReveal, setUsedFinalReveal] = useState(false);
  const [solutionExplanation, setSolutionExplanation] = useState<SolutionExplanation | null>(null);
  const [scoreResult, setScoreResult] = useState<ClueScoreResult | null>(null);
  const [streakState, setStreakState] = useState<StreakState>(EMPTY_STREAK);
  const [bossSequence, setBossSequence] = useState<BossPuzzleSequence | null>(null);
  const [bossIndex, setBossIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hasFinalized, setHasFinalized] = useState(false);

  const {
    fen,
    currentStepIndex,
    totalSteps,
    isMultiMove,
    solved,
    failed,
    opponentReply,
    attempts,
    handleUserMove,
    restart,
  } = usePuzzleSequence(puzzle);

  useEffect(() => {
    const queryMode = parseMode(searchParams.get('mode'));
    if (queryMode && queryMode !== mode) {
      setModeState(queryMode);
    }
  }, [mode, searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function loadTheme() {
      if (isStandardTheme(activeTheme)) {
        setThemeManifest(null);
        setThemeError(null);
        return;
      }
      try {
        const manifest = await loadThemeManifest(activeTheme);
        if (!cancelled) {
          setThemeManifest(manifest);
          setThemeError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setThemeManifest(null);
          setThemeError(error instanceof Error ? error.message : 'Failed to load theme.');
        }
      }
    }
    void loadTheme();
    return () => {
      cancelled = true;
    };
  }, [activeTheme]);

  const loadStats = useCallback(async () => {
    if (!activePlayer) return;
    const rows = await getClueStatsForPlayer(activePlayer.id);
    setStats(rows);
  }, [activePlayer]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const activeMode = mode;
  const playerId = activePlayer?.id ?? 'guest';

  const loadContext = useCallback(async (): Promise<AdaptiveClueContext> => {
    if (activePlayer) {
      return buildAdaptiveClueContext(activePlayer.id, {
        requestedMotif,
        analyticsWeakMotif: requestedMotif,
      });
    }
    return {
      player_id: 'guest',
      clue_attempts: [],
      puzzle_reviews: [],
      game_reviews: [],
      analytics_weak_motif: requestedMotif,
      requested_motif: requestedMotif,
      due_review_motifs: [],
      generated_at: new Date().toISOString(),
    };
  }, [activePlayer, requestedMotif]);

  const startPuzzle = useCallback((nextPuzzle: CluePuzzle, nextSelection: AdaptiveClueSelection, nextContext: AdaptiveClueContext) => {
    const now = Date.now();
    setPuzzle(nextPuzzle);
    setSelection(nextSelection);
    setContext(nextContext);
    setStartedAt(now);
    setShownClues([]);
    setNextClueLevel(nextSelection.start_level);
    setHighestClueLevelUsed(undefined);
    setVariantIdsSeen([]);
    setUsedFinalReveal(false);
    setSolutionExplanation(null);
    setScoreResult(null);
    setStatusMessage(nextSelection.insufficient_data
      ? 'Insufficient personalization data: using a neutral clue sequence.'
      : nextSelection.reason);
    setHasFinalized(false);
    setAttemptRecord({
      id: `clue-${now}-${nextPuzzle.id}`,
      player_id: playerId,
      puzzle_id: nextPuzzle.id,
      source: 'seed',
      fen: nextPuzzle.fen,
      solution_moves: nextPuzzle.solution_moves,
      motif: nextPuzzle.motif,
      difficulty: nextPuzzle.difficulty,
      started_at: new Date(now).toISOString(),
      mode: activeMode,
      recommended_action_source: nextSelection.source_badges[0] ?? 'Insufficient Data',
    });
  }, [activeMode, playerId]);

  const startNextPuzzle = useCallback(async (advanceBoss = false) => {
    const nextContext = await loadContext();
    const queryReviewMode = reviewRequested && activeMode === 'adaptive';
    let nextSelection = selectAdaptiveCluePuzzle(nextContext, activeMode, {
      requestedMotif,
      reviewRequested: queryReviewMode,
    });

    if (activeMode === 'boss') {
      let sequence = bossSequence;
      let index = bossIndex;
      if (!sequence || !advanceBoss || index >= sequence.puzzle_ids.length - 1) {
        sequence = buildBossPuzzleSequence(nextContext, requestedMotif ?? nextSelection.recommended_motif);
        index = 0;
      } else {
        index += 1;
      }
      setBossSequence(sequence);
      setBossIndex(index);
      const bossPuzzle = seedPuzzles.find((candidate) => candidate.id === sequence.puzzle_ids[index]) ?? nextSelection.puzzle;
      nextSelection = {
        ...nextSelection,
        puzzle: bossPuzzle,
        mode: 'boss',
        reason: `Boss puzzle ${index + 1} of ${sequence.puzzle_ids.length} for ${sequence.motif}.`,
      };
    } else {
      setBossSequence(null);
      setBossIndex(0);
    }

    if (activeMode === 'review' && !nextSelection.due_review) {
      setStatusMessage('No reviews are due today. Showing an adaptive fallback puzzle.');
    }

    startPuzzle(nextSelection.puzzle, nextSelection, nextContext);
  }, [activeMode, bossIndex, bossSequence, loadContext, requestedMotif, reviewRequested, startPuzzle]);

  useEffect(() => {
    if (!puzzle) {
      void startNextPuzzle();
    }
  }, [puzzle, startNextPuzzle]);

  const nextClueAvailable = useMemo(() => {
    if (!puzzle) return false;
    if (activeMode === 'review') return nextClueLevel <= 5;
    const variants = generateClueVariants(puzzle, clampClueLevel(nextClueLevel), activeMode);
    return hasUnseenClueVariant(variants, variantIdsSeen, false) || nextClueLevel < 5;
  }, [activeMode, nextClueLevel, puzzle, variantIdsSeen]);

  async function handleShowNextClue() {
    if (!puzzle || !context) return;
    const allowRepeat = activeMode === 'review';
    for (const level of getClueLevels().filter((item) => item >= clampClueLevel(nextClueLevel))) {
      const persistedSeen = activePlayer
        ? await getSeenClueVariantIds(activePlayer.id, puzzle.id, level)
        : [];
      const seen = Array.from(new Set([...persistedSeen, ...variantIdsSeen]));
      const clue = buildAdaptiveClue({
        puzzle,
        level,
        mode: activeMode,
        context,
        seenVariantIds: seen,
        allowRepeat,
      });
      if (!clue) continue;
      if (activePlayer) {
        await recordClueVariantShown({
          playerId: activePlayer.id,
          puzzleId: puzzle.id,
          clueLevel: clue.level,
          variantId: clue.variant_id,
          mode: activeMode,
          attemptContext: selection?.reason ?? activeMode,
        });
      }
      setShownClues((prev) => [...prev, clue]);
      setVariantIdsSeen((prev) => [...prev, clue.variant_id]);
      setHighestClueLevelUsed((prev) => Math.max(prev ?? 0, clue.level));
      setNextClueLevel(Math.min(5, clue.level + 1));
      setStatusMessage(clue.why);
      return;
    }
    setStatusMessage('No new clue variant is available for this puzzle and level. Review mode can repeat recall clues.');
  }

  function handleTryWithoutClue() {
    setStatusMessage('Try the move first. If the pattern stays hidden, ask for a clue at the current level.');
  }

  function handleRevealSolution() {
    if (!puzzle || !context) return;
    setUsedFinalReveal(true);
    setSolutionExplanation(buildSolutionExplanation(puzzle, context, shownClues, activeMode === 'kids'));
    void recordAttempt(false, true);
  }

  const recordAttempt = async (isSolved: boolean, revealOverride = false) => {
    if (!attemptRecord || !activePlayer || hasFinalized || !puzzle) return;
    setHasFinalized(true);
    const now = Date.now();
    const finalRevealUsed = revealOverride || usedFinalReveal;
    const dueReview = Boolean(selection?.due_review || activeMode === 'review');
    const bossCompleted = activeMode === 'boss' && Boolean(bossSequence && bossIndex >= bossSequence.puzzle_ids.length - 1 && isSolved);
    const score = calculateClueScore({
      solved: isSolved,
      clue_level_used: highestClueLevelUsed,
      attempts_used: attempts.length,
      time_spent_ms: now - startedAt,
      due_review: dueReview,
      streak_count: streakState.count,
      boss_completed: bossCompleted,
      used_final_reveal: finalRevealUsed,
    });
    const nextStreak = activeMode === 'streak'
      ? updateStreakState(streakState, isSolved && !finalRevealUsed)
      : streakState;
    setStreakState(nextStreak);
    setScoreResult(score);

    const finalRecord: ClueAttemptRecord = {
      ...attemptRecord,
      attempted_moves: attempts,
      hints_used: shownClues.length,
      solved: isSolved,
      time_spent_ms: now - startedAt,
      completed_at: new Date(now).toISOString(),
      created_at: new Date(now).toISOString(),
      current_step: currentStepIndex,
      solved_steps: isSolved ? totalSteps : currentStepIndex,
      total_steps: totalSteps,
      line_attempts: attempts,
      failed_step: failed ? currentStepIndex : undefined,
      clue_level_used: highestClueLevelUsed,
      clue_variant_ids_seen: variantIdsSeen,
      attempts_before_solve: attempts.length,
      solved_without_reveal: isSolved && shownClues.length === 0 && !finalRevealUsed,
      used_final_reveal: finalRevealUsed,
      mode: activeMode,
      score_delta: score.score_delta,
      streak_count: nextStreak.count,
      boss_sequence_id: bossSequence?.id,
      boss_cleared: bossCompleted,
      recommended_action_source: selection?.source_badges[0] ?? 'Insufficient Data',
    } as ClueAttemptRecord;

    await putClueAttempt(finalRecord);

    const totalUserSteps = puzzle.solution_line ? puzzle.solution_line.filter((step) => step.side === 'user').length : 1;
    const isCleanSolve = isSolved && attempts.length === totalUserSteps && shownClues.length === 0 && !finalRevealUsed;
    await updatePuzzleReviewAfterAttempt(
      activePlayer.id,
      puzzle.id,
      puzzle.motif,
      puzzle.difficulty,
      isMultiMove,
      isCleanSolve ? 'solved' : 'failed'
    );

    if (isSolved && context) {
      setSolutionExplanation(buildSolutionExplanation(puzzle, context, shownClues, activeMode === 'kids'));
    }
    void loadStats();
  };

  function skipPuzzle() {
    recordAttempt(false).then(() => {
      void startNextPuzzle(activeMode === 'boss');
    }).catch(console.error);
  }

  function handlePieceDrop(sourceSquare: string, targetSquare: string, promotion?: string) {
    if (!puzzle || solved || usedFinalReveal) return false;
    const moveStr = `${sourceSquare}${targetSquare}${promotion || ''}`;
    return handleUserMove(moveStr);
  }

  useEffect(() => {
    if (solved && activePlayer) {
      recordAttempt(true).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, activePlayer]);

  function setMode(nextMode: ClueMode) {
    setModeState(nextMode);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('mode', nextMode);
    if (nextMode !== 'adaptive') nextParams.delete('review');
    setSearchParams(nextParams);
    setPuzzle(null);
    setStatusMessage(null);
  }

  if (!puzzle || !selection) {
    return (
      <section className="clue-chess-page">
        <p className="home-eyebrow">Adaptive Clue Chess</p>
        <h1>Loading adaptive puzzle...</h1>
      </section>
    );
  }

  const fenParts = puzzle.fen.split(' ');
  const playerColor = fenParts[1] === 'w' ? 'white' : 'black';
  const bossTotal = bossSequence?.puzzle_ids.length ?? 0;

  return (
    <section className="clue-chess-page">
      <header className="clue-chess-page__header">
        <div>
          <p className="home-eyebrow">Adaptive Clue Chess</p>
          <h1>The right clue at the right difficulty</h1>
          <p>
            Local-only adaptive training from StyleVector, Game Review motifs, puzzle history,
            spaced repetition, and Analytics recommendations. Runtime GenAI and cloud upload are not used.
          </p>
        </div>
        <Link className="btn btn-secondary" to="/analytics">Open Analytics</Link>
      </header>

      {!activePlayer ? (
        <p className="mirror-alert">
          Complete calibration to personalize clue selection. Until then, MIRROR uses balanced starter puzzles.
        </p>
      ) : null}

      <section className="clue-chess-page__modes" aria-label="Clue Chess modes">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={option.id === activeMode ? 'is-selected' : ''}
            onClick={() => setMode(option.id)}
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </section>

      <section className="clue-chess-page__stats">
        <Metric label="Attempts" value={stats?.attempt_count ?? 0} />
        <Metric label="Solved rate" value={`${Math.round((stats?.solved_rate ?? 0) * 100)}%`} />
        <Metric label="Clue level" value={`Level ${highestClueLevelUsed ?? selection.start_level}`} />
        <Metric label="Streak" value={streakState.count} />
        <Metric label="Score" value={scoreResult?.training_score ?? '-'} />
      </section>

      <div className="clue-chess-page__layout">
        <div className="clue-chess-page__board">
          <div className="clue-chess-page__puzzle-heading">
            <div>
              <h2>{puzzle.title}</h2>
              <p>{formatMotif(puzzle.motif)} | {puzzle.difficulty}</p>
            </div>
            <span>{selection.source_badges.join(' + ')}</span>
          </div>
          <BoardView
            fen={fen}
            playerColor={playerColor}
            status={solved || usedFinalReveal ? 'game-over' : 'playing'}
            engineThinking={false}
            onPieceDrop={handlePieceDrop}
            onPromotionCheck={() => true}
            onPromotionPieceSelect={() => true}
            themeManifest={themeManifest}
            themeError={themeError}
          />
        </div>

        <aside className="clue-chess-page__panel">
          <section className="mirror-panel">
            <h3>Training focus</h3>
            <p>{selection.reason}</p>
            {statusMessage ? <p className="play-note">{statusMessage}</p> : null}
            <div className="clue-chess-page__evidence">
              {selection.evidence.map((entry) => <span key={entry}>{entry}</span>)}
            </div>
            {selection.insufficient_data ? (
              <p className="mirror-alert">Insufficient personalization data: this puzzle does not claim a personal weakness.</p>
            ) : null}
            {reviewRequested ? <p className="play-note">Analytics requested review=true, so due reviews are preferred when available.</p> : null}
          </section>

          {bossSequence ? (
            <section className="mirror-panel">
              <h3>Boss progress</h3>
              <progress value={bossIndex + (solved ? 1 : 0)} max={Math.max(1, bossTotal)} />
              <p>{bossIndex + 1} of {bossTotal} puzzles for {formatMotif(bossSequence.motif)}.</p>
            </section>
          ) : null}

          <section className="mirror-panel">
            <h3>Clues</h3>
            <p>Level {selection.start_level} start. Final reveal is only shown after explicit request or failed training.</p>
            <ol className="clue-chess-page__clues">
              {shownClues.map((clue) => (
                <li key={clue.variant_id}>
                  <strong>Level {clue.level}</strong>
                  <span>{clue.text}</span>
                  <small>{clue.source}: {clue.why}</small>
                </li>
              ))}
            </ol>
            {!solved && !usedFinalReveal ? (
              <div className="clue-chess-page__controls">
                <button className="btn btn-ghost" type="button" onClick={handleTryWithoutClue}>
                  Try without clue
                </button>
                <button className="btn btn-primary" type="button" onClick={handleShowNextClue} disabled={!nextClueAvailable}>
                  Show next clue
                </button>
                <button className="btn btn-secondary" type="button" onClick={handleRevealSolution}>
                  Reveal solution
                </button>
              </div>
            ) : null}
          </section>

          <section className="mirror-panel">
            <h3>Position state</h3>
            {isMultiMove ? <p>Step {currentStepIndex + 1} of {totalSteps}</p> : <p>Single-move tactic.</p>}
            {opponentReply && !solved ? <p>Opponent replies: {opponentReply}</p> : null}
            {failed && !solved && !usedFinalReveal ? (
              <div>
                <p className={activeMode === 'kids' ? 'play-note' : 'mirror-alert'}>
                  {activeMode === 'kids' ? 'Nice try. Check the clue and try a safer move.' : 'Incorrect move. Try again or ask for the next clue.'}
                </p>
                <div className="clue-chess-page__controls">
                  <button className="btn btn-ghost" type="button" onClick={restart}>Restart sequence</button>
                  <button className="btn btn-secondary" type="button" onClick={skipPuzzle}>Skip / next puzzle</button>
                </div>
              </div>
            ) : null}
          </section>

          {solutionExplanation ? (
            <section className="mirror-panel">
              <h3>{solved ? 'Solved' : 'Solution revealed'}</h3>
              <p>{solutionExplanation.why_it_works}</p>
              <p>{solutionExplanation.clue_goal}</p>
              <p>{solutionExplanation.stylevector_connection}</p>
              <div className="clue-chess-page__evidence">
                {solutionExplanation.evidence.map((entry) => <span key={entry}>{entry}</span>)}
              </div>
              {scoreResult ? (
                <p className="play-note">Training score: {scoreResult.training_score}. {scoreResult.evidence.join(' ')}</p>
              ) : null}
              <div className="clue-chess-page__controls">
                <button className="btn btn-primary" type="button" onClick={() => void startNextPuzzle(activeMode === 'boss')}>
                  Next clue puzzle
                </button>
                <Link className="btn btn-secondary" to="/analytics">Open Analytics</Link>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function parseMode(value: string | null): ClueMode | null {
  return MODE_OPTIONS.some((option) => option.id === value) ? (value as ClueMode) : null;
}

function clampClueLevel(value: number): 1 | 2 | 3 | 4 | 5 {
  if (value <= 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  if (value === 4) return 4;
  return 5;
}

function formatMotif(value: string): string {
  return value.replace(/_/g, ' ');
}
