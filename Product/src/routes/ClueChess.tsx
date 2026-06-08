import { useEffect, useState, useCallback } from 'react';
import { usePlayerStore } from '../state/playerStore';
import { useSettingsStore } from '../state/settingsStore';
import { BoardView } from '../components/Board/BoardView';
import { isStandardTheme, loadThemeManifest } from '../lib/theme';
import { selectCluePuzzle } from '../training/clueEngine';
import { usePuzzleSequence } from '../training/usePuzzleSequence';
import type { CluePuzzle } from '../data/cluePuzzles';
import { putClueAttempt, getClueAttemptsForPlayer, getClueStatsForPlayer, type ClueAttemptRecord } from '../data/db';

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

  const startNextPuzzle = useCallback(() => {
    // If activePlayer exists, we can fetch style vector manually if we want, but for now we pass undefined.
    // We already have their recent analysis info.
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
  }, [activePlayer, previousAttempts]);

  useEffect(() => {
    if (!puzzle && (activePlayer || !activePlayer)) {
      startNextPuzzle();
    }
  }, [puzzle, activePlayer, startNextPuzzle]);



  const finalizeAttempt = async (isSolved: boolean) => {
    if (!attemptRecord || !activePlayer) return;
    
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
    void loadStats();
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
      finalizeAttempt(true).catch(console.error);
    }
  }, [solved, activePlayer]);

  if (!puzzle) {
    return <div style={{ padding: '2rem' }}>Loading puzzle...</div>;
  }

  // To figure out who is moving based on FEN
  const fenParts = puzzle.fen.split(' ');
  const playerColor = fenParts[1] === 'w' ? 'white' : 'black';

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1>Clue Chess</h1>
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
                <div style={{ marginTop: '0.5rem' }}>
                  <button onClick={restart} className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}>Restart Sequence</button>
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
