import type { HTMLAttributes } from 'react';
import { cx } from './classNames';

type CommandBarProps = HTMLAttributes<HTMLDivElement> & {
  align?: 'start' | 'end' | 'between';
};

export function CommandBar({ align = 'end', className, ...props }: CommandBarProps) {
  return <div className={cx('ui-command-bar', `ui-command-bar--${align}`, className)} {...props} />;
}
