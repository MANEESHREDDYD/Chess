import type { HTMLAttributes } from 'react';
import { cx } from './classNames';

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'article' | 'section' | 'aside' | 'div';
  tone?: 'command' | 'glass' | 'battlefield' | 'story' | 'analytics' | 'system';
};

export function Surface({ as: Element = 'section', className, tone = 'glass', ...props }: SurfaceProps) {
  return <Element className={cx('ui-surface', `ui-surface--${tone}`, className)} {...props} />;
}
