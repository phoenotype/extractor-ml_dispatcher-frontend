import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      {Icon ? <Icon size={28} /> : null}
      <b>{title}</b>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
