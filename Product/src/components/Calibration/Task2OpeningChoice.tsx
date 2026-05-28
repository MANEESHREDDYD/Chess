import { useEffect, useState } from 'react';
import { TaskButtonGrid } from './TaskButtonGrid';
import { pieceIcon } from './pieceIcons';
import { getOpeningChoiceTask } from './taskData';

const choicePieces = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK'] as const;

type Task2OpeningChoiceProps = {
  onComplete?: (result: { selected_move: string }) => void;
};

export function Task2OpeningChoice({ onComplete }: Task2OpeningChoiceProps) {
  const task = getOpeningChoiceTask();
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedChoice) return;
    onComplete?.({ selected_move: selectedChoice });
  }, [onComplete, selectedChoice]);

  if (!task) return null;

  return (
    <TaskButtonGrid
      title="Task 2 · Opening choice"
      subtitle="Begin a game in the way that pleases you."
      columns={3}
      options={task.choices.map((choice, index) => ({
        id: choice,
        label: choice,
        description: index === 0 ? 'Most direct.' : index === 1 ? 'Solid.' : 'Flexible.',
        icon: pieceIcon(choicePieces[index % choicePieces.length]),
        selected: selectedChoice === choice,
      }))}
      onChoose={(id) => setSelectedChoice(id)}
    />
  );
}
