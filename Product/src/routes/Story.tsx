import { useEffect, useState, useMemo, useRef } from 'react';
import { usePlayerStore } from '../state/playerStore';
import { useSettingsStore } from '../state/settingsStore';
import { getStoryProgressForPlayer, initializeStoryProgressForPlayer, completeStoryChapter, type StoryProgressRecord } from '../data/db';
import { mahabharataStorySeed } from '../story/mahabharataStorySeed';
import { isStandardTheme, loadThemeManifest } from '../lib/theme';
import { BoardView } from '../components/Board/BoardView';
import { Link } from 'react-router-dom';
import { seedPuzzles } from '../data/cluePuzzles';
import { getNextClue, evaluateClueMove } from '../training/clueEngine';
import { Chess } from 'chess.js';
import { useGameStore } from '../state/gameStore';
import { useAudioFx } from '../audio/useAudioFx';
import { audioEngine } from '../audio/audioEngine';

function StoryEncounterView({ 
  chapter, 
  onComplete, 
  onBack 
}: { 
  chapter: typeof mahabharataStorySeed[0], 
  onComplete: (result?: 'win'|'loss'|'draw') => void, 
  onBack: () => void 
}) {
  const { activeTheme } = useSettingsStore();
  const [themeManifest, setThemeManifest] = useState<any>(null);
  const [themeError, setThemeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadTheme() {
      // For story, if classic is active, we just use classic, but we can recommend Kurukshetra.
      if (isStandardTheme(activeTheme)) {
        setThemeManifest(null);
        setThemeError(null);
        return;
      }
      try {
        const manifest = await loadThemeManifest(activeTheme);
        if (!cancelled) setThemeManifest(manifest);
      } catch (err) {
        if (!cancelled) setThemeError('Failed to load theme');
      }
    }
    loadTheme();
    return () => { cancelled = true; };
  }, [activeTheme]);

  const encounter = chapter.encounter;
  
  // -- Play Engine State --
  const { fen: gameFen, status: gameStatus, engineThinking, startGame, makePlayerMove, history } = useGameStore();
  const hasStartedEngineRef = useRef(false);

  useAudioFx(history);

  // -- Clue Puzzle State --
  const [puzzleFen, setPuzzleFen] = useState('');
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [puzzleFailed, setPuzzleFailed] = useState(false);
  const [cluesRevealed, setCluesRevealed] = useState<string[]>([]);
  const [hintLevel, setHintLevel] = useState(0);
  
  const puzzle = useMemo(() => {
    if (encounter.type === 'clue_puzzle' && encounter.puzzle_id) {
      return seedPuzzles.find(p => p.id === encounter.puzzle_id);
    }
    return null;
  }, [encounter]);

  useEffect(() => {
    if (encounter.type === 'play_engine' && !hasStartedEngineRef.current) {
      hasStartedEngineRef.current = true;
      startGame(encounter.side, encounter.engine_difficulty || 'Beginner');
    }
  }, [encounter, startGame]);

  useEffect(() => {
    if (puzzle && !puzzleFen) {
      setPuzzleFen(puzzle.fen);
    }
  }, [puzzle, puzzleFen]);

  // Check Play Engine completion (e.g. survive max_moves)
  useEffect(() => {
    if (encounter.type === 'play_engine' && encounter.max_moves && gameStatus === 'playing') {
      const playerMoves = Math.floor(history.length / 2) + (history.length % 2);
      if (playerMoves >= encounter.max_moves) {
        onComplete('win');
      }
    }
    if (encounter.type === 'play_engine' && gameStatus === 'game-over') {
      onComplete('loss'); // simple assumption for now
    }
  }, [history, gameStatus, encounter, onComplete]);

  const handlePieceDrop = (sourceSquare: string, targetSquare: string, promotion?: string) => {
    if (encounter.type === 'play_engine') {
      return makePlayerMove(sourceSquare, targetSquare, promotion);
    } 
    
    if (encounter.type === 'clue_puzzle' && puzzle && !puzzleSolved) {
      const moveStr = `${sourceSquare}${targetSquare}${promotion || ''}`;
      const { valid, correct } = evaluateClueMove(puzzle, moveStr);
      if (!valid) return false;
      
      if (correct) {
        const chess = new Chess(puzzleFen);
        chess.move(moveStr);
        setPuzzleFen(chess.fen());
        setPuzzleSolved(true);
        setPuzzleFailed(false);
        const { audioEnabled, audioVolume } = useSettingsStore.getState();
        if (audioEnabled) audioEngine.playPuzzleSuccessSound({ theme: activeTheme, volume: audioVolume });
      } else {
        setPuzzleFailed(true);
        const { audioEnabled, audioVolume } = useSettingsStore.getState();
        if (audioEnabled) audioEngine.playPuzzleFailureSound({ theme: activeTheme, volume: audioVolume });
      }
      return correct;
    }
    
    return false;
  };

  const handleGetClue = () => {
    if (!puzzle || puzzleSolved) return;
    const { clue, newHintLevel } = getNextClue(puzzle, hintLevel, cluesRevealed, undefined);
    setCluesRevealed([...cluesRevealed, clue]);
    setHintLevel(newHintLevel);
  };

  const isComplete = (encounter.type === 'play_engine' && (Math.floor(history.length / 2) + (history.length % 2) >= (encounter.max_moves || 999))) || puzzleSolved;

  return (
    <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <button onClick={onBack} className="btn btn-ghost" style={{ marginBottom: '1rem' }}>&larr; Back to Map</button>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.5rem 0' }}>Chapter {chapter.chapter_number}: {chapter.title}</h2>
        <div style={{ fontSize: '0.9rem', color: 'var(--ink-soft)' }}>
          {chapter.location} • {chapter.character}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 400px' }}>
          <BoardView
            fen={encounter.type === 'play_engine' ? gameFen : puzzleFen}
            playerColor={encounter.side}
            status={isComplete ? 'game-over' : 'playing'}
            engineThinking={encounter.type === 'play_engine' ? engineThinking : false}
            onPieceDrop={handlePieceDrop}
            onPromotionCheck={() => true}
            onPromotionPieceSelect={() => true}
            themeManifest={themeManifest}
            themeError={themeError}
          />
        </div>

        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'var(--surface-sunken)', padding: '1.5rem', borderRadius: 8 }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>{chapter.character}</h3>
            {isComplete ? (
              <>
                {chapter.win_dialogue?.map((line, i) => (
                  <p key={i} style={{ fontStyle: line.tone === 'narrator' ? 'italic' : 'normal', margin: '0 0 0.5rem 0' }}>
                    "{line.text}"
                  </p>
                ))}
                <div style={{ marginTop: '2rem' }}>
                  <button onClick={() => onComplete('win')} className="btn btn-primary">Complete Chapter</button>
                </div>
              </>
            ) : (
              <>
                {chapter.intro_dialogue.map((line, i) => (
                  <p key={i} style={{ fontStyle: line.tone === 'narrator' ? 'italic' : 'normal', margin: '0 0 0.5rem 0' }}>
                    "{line.text}"
                  </p>
                ))}
                <div style={{ marginTop: '1.5rem', padding: '1rem', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                  <strong>Objective:</strong> {encounter.objective}
                </div>
              </>
            )}
          </div>

          {encounter.type === 'clue_puzzle' && !isComplete && (
            <div style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: 8 }}>
              <h4>Hints</h4>
              <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }}>
                {cluesRevealed.map((c, i) => <li key={i} style={{ fontSize: '0.9rem' }}>{c}</li>)}
              </ul>
              <button 
                onClick={handleGetClue}
                disabled={!puzzle || hintLevel >= puzzle.clue_levels.length}
                className="btn btn-ghost"
              >
                Get Clue
              </button>
              {puzzleFailed && <div style={{ color: 'var(--danger-color)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Incorrect move.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Story() {
  const { activePlayer } = usePlayerStore();
  const { activeTheme } = useSettingsStore();
  const [progress, setProgress] = useState<StoryProgressRecord[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadProgress() {
      if (!activePlayer) return;
      await initializeStoryProgressForPlayer(activePlayer.id);
      const records = await getStoryProgressForPlayer(activePlayer.id);
      if (mounted) setProgress(records);
    }
    loadProgress();
    return () => { mounted = false; };
  }, [activePlayer]);

  const handleChapterComplete = async (chapterId: string, result?: 'win'|'loss'|'draw') => {
    if (!activePlayer) return;
    await completeStoryChapter(activePlayer.id, chapterId, result);
    
    if (result === 'win') {
      const { audioEnabled, audioVolume } = useSettingsStore.getState();
      if (audioEnabled) audioEngine.playStoryCompleteSound({ theme: activeTheme, volume: audioVolume });
    }
    
    const records = await getStoryProgressForPlayer(activePlayer.id);
    setProgress(records);
    setActiveChapterId(null);
  };

  if (!activePlayer) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Story Mode</h2>
        <p>You must create a player profile to begin the campaign.</p>
        <Link to="/onboarding" className="btn btn-primary">Create Profile</Link>
      </div>
    );
  }

  if (activeChapterId) {
    const chapter = mahabharataStorySeed.find(c => c.id === activeChapterId)!;
    return <StoryEncounterView 
             chapter={chapter} 
             onComplete={(r) => handleChapterComplete(chapter.id, r)} 
             onBack={() => setActiveChapterId(null)} 
           />;
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>The Kurukshetra Campaign</h1>
      <h3 style={{ marginTop: 0, marginBottom: '2rem', color: 'var(--ink-soft)' }}>Act I: The Gathering</h3>
      
      {activePlayer.calibration_status !== 'complete' && (
        <div style={{ background: '#fff3cd', color: '#856404', padding: '1rem', borderRadius: 4, marginBottom: '2rem' }}>
          <strong>Note:</strong> Complete calibration later to fully personalize story encounters.
        </div>
      )}

      {activeTheme !== 'mahabharata' && (
        <div style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', marginBottom: '2rem' }}>
          Best experienced in the Kurukshetra theme.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {mahabharataStorySeed.map(chapter => {
          const rec = progress.find(p => p.chapter_id === chapter.id);
          const status = rec?.status || 'locked';
          
          return (
            <div key={chapter.id} style={{ 
              padding: '1.5rem', 
              background: status === 'locked' ? 'var(--surface-sunken)' : 'var(--paper)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              opacity: status === 'locked' ? 0.6 : 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '0.25rem' }}>
                  Chapter {chapter.chapter_number}
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: status === 'locked' ? 'var(--ink-soft)' : 'inherit' }}>
                  {chapter.title}
                </h3>
                <div style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', marginTop: '0.25rem' }}>
                  <strong>{chapter.character}</strong> • {chapter.location}
                </div>
              </div>
              
              <div>
                {status === 'complete' && <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Complete</span>}
                {status === 'locked' && <span style={{ color: 'var(--ink-soft)' }}>Locked</span>}
                {status === 'available' && (
                  <button onClick={() => setActiveChapterId(chapter.id)} className="btn btn-primary">
                    Begin
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
