import type { HTMLAttributes } from 'react';
import { cx } from './classNames';

type ContextChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'gold' | 'blue' | 'success' | 'warning' | 'danger';
};

export function ContextChip({ className, tone = 'neutral', ...props }: ContextChipProps) {
  return <span className={cx('ui-context-chip', `ui-context-chip--${tone}`, className)} {...props} />;
}
