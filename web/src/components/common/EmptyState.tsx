import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ title, description, action }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state__title">{title}</div>
      {description && <div className="empty-state__desc">{description}</div>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
