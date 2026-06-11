import { cx } from './classNames';

type ProgressBarProps = {
  label?: string;
  value: number;
  max?: number;
  className?: string;
};

export function ProgressBar({ className, label, max = 100, value }: ProgressBarProps) {
  const percent = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cx('ui-progress-bar', className)} aria-label={label}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}
