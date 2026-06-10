import type { HTMLAttributes } from 'react';
import { cx } from '../ui/classNames';

export function PageFrame({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cx('page-frame', className)} {...props} />;
}
