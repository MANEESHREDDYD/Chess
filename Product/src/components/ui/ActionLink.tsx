import { Link, type LinkProps } from 'react-router-dom';
import { cx } from './classNames';

type ActionLinkProps = LinkProps & {
  muted?: boolean;
};

export function ActionLink({ className, muted, ...props }: ActionLinkProps) {
  return <Link className={cx('ui-action-link', muted && 'ui-action-link--muted', className)} {...props} />;
}
