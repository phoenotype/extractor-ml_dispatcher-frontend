import clsx from "clsx";
import type { ReactNode } from "react";

interface BadgeProps {
  tone?: "default" | "success" | "muted" | "warning" | "danger";
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "default", children, className }: BadgeProps) {
  return (
    <span className={clsx("ui-badge", `tone-${tone}`, className)}>{children}</span>
  );
}
