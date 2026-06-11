import type { ReactNode } from 'react';
import { cx } from './classNames';

type RouteHeroProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  eyebrow?: string;
  meta?: ReactNode;
  title: string;
  variant?: 'command' | 'battlefield' | 'story' | 'analytics';
};

export function RouteHero({
  actions,
  children,
  className,
  eyebrow,
  meta,
  title,
  variant = 'command',
}: RouteHeroProps) {
  return (
    <header className={cx('ui-route-hero', `ui-route-hero--${variant}`, className)}>
      <div className="ui-route-hero__content">
        {eyebrow ? <p className="ui-route-hero__eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {children ? <p className="ui-route-hero__description">{children}</p> : null}
        {meta ? <div className="ui-route-hero__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="ui-route-hero__actions">{actions}</div> : null}
    </header>
  );
}
