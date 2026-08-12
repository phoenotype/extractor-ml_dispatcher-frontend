import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        "ui-button",
        variant === "primary" && "primary",
        variant === "danger" && "danger",
        variant === "ghost" && "ghost",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
