import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './classNames';

type ModeTileProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  badge?: ReactNode;
  description: string;
  eyebrow?: string;
  selected?: boolean;
  title: string;
};

export function ModeTile({
  badge,
  className,
  description,
  eyebrow,
  selected = false,
  title,
  ...props
}: ModeTileProps) {
  return (
    <button className={cx('ui-mode-tile', selected && 'is-selected', className)} type="button" {...props}>
      <span className="ui-mode-tile__glow" aria-hidden="true" />
      <span className="ui-mode-tile__body">
        {eyebrow ? <small>{eyebrow}</small> : null}
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      {badge ? <span className="ui-mode-tile__badge">{badge}</span> : null}
    </button>
  );
}
