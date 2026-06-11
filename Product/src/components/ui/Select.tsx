import type { SelectHTMLAttributes } from 'react';
import { cx } from './classNames';

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: SelectOption[];
  tone?: 'command' | 'field';
};

export function Select({ className, label, options, tone = 'field', ...props }: SelectProps) {
  return (
    <label className={cx('ui-select', `ui-select--${tone}`, className)}>
      {label ? <span>{label}</span> : null}
      <span className="ui-select__control">
        <select {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
