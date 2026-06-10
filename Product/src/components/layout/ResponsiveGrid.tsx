import type { HTMLAttributes } from 'react';
import { cx } from '../ui/classNames';

type ResponsiveGridProps = HTMLAttributes<HTMLDivElement> & {
  columns?: 'two' | 'three' | 'auto';
};

export function ResponsiveGrid({ className, columns = 'auto', ...props }: ResponsiveGridProps) {
  return <div className={cx('responsive-grid', `responsive-grid--${columns}`, className)} {...props} />;
}
