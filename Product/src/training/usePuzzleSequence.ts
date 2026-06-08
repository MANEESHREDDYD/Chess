import { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import type { CluePuzzle } from '../data/cluePuzzles';
import { evaluateClueMove, getNextClue } from './clueEngine';
import { audioEngine } from '../audio/audioEngine';
import { useSettingsStore } from '../state/settingsStore';

export function usePuzzleSequence(puzzle: CluePuzzle | null) {
  const [fen, setFen] = useState(puzzle?.fen || '');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [solved, setSolved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [opponentReply, setOpponentReply] = useState<string | null>(null);
  const [cluesRevealed, setCluesRevealed] = useState<string[]>([]);
  const [hintLevel, setHintLevel] = useState(0);
  const [attempts, setAttempts] = useState<string[]>([]);

  const activeTheme = useSettingsStore(s => s.activeTheme);
  const audioEnabled = useSettingsStore(s => s.audioEnabled);
  const audioVolume = useSettingsStore(s => s.audioVolume);

  // Initialize or reset when puzzle changes
  useEffect(() => {
    if (puzzle) {
      setFen(puzzle.fen);
      setCurrentStepIndex(0);
      setSolved(false);
      setFailed(false);
      setOpponentReply(null);
      setCluesRevealed([]);
      setHintLevel(0);
      setAttempts([]);
    }
  }, [puzzle]);

  const totalSteps = puzzle?.solution_line ? puzzle.solution_line.length : 1;
  const isMultiMove = totalSteps > 1;

  const handleGetClue = useCallback(() => {
    if (!puzzle || solved) return;
    const { clue, newHintLevel } = getNextClue(puzzle, currentStepIndex, hintLevel, cluesRevealed, undefined);
    setCluesRevealed(prev => [...prev, clue]);
    setHintLevel(newHintLevel);
  }, [puzzle, solved, currentStepIndex, hintLevel, cluesRevealed]);

  const applyOpponentMoveIfNeeded = useCallback((chess: Chess, nextStepIndex: number) => {
    if (!puzzle || !puzzle.solution_line) return { nextStep: nextStepIndex, opReply: null };
    
    let opReply: string | null = null;
    let step = nextStepIndex;
    
    while (step < puzzle.solution_line.length && puzzle.solution_line[step].side === 'opponent') {
      const opMove = puzzle.solution_line[step].move;
      const res = chess.move(opMove);
      if (res) {
        opReply = res.san;
      }
      step++;
    }
    return { nextStep: step, opReply };
  }, [puzzle]);

  const handleUserMove = useCallback((moveStr: string) => {
    if (!puzzle || solved) return false;

    const { valid, correct, normalizedMove } = evaluateClueMove(puzzle, moveStr, fen, currentStepIndex);

    if (!valid) return false;

    const moveRecord = normalizedMove || moveStr;
    setAttempts(prev => [...prev, moveRecord]);

    if (correct) {
      setFailed(false);
      setOpponentReply(null);

      const chess = new Chess(fen);
      chess.move(moveStr);

      let nextStep = currentStepIndex + 1;
      
      // Auto-apply opponent moves if present
      const { nextStep: advancedStep, opReply } = applyOpponentMoveIfNeeded(chess, nextStep);
      nextStep = advancedStep;

      setFen(chess.fen());
      setCurrentStepIndex(nextStep);
      setOpponentReply(opReply);
      setHintLevel(0); // reset hint level for the new step
      
      const isComplete = nextStep >= totalSteps;
      if (isComplete) {
        setSolved(true);
        if (audioEnabled) audioEngine.playPuzzleSuccessSound({ theme: activeTheme, volume: audioVolume });
      }

      return true;
    } else {
      setFailed(true);
      if (audioEnabled) audioEngine.playPuzzleFailureSound({ theme: activeTheme, volume: audioVolume });
      return false;
    }
  }, [puzzle, solved, fen, currentStepIndex, applyOpponentMoveIfNeeded, totalSteps, audioEnabled, activeTheme, audioVolume]);

  const restart = useCallback(() => {
    if (puzzle) {
      setFen(puzzle.fen);
      setCurrentStepIndex(0);
      setSolved(false);
      setFailed(false);
      setOpponentReply(null);
      setHintLevel(0);
    }
  }, [puzzle]);

  return {
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
  };
}
