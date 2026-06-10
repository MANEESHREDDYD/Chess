import type { HTMLAttributes } from 'react';
import { cx } from './classNames';

type BadgeVariant = 'neutral' | 'active' | 'success' | 'warning' | 'danger' | 'info';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return <span className={cx('ui-badge-v2', `ui-badge-v2--${variant}`, className)} {...props} />;
}
