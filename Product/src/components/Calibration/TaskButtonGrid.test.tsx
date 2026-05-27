import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskButtonGrid } from './TaskButtonGrid';
import { pieceIcon } from './pieceIcons';

describe('TaskButtonGrid', () => {
  it('renders piece icons and forwards selection', () => {
    const onChoose = vi.fn();

    render(
      <TaskButtonGrid
        title="Task"
        subtitle="Sub"
        options={[
          { id: 'a', label: 'Alpha', icon: pieceIcon('wP') },
          { id: 'b', label: 'Beta', icon: pieceIcon('bN') },
        ]}
        onChoose={onChoose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /alpha/i }));
    expect(onChoose).toHaveBeenCalledWith('a');
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('Sub')).toBeInTheDocument();
  });
});
