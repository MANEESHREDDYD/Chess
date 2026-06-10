import type { ReactNode } from 'react';
import { Card } from './Card';
import { cx } from './classNames';

type TableCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function TableCard({ title, description, children, className }: TableCardProps) {
  return (
    <Card className={cx('ui-table-card', className)}>
      <div className="ui-table-card__header">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="ui-table-card__scroller">{children}</div>
    </Card>
  );
}
