import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from './classNames';

export type NovaButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'selected';
export type NovaButtonSize = 'md' | 'lg' | 'sm' | 'icon';

type SharedProps = {
  variant?: NovaButtonVariant;
  size?: NovaButtonSize;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconAfter?: ReactNode;
};

function classes(variant: NovaButtonVariant, size: NovaButtonSize, fullWidth: boolean, className?: string) {
  return cx(
    'nova-btn',
    `nova-btn--${variant}`,
    size !== 'md' && `nova-btn--${size}`,
    fullWidth && 'nova-btn--full',
    className
  );
}

type NovaButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & SharedProps;

export function NovaButton({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  icon,
  iconAfter,
  type = 'button',
  ...props
}: NovaButtonProps) {
  return (
    <button className={classes(variant, size, fullWidth, className)} type={type} {...props}>
      {icon ? <span className="nova-btn__icon">{icon}</span> : null}
      {children != null && children !== false ? <span>{children}</span> : null}
      {iconAfter ? <span className="nova-btn__icon">{iconAfter}</span> : null}
    </button>
  );
}

type NovaButtonLinkProps = LinkProps & SharedProps & { children: ReactNode };

export function NovaButtonLink({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  icon,
  iconAfter,
  ...props
}: NovaButtonLinkProps) {
  return (
    <Link className={classes(variant, size, fullWidth, className)} {...props}>
      {icon ? <span className="nova-btn__icon">{icon}</span> : null}
      <span>{children}</span>
      {iconAfter ? <span className="nova-btn__icon">{iconAfter}</span> : null}
    </Link>
  );
}
