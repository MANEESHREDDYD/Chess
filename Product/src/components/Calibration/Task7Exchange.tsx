import { useEffect, useState } from 'react';
import { TaskButtonGrid } from './TaskButtonGrid';
import { pieceIcon } from './pieceIcons';
import { getExchangePositions } from './taskData';

type Task7ExchangeProps = {
  onComplete?: (result: {
    choices: Array<{ decision: 'accept' | 'decline'; kept_minor: 'knight' | 'bishop' }>;
  }) => void;
};

export function Task7Exchange({ onComplete }: Task7ExchangeProps) {
  const positions = getExchangePositions();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (positions.length === 0) return;
    if (Object.keys(answers).length !== positions.length) return;

    onComplete?.({
      choices: positions.map((position) => {
        const selected = answers[position.id];
        if (selected === position.accept) {
          return { decision: 'accept', kept_minor: position.kept_minor_accept };
        }

        return { decision: 'decline', kept_minor: position.kept_minor_decline };
      }),
    });
  }, [answers, onComplete, positions]);

  return (
    <div className="calibration-exchange-task">
      {positions.map((position) => {
        const selected = answers[position.id] ?? null;

        return (
          <TaskButtonGrid
            key={position.id}
            title="Task 7 · Exchange willingness"
            subtitle="Some trades are honest. Some are a test."
            columns={2}
            options={[
              {
                id: position.accept,
                label: 'Accept the trade',
                description: `Keeps the ${position.kept_minor_accept}.`,
                icon: pieceIcon(position.kept_minor_accept === 'bishop' ? 'wB' : 'wN'),
                selected: selected === position.accept,
              },
              {
                id: position.decline,
                label: 'Decline the trade',
                description: `Keeps the ${position.kept_minor_decline}.`,
                icon: pieceIcon(position.kept_minor_decline === 'bishop' ? 'wB' : 'wN'),
                selected: selected === position.decline,
              },
            ]}
            onChoose={(id) => setAnswers((current) => ({ ...current, [position.id]: id }))}
          />
        );
      })}
    </div>
  );
}
