import type { CSSProperties } from 'react';
import { cx } from './classNames';

type StatRingProps = {
  label: string;
  value: string | number;
  progress?: number;
  className?: string;
};

export function StatRing({ className, label, progress = 0, value }: StatRingProps) {
  const safeProgress = Math.min(100, Math.max(0, progress));
  return (
    <div className={cx('ui-stat-ring', className)} style={{ '--stat-ring-progress': `${safeProgress}%` } as CSSProperties}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
