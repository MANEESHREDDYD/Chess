import { useEffect, useState } from 'react';
import { TaskButtonGrid } from './TaskButtonGrid';
import { pieceIcon } from './pieceIcons';
import { getBlackRepertoireTask } from './taskData';

type Task6BlackRepertoireProps = {
  onComplete?: (result: { selected_replies: string[] }) => void;
};

export function Task6BlackRepertoire({ onComplete }: Task6BlackRepertoireProps) {
  const positions = getBlackRepertoireTask();
  const [selected, setSelected] = useState<Record<number, string>>({});

  useEffect(() => {
    if (positions.length === 0) return;
    if (Object.keys(selected).length !== positions.length) return;

    onComplete?.({ selected_replies: positions.map((_, index) => selected[index]).filter((value): value is string => Boolean(value)) });
  }, [onComplete, positions, selected]);

  return (
    <div className="calibration-black-repertoire">
      {positions.map((position, index) => {
        const selectedChoice = selected[index] ?? null;

        return (
          <TaskButtonGrid
            key={position.after_white}
            title={`Task 6 · Black repertoire ${index + 1}`}
            subtitle="White has spoken first. Choose your answer."
            columns={4}
            options={position.choices.map((choice, choiceIndex) => ({
              id: choice,
              label: choice,
              description: choiceIndex === 0 ? 'Principled' : choiceIndex === 1 ? 'Developing' : 'Sharper',
              icon: pieceIcon(choice.startsWith('e7') ? 'bP' : choice.startsWith('g8') ? 'bN' : choice.startsWith('f7') ? 'bB' : 'bQ'),
              selected: selectedChoice === choice,
            }))}
            onChoose={(id) => setSelected((current) => ({ ...current, [index]: id }))}
          />
        );
      })}
    </div>
  );
}
