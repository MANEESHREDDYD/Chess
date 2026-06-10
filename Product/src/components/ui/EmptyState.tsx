import type { ReactNode } from 'react';

type EmptyStateProps = {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ eyebrow, title, children, action }: EmptyStateProps) {
  return (
    <section className="ui-empty-state">
      {eyebrow ? <span>{eyebrow}</span> : null}
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action ? <div>{action}</div> : null}
    </section>
  );
}
