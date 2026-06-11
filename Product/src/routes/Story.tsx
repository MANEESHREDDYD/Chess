import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BoardView } from '../components/Board/BoardView';
import { ButtonLink } from '../components/ui/Button';
import { ContextChip } from '../components/ui/ContextChip';
import { ProgressBar } from '../components/ui/ProgressBar';
import { RouteHero } from '../components/ui/RouteHero';
import {
  completeStoryChapter,
  getStoryProgressForPlayer,
  initializeStoryProgressForPlayer,
  type StoryProgressRecord,
} from '../data/db';
import { seedPuzzles } from '../data/cluePuzzles';
import { isStandardTheme, loadThemeManifest, type ThemeManifest } from '../lib/theme';
import { audioEngine } from '../audio/audioEngine';
import { useAudioFx } from '../audio/useAudioFx';
import { useSettingsStore } from '../state/settingsStore';
import { useGameStore } from '../state/gameStore';
import { usePlayerStore } from '../state/playerStore';
import { mahabharataStorySeed } from '../story/mahabharataStorySeed';
import type { StoryChapter, StoryChapterStatus } from '../story/storyTypes';
import { usePuzzleSequence } from '../training/usePuzzleSequence';

type StoryResult = 'win' | 'loss' | 'draw';

function StoryEncounterView({
  chapter,
  onComplete,
  onBack,
}: {
  chapter: StoryChapter;
  onComplete: (result?: StoryResult) => void;
  onBack: () => void;
}) {
  const { activeTheme } = useSettingsStore();
  const [themeManifest, setThemeManifest] = useState<ThemeManifest | null>(null);
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
      } catch {
        if (!cancelled) {
          setThemeManifest(null);
          setThemeError('Failed to load theme.');
        }
      }
    }
    void loadTheme();
    return () => {
      cancelled = true;
    };
  }, [activeTheme]);

  const encounter = chapter.encounter;
  const {
    fen: gameFen,
    status: gameStatus,
    engineThinking,
    startGame,
    makePlayerMove,
    history,
  } = useGameStore();
  const hasStartedEngineRef = useRef(false);

  useAudioFx(history);

  const puzzle = useMemo(() => {
    if (encounter.type === 'clue_puzzle' && encounter.puzzle_id) {
      return seedPuzzles.find((candidate) => candidate.id === encounter.puzzle_id) ?? null;
    }
    return null;
  }, [encounter]);

  const {
    fen: puzzleFen,
    currentStepIndex,
    totalSteps,
    isMultiMove,
    solved: puzzleSolved,
    failed: puzzleFailed,
    opponentReply,
    cluesRevealed,
    hintLevel,
    handleGetClue,
    handleUserMove,
    restart,
  } = usePuzzleSequence(puzzle);

  useEffect(() => {
    if (encounter.type === 'play_engine' && !hasStartedEngineRef.current) {
      hasStartedEngineRef.current = true;
      startGame(encounter.side, encounter.engine_difficulty ?? 'Beginner');
    }
  }, [encounter, startGame]);

  useEffect(() => {
    if (encounter.type === 'play_engine' && encounter.max_moves && gameStatus === 'playing') {
      const playerMoves = Math.floor(history.length / 2) + (history.length % 2);
      if (playerMoves >= encounter.max_moves) {
        onComplete('win');
      }
    }
    if (encounter.type === 'play_engine' && gameStatus === 'game-over') {
      onComplete('loss');
    }
  }, [encounter, gameStatus, history, onComplete]);

  const handlePieceDrop = (
    sourceSquare: string,
    targetSquare: string,
    promotion?: 'b' | 'q' | 'r' | 'n'
  ) => {
    if (encounter.type === 'play_engine') {
      return makePlayerMove(sourceSquare, targetSquare, promotion);
    }

    if (encounter.type === 'clue_puzzle' && puzzle && !puzzleSolved) {
      const moveStr = `${sourceSquare}${targetSquare}${promotion ?? ''}`;
      return handleUserMove(moveStr);
    }

    return false;
  };

  const isComplete =
    (encounter.type === 'play_engine' &&
      Math.floor(history.length / 2) + (history.length % 2) >= (encounter.max_moves ?? 999)) ||
    puzzleSolved;

  return (
    <section className="story-encounter">
      <button onClick={onBack} className="btn btn-ghost story-back" type="button">
        Back to Campaign
      </button>

      <header className="story-encounter__header">
        <p className="home-eyebrow">Story Campaign Mission</p>
        <h1>Chapter {chapter.chapter_number}: {chapter.title}</h1>
        <p>
          {chapter.subtitle ? `${chapter.subtitle} - ` : ''}
          {chapter.location} with {chapter.character}
        </p>
      </header>

      <div className="story-encounter__layout">
        <div className="story-encounter__board">
          <BoardView
            fen={encounter.type === 'play_engine' ? gameFen : puzzleFen}
            playerColor={encounter.side}
            status={isComplete ? 'game-over' : 'playing'}
            engineThinking={encounter.type === 'play_engine' ? engineThinking : false}
            onPieceDrop={handlePieceDrop}
            onPromotionCheck={() => true}
            onPromotionPieceSelect={() => false}
            themeManifest={themeManifest}
            themeError={themeError}
          />
        </div>

        <aside className="story-encounter__briefing">
          <section className="ui-panel">
            <h2>Mission briefing</h2>
            <p className="story-encounter__speaker">{chapter.character}</p>
            {isComplete ? (
              <>
                {chapter.win_dialogue?.map((line, index) => (
                  <p
                    key={`${line.speaker}-${index}`}
                    className={
                      line.tone === 'narrator'
                        ? 'story-dialogue story-dialogue--narrator'
                        : 'story-dialogue'
                    }
                  >
                    "{line.text}"
                  </p>
                ))}
                <div className="story-encounter__actions">
                  <button onClick={() => onComplete('win')} className="btn btn-primary" type="button">
                    Claim Mission Reward
                  </button>
                </div>
              </>
            ) : (
              <>
                {chapter.intro_dialogue.map((line, index) => (
                  <p
                    key={`${line.speaker}-${index}`}
                    className={
                      line.tone === 'narrator'
                        ? 'story-dialogue story-dialogue--narrator'
                        : 'story-dialogue'
                    }
                  >
                    "{line.text}"
                  </p>
                ))}
                <p className="story-objective">
                  <strong>Objective:</strong> {encounter.objective}
                </p>
              </>
            )}
          </section>

          {encounter.type === 'clue_puzzle' && !isComplete ? (
            <section className="ui-panel story-assist">
              <h2>Optional tactical support</h2>
              <p>
                Campaign missions are encounters first. Request support only when you want a
                training hint inside the mission.
              </p>
              <ul>
                {cluesRevealed.map((clue, index) => (
                  <li key={`${clue}-${index}`}>{clue}</li>
                ))}
              </ul>
              <button
                onClick={handleGetClue}
                disabled={
                  !puzzle ||
                  hintLevel >=
                    (puzzle.step_clues?.[currentStepIndex]
                      ? puzzle.step_clues[currentStepIndex].length
                      : puzzle.clue_levels.length)
                }
                className="btn btn-ghost"
                type="button"
              >
                Request mission hint
              </button>
              {puzzleFailed ? (
                <div className="story-assist__warning">
                  The mission line is not working yet.
                  <div>
                    <button onClick={restart} className="btn btn-ghost" type="button">
                      Restart encounter
                    </button>
                  </div>
                </div>
              ) : null}
              {isMultiMove ? (
                <div className="story-assist__progress">
                  Mission sequence {currentStepIndex + 1} of {totalSteps}
                </div>
              ) : null}
              {opponentReply ? (
                <div className="story-assist__reply">Opponent replies: {opponentReply}</div>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>
    </section>
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
    void loadProgress();
    return () => {
      mounted = false;
    };
  }, [activePlayer]);

  const handleChapterComplete = async (chapterId: string, result?: StoryResult) => {
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
    const previewChapters = mahabharataStorySeed.slice(0, 6);
    return (
      <section className="story-campaign">
        <header className="story-campaign__hero">
          <RouteHero
            actions={<ButtonLink to="/onboarding" variant="primary">Create Profile</ButtonLink>}
            eyebrow="Story Campaign"
            meta={
              <>
                <ContextChip tone="gold">Preview</ContextChip>
                <ContextChip tone="blue">{mahabharataStorySeed.length} missions</ContextChip>
                <ContextChip>Profile required</ContextChip>
              </>
            }
            title="Kurukshetra Campaign"
            variant="story"
          >
            Create a local profile to unlock chapters, mission progress, rewards, and the next mission state.
          </RouteHero>
        </header>

        <div className="story-campaign__acts" id="campaign-path">
          <section className="story-act">
            <header className="story-act__header">
              <div>
                <span>Campaign map</span>
                <h2>{previewChapters[0]?.act_title ?? 'Act I'}</h2>
              </div>
              <p>Preview path</p>
              <ProgressBar value={0} max={previewChapters.length} label="Campaign preview progress" />
            </header>

            <div className="story-act__missions">
              {previewChapters.map((chapter, index) => (
                <article
                  className={`story-mission story-mission--${index === 0 ? 'available' : 'locked'}`}
                  key={chapter.id}
                >
                  <div>
                    <span className="ui-badge">Chapter {chapter.chapter_number}</span>
                    <h3>{chapter.title}</h3>
                    <p>
                      {chapter.subtitle ? `${chapter.subtitle} - ` : ''}
                      {chapter.character} at {chapter.location}
                    </p>
                    <p className="story-mission__objective">{chapter.encounter.objective}</p>
                  </div>
                  {index === 0 ? (
                    <Link to="/onboarding" className="btn btn-primary">
                      Create Profile
                    </Link>
                  ) : (
                    <span className="ui-badge ui-badge--muted">Locked</span>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    );
  }

  if (activeChapterId) {
    const chapter = mahabharataStorySeed.find((candidate) => candidate.id === activeChapterId);
    if (!chapter) {
      return (
        <section className="story-campaign story-campaign--empty">
          <p className="home-eyebrow">Story Campaign</p>
          <h1>Mission unavailable</h1>
          <button className="btn btn-secondary" type="button" onClick={() => setActiveChapterId(null)}>
            Back to Campaign
          </button>
        </section>
      );
    }
    return (
      <StoryEncounterView
        chapter={chapter}
        onComplete={(result) => void handleChapterComplete(chapter.id, result)}
        onBack={() => setActiveChapterId(null)}
      />
    );
  }

  const completedCount = progress.filter((record) => record.status === 'complete').length;
  const availableCount = progress.filter((record) => record.status === 'available').length;
  const actNumbers = Array.from(new Set(mahabharataStorySeed.map((chapter) => chapter.act_number ?? 1)));

  return (
    <section className="story-campaign">
      <header className="story-campaign__hero">
        <RouteHero
          actions={<ButtonLink to="#campaign-path" variant="primary">View campaign path</ButtonLink>}
          eyebrow="Story Campaign"
          meta={
            <>
              <ContextChip tone="gold">{completedCount} completed</ContextChip>
              <ContextChip tone="blue">{availableCount} available</ContextChip>
              <ContextChip>{mahabharataStorySeed.length} missions</ContextChip>
            </>
          }
          title="Kurukshetra Campaign"
          variant="story"
        >
          March through Acts I–III of the Kurukshetra campaign: mission briefings, battles, and rewards. Optional tactical support appears inside encounters when you need it.
        </RouteHero>
      </header>

      {activePlayer.calibration_status !== 'complete' ? (
        <p className="ui-warning">
          Complete calibration later to personalize story encounters and future mission rewards.
        </p>
      ) : null}

      {activeTheme !== 'mahabharata' ? (
        <p className="play-note">
          The current visual theme is a placeholder. Future milestones will build a more complete
          Kurukshetra battlefield treatment.
        </p>
      ) : null}

      <div className="story-campaign__acts" id="campaign-path">
        {actNumbers.map((actNumber) => {
          const chaptersInAct = mahabharataStorySeed.filter(
            (chapter) => (chapter.act_number ?? 1) === actNumber
          );
          const actTitle = chaptersInAct[0]?.act_title ?? `Act ${actNumber}`;
          const actStats = getActStats(chaptersInAct, progress);
          return (
            <section className="story-act" key={actNumber}>
              <header className="story-act__header">
                <div>
                  <span>Campaign path</span>
                  <h2>{actTitle}</h2>
                </div>
                <p>
                  {actStats.complete}/{actStats.total} missions complete
                </p>
                <ProgressBar value={actStats.complete} max={actStats.total} label={`${actTitle} progress`} />
              </header>

              <div className="story-act__missions">
                {chaptersInAct.map((chapter) => {
                  const record = progress.find((entry) => entry.chapter_id === chapter.id);
                  const status = record?.status ?? 'locked';
                  return (
                    <article key={chapter.id} className={`story-mission story-mission--${status}`}>
                      <div>
                        <span className="ui-badge">Chapter {chapter.chapter_number}</span>
                        <h3>{chapter.title}</h3>
                        <p>
                          {chapter.subtitle ? `${chapter.subtitle} - ` : ''}
                          {chapter.character} at {chapter.location}
                        </p>
                        <p className="story-mission__objective">{chapter.encounter.objective}</p>
                      </div>
                      <MissionStatus
                        status={status}
                        onStart={() => setActiveChapterId(chapter.id)}
                      />
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function MissionStatus({
  status,
  onStart,
}: {
  status: StoryChapterStatus;
  onStart: () => void;
}) {
  if (status === 'complete') {
    return <span className="ui-badge ui-badge--success">Completed</span>;
  }
  if (status === 'locked') {
    return <span className="ui-badge ui-badge--muted">Locked</span>;
  }
  return (
    <button onClick={onStart} className="btn btn-primary" type="button">
      Start Mission
    </button>
  );
}

function getActStats(chapters: StoryChapter[], progress: StoryProgressRecord[]) {
  const complete = chapters.filter((chapter) => {
    const record = progress.find((entry) => entry.chapter_id === chapter.id);
    return record?.status === 'complete';
  }).length;
  return { complete, total: chapters.length };
}
