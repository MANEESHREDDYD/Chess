import type { ReactNode } from 'react';

type ButtonGridOption = {
  id: string;
  label: string;
  description?: string;
  icon: ReactNode;
  selected?: boolean;
  disabled?: boolean;
};

type TaskButtonGridProps = {
  title: string;
  subtitle?: string;
  options: ButtonGridOption[];
  onChoose: (id: string) => void;
  columns?: 2 | 3 | 4;
};

export function TaskButtonGrid({ title, subtitle, options, onChoose, columns = 3 }: TaskButtonGridProps) {
  return (
    <section className="calibration-grid-shell">
      <header className="calibration-grid-header">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>

      <div className={`calibration-grid calibration-grid--${columns}`}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`calibration-grid-card${option.selected ? ' is-selected' : ''}`}
            onClick={() => onChoose(option.id)}
            disabled={option.disabled}
            aria-pressed={option.selected}
          >
            <span className="calibration-grid-icon" aria-hidden="true">
              {option.icon}
            </span>
            <span className="calibration-grid-label">{option.label}</span>
            {option.description ? <span className="calibration-grid-description">{option.description}</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

