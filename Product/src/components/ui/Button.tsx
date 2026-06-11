import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from './classNames';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'story' | 'danger' | 'selected';
type ButtonSize = 'default' | 'compact' | 'icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
};

type ButtonLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: ReactNode;
};

export function Button({
  children,
  className,
  fullWidth = false,
  icon,
  loading = false,
  variant = 'secondary',
  size = 'default',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      className={cx(
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        fullWidth && 'ui-button--full',
        loading && 'is-loading',
        className
      )}
      type={type}
      {...props}
    >
      {loading ? <span className="ui-button__spinner" aria-hidden="true" /> : icon ? <span className="ui-button__icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

export function ButtonLink({
  className,
  fullWidth = false,
  icon,
  variant = 'secondary',
  size = 'default',
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cx(
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        fullWidth && 'ui-button--full',
        className
      )}
      {...props}
    >
      {icon ? <span className="ui-button__icon">{icon}</span> : null}
      <span>{children}</span>
    </Link>
  );
}
