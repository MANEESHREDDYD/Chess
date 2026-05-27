import { useState } from 'react';
import { TaskButtonGrid } from './TaskButtonGrid';
import { pieceIcon } from './pieceIcons';
import { getExchangePositions } from './taskData';

export function Task7Exchange() {
  const positions = getExchangePositions();
  const [answers, setAnswers] = useState<Record<string, string>>({});

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
