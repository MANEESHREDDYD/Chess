import type { HTMLAttributes } from 'react';
import { cx } from './classNames';

type CardVariant = 'default' | 'elevated' | 'glass' | 'game-panel' | 'battlefield' | 'warning' | 'success';

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: 'article' | 'section' | 'div';
  variant?: CardVariant;
};

export function Card({ as: Element = 'section', className, variant = 'default', ...props }: CardProps) {
  return <Element className={cx('ui-card', `ui-card--${variant}`, className)} {...props} />;
}
