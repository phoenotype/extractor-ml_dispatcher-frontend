import { X } from "lucide-react";

interface ToastProps {
  message: string;
  onClose: () => void;
}

export function Toast({ message, onClose }: ToastProps) {
  return (
    <button type="button" className="toast" onClick={onClose}>
      <span>{message}</span>
      <X size={15} />
    </button>
  );
}
