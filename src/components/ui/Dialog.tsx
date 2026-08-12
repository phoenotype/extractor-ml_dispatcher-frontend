import type { ReactNode } from "react";

interface DialogProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}

export function Dialog({
  title,
  description,
  icon,
  children,
  onClose,
  wide,
}: DialogProps) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {icon ? <div className="modal-icon">{icon}</div> : null}
        <h2 id="dialog-title">{title}</h2>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
    </div>
  );
}
