import { useEffect, useState, useCallback } from 'react';
import { usePlayerStore } from '../state/playerStore';
import { useSettingsStore } from '../state/settingsStore';
import { BoardView } from '../components/Board/BoardView';
import { isStandardTheme, loadThemeManifest } from '../lib/theme';
import { selectCluePuzzle } from '../training/clueEngine';
import { usePuzzleSequence } from '../training/usePuzzleSequence';
import { seedPuzzles, type CluePuzzle } from '../data/cluePuzzles';
import { putClueAttempt, getClueAttemptsForPlayer, getClueStatsForPlayer, type ClueAttemptRecord, type PuzzleReviewRecord } from '../data/db';
import { updatePuzzleReviewAfterAttempt, getReviewQueue } from '../training/spacedRepetition';

export default function ClueChess() {
  const { activePlayer } = usePlayerStore();
  const { activeTheme } = useSettingsStore();

  const [themeManifest, setThemeManifest] = useState<Awaited<ReturnType<typeof loadThemeManifest>>>(null);
  const [themeError, setThemeError] = useState<string | null>(null);

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
    return () => { cancelled = true; };
  }, [activeTheme]);

  const [mode, setMode] = useState<'new' | 'review'>('new');
  const [reviewQueue, setReviewQueue] = useState<PuzzleReviewRecord[]>([]);
  const [emptyQueueMessage, setEmptyQueueMessage] = useState<string | null>(null);
  
  const [puzzle, setPuzzle] = useState<CluePuzzle | null>(null);
  
  const {
    fen,
    currentStepIndex,
    totalSteps,
    isMultiMove,
    solved,
    failed,
    opponentReply,
    cluesRevealed,
    hintLevel,
    attempts,
    handleGetClue,
    handleUserMove,
    restart
  } = usePuzzleSequence(puzzle);

  const [stats, setStats] = useState<{ attempt_count: number; solved_rate: number } | null>(null);
  const [previousAttempts, setPreviousAttempts] = useState<ClueAttemptRecord[]>([]);
  const [attemptRecord, setAttemptRecord] = useState<Partial<ClueAttemptRecord> | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);

  const loadStats = useCallback(async () => {
    if (!activePlayer) return;
    const s = await getClueStatsForPlayer(activePlayer.id);
    const prev = await getClueAttemptsForPlayer(activePlayer.id);
    setStats(s);
    setPreviousAttempts(prev);
  }, [activePlayer]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const startNextPuzzle = useCallback(async () => {
    if (mode === 'review') {
      if (reviewQueue.length > 0) {
        const nextReview = reviewQueue[0];
        const nextPuzzle = seedPuzzles.find(p => p.id === nextReview.puzzle_id);
        if (nextPuzzle) {
          setPuzzle(nextPuzzle);
          setStartedAt(Date.now());
          setAttemptRecord({
            id: `clue-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            player_id: activePlayer?.id || 'guest',
            puzzle_id: nextPuzzle.id,
            source: 'seed',
            fen: nextPuzzle.fen,
            solution_moves: nextPuzzle.solution_moves,
            motif: nextPuzzle.motif,
            difficulty: nextPuzzle.difficulty,
            started_at: new Date().toISOString(),
          });
          setEmptyQueueMessage(null);
          return;
        }
      } else if (activePlayer) {
        // try to load queue
        const q = await getReviewQueue(activePlayer.id);
        if (q.length > 0) {
          setReviewQueue(q);
          const nextPuzzle = seedPuzzles.find(p => p.id === q[0].puzzle_id);
          if (nextPuzzle) {
            setPuzzle(nextPuzzle);
            setStartedAt(Date.now());
            setAttemptRecord({
              id: `clue-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              player_id: activePlayer.id,
              puzzle_id: nextPuzzle.id,
              source: 'seed',
              fen: nextPuzzle.fen,
              solution_moves: nextPuzzle.solution_moves,
              motif: nextPuzzle.motif,
              difficulty: nextPuzzle.difficulty,
              started_at: new Date().toISOString(),
            });
            setEmptyQueueMessage(null);
            return;
          }
        }
      }
      setPuzzle(null);
      setEmptyQueueMessage('No reviews due today');
      return;
    }

    const nextPuzzle = selectCluePuzzle(activePlayer?.id || 'guest', undefined, previousAttempts);
    setPuzzle(nextPuzzle);
    setStartedAt(Date.now());
    
    setAttemptRecord({
      id: `clue-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      player_id: activePlayer?.id || 'guest',
      puzzle_id: nextPuzzle.id,
      source: 'seed',
      fen: nextPuzzle.fen,
      solution_moves: nextPuzzle.solution_moves,
      motif: nextPuzzle.motif,
      difficulty: nextPuzzle.difficulty,
      started_at: new Date().toISOString(),
    });
    setEmptyQueueMessage(null);
  }, [activePlayer, previousAttempts, mode, reviewQueue]);

  useEffect(() => {
    if (!puzzle && !emptyQueueMessage) {
      void startNextPuzzle();
    }
  }, [puzzle, emptyQueueMessage, startNextPuzzle]);



  const [hasFinalized, setHasFinalized] = useState(false);
  useEffect(() => {
    setHasFinalized(false);
  }, [puzzle]);

  const recordAttempt = async (isSolved: boolean) => {
    if (!attemptRecord || !activePlayer || hasFinalized) return;
    setHasFinalized(true);
    
    const now = Date.now();
    const finalRecord: ClueAttemptRecord = {
      ...attemptRecord,
      attempted_moves: attempts,
      hints_used: cluesRevealed.length,
      solved: isSolved,
      time_spent_ms: now - startedAt,
      completed_at: new Date(now).toISOString(),
      created_at: new Date(now).toISOString(),
      current_step: currentStepIndex,
      solved_steps: isSolved ? totalSteps : currentStepIndex,
      total_steps: totalSteps,
      line_attempts: attempts,
      failed_step: failed ? currentStepIndex : undefined
    } as ClueAttemptRecord;
    
    await putClueAttempt(finalRecord);
    
    if (puzzle) {
      const totalUserSteps = puzzle.solution_line ? puzzle.solution_line.filter(s => s.side === 'user').length : 1;
      const isCleanSolve = isSolved && attempts.length === totalUserSteps && cluesRevealed.length === 0;
      const srResult = isCleanSolve ? 'solved' : 'failed';
      await updatePuzzleReviewAfterAttempt(
        activePlayer.id,
        puzzle.id,
        puzzle.motif,
        puzzle.difficulty,
        isMultiMove,
        srResult
      );
    }
    
    void loadStats();
  };

  const skipPuzzle = () => {
    recordAttempt(false).then(() => {
      // If we are in review mode, we need to refresh the queue because we just failed one
      // It will pop back up later, but we shouldn't serve the exact same puzzle back-to-back if we can avoid it.
      // But startNextPuzzle will just re-fetch the queue. We might get the same one if it's the only one.
      // To avoid looping immediately if there's >1, we could remove it from our local queue state before calling startNextPuzzle.
      if (mode === 'review' && reviewQueue.length > 0) {
        setReviewQueue(prev => prev.slice(1));
      }
      void startNextPuzzle();
    }).catch(console.error);
  };

  const handlePieceDrop = (sourceSquare: string, targetSquare: string, promotion?: string) => {
    if (!puzzle || solved) return false;
    
    const moveStr = `${sourceSquare}${targetSquare}${promotion || ''}`;
    const correct = handleUserMove(moveStr);

    if (attemptRecord) {
      setAttemptRecord(prev => prev ? { ...prev, attempted_moves: [...attempts, moveStr] } : null);
    }
    
    // Auto finalize if solved
    // React state for `solved` hasn't updated yet, so we have to check what handleUserMove returned and the step count
    // But it's easier to use a useEffect on `solved`
    return correct;
  };

  useEffect(() => {
    if (solved && activePlayer) {
      recordAttempt(true).catch(console.error);
      if (mode === 'review' && reviewQueue.length > 0) {
        setReviewQueue(prev => prev.slice(1));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, activePlayer]);

  if (!puzzle) {
    if (emptyQueueMessage) {
      return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1>Clue Chess</h1>
            {activePlayer && (
              <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-sunken)', padding: '0.25rem', borderRadius: 8 }}>
                <button
                  onClick={() => { setMode('new'); setPuzzle(null); setEmptyQueueMessage(null); }}
                  style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: 4, background: mode === 'new' ? 'var(--primary-color)' : 'transparent', color: mode === 'new' ? 'white' : 'inherit', cursor: 'pointer' }}
                >
                  New Puzzle
                </button>
                <button
                  onClick={() => { setMode('review'); setPuzzle(null); setEmptyQueueMessage(null); }}
                  style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: 4, background: mode === 'review' ? 'var(--primary-color)' : 'transparent', color: mode === 'review' ? 'white' : 'inherit', cursor: 'pointer' }}
                >
                  Review Due
                </button>
              </div>
            )}
          </div>
          <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--surface-sunken)', borderRadius: 8, marginTop: '2rem' }}>
            <h2 style={{ color: 'var(--ink-soft)' }}>{emptyQueueMessage}</h2>
            <button onClick={() => { setMode('new'); setPuzzle(null); setEmptyQueueMessage(null); }} style={{ background: 'var(--primary-color)', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer', marginTop: '1rem' }}>Back to New Puzzles</button>
          </div>
        </div>
      );
    }
    return <div style={{ padding: '2rem' }}>Loading puzzle...</div>;
  }

  // To figure out who is moving based on FEN
  const fenParts = puzzle.fen.split(' ');
  const playerColor = fenParts[1] === 'w' ? 'white' : 'black';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Clue Chess</h1>
        {activePlayer && (
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-sunken)', padding: '0.25rem', borderRadius: 8 }}>
            <button
              onClick={() => { setMode('new'); setPuzzle(null); setEmptyQueueMessage(null); }}
              style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: 4, background: mode === 'new' ? 'var(--primary-color)' : 'transparent', color: mode === 'new' ? 'white' : 'inherit', cursor: 'pointer' }}
            >
              New Puzzle
            </button>
            <button
              onClick={() => { setMode('review'); setPuzzle(null); setEmptyQueueMessage(null); }}
              style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: 4, background: mode === 'review' ? 'var(--primary-color)' : 'transparent', color: mode === 'review' ? 'white' : 'inherit', cursor: 'pointer' }}
            >
              Review Due
            </button>
          </div>
        )}
      </div>
      {!activePlayer && (
        <div style={{ background: '#f5f5f5', color: '#333', padding: '1rem', marginBottom: '1rem', borderRadius: 4 }}>
          <strong>Notice:</strong> Complete calibration to personalize clue selection. For now, you are seeing balanced starter puzzles.
        </div>
      )}

      {stats && (
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#666' }}>
          <div>Puzzles Attempted: {stats.attempt_count}</div>
          <div>Solved Rate: {Math.round(stats.solved_rate * 100)}%</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 400px' }}>
          <h2 style={{ margin: '0 0 1rem 0' }}>{puzzle.title}</h2>
          <BoardView
            fen={fen}
            playerColor={playerColor}
            status={solved ? 'game-over' : 'playing'}
            engineThinking={false}
            onPieceDrop={handlePieceDrop}
            onPromotionCheck={() => true}
            onPromotionPieceSelect={() => true}
            themeManifest={themeManifest}
            themeError={themeError}
          />
        </div>

        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: 8 }}>
            <h3>Hints ({cluesRevealed.length} used)</h3>
            <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }}>
              {cluesRevealed.map((c, i) => (
                <li key={i} style={{ marginBottom: '0.5rem' }}>{c}</li>
              ))}
            </ul>
            {!solved && (
              <button 
                onClick={handleGetClue}
                disabled={hintLevel >= ((puzzle.step_clues && puzzle.step_clues[currentStepIndex]) ? puzzle.step_clues[currentStepIndex].length : puzzle.clue_levels.length)}
                style={{ background: 'var(--primary-color)', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer', marginTop: '1rem' }}
              >
                Get Clue
              </button>
            )}
            {isMultiMove && !solved && (
              <div style={{ marginTop: '1rem', fontWeight: 'bold' }}>
                Step {currentStepIndex + 1} of {totalSteps}
              </div>
            )}
            {opponentReply && !solved && (
              <div style={{ marginTop: '0.5rem', fontStyle: 'italic', color: 'var(--ink-soft)' }}>
                Opponent replies: {opponentReply}
              </div>
            )}
          </div>

          <div style={{ minHeight: '80px' }}>
            {failed && !solved && (
              <div style={{ color: 'var(--danger-color)', fontWeight: 'bold' }}>
                Incorrect move. Try again or get a clue!
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  <button onClick={restart} className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}>Restart Sequence</button>
                  <button onClick={skipPuzzle} className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>Skip / Next Puzzle</button>
                </div>
              </div>
            )}
            {solved && (
              <div style={{ background: '#e6ffe6', color: '#006600', padding: '1rem', borderRadius: 8 }}>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Correct!</h3>
                <p style={{ margin: '0 0 0.5rem 0' }}>{puzzle.explanation}</p>
                <div style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Motif: <strong>{puzzle.motif}</strong>
                </div>
                <button 
                  onClick={startNextPuzzle}
                  style={{ background: 'var(--primary-color)', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Next Puzzle
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
