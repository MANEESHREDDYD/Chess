import type { HTMLAttributes } from 'react';
import { cx } from './classNames';

type ToastProps = HTMLAttributes<HTMLDivElement> & {
  tone?: 'info' | 'success' | 'warning' | 'danger';
};

export function Toast({ className, tone = 'info', ...props }: ToastProps) {
  return <div className={cx('ui-toast', `ui-toast--${tone}`, className)} role="status" {...props} />;
}
