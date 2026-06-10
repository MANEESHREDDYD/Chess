import type { HTMLAttributes } from 'react';
import { cx } from './classNames';

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: 'aside' | 'section' | 'div';
};

export function Panel({ as: Element = 'section', className, ...props }: PanelProps) {
  return <Element className={cx('ui-panel-v2', className)} {...props} />;
}
