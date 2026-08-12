import { RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

interface ConflictDialogProps {
  open: boolean;
  onReload: () => void;
  onCompare: () => void;
  onCancel: () => void;
}

export function ConflictDialog({
  open,
  onReload,
  onCompare,
  onCancel,
}: ConflictDialogProps) {
  if (!open) return null;
  return (
    <Dialog
      title="Conflitto di versione"
      description="Il flusso è stato modificato da un altro utente dopo l'ultima lettura (HTTP 409)."
      icon={<RefreshCw size={20} />}
      onClose={onCancel}
    >
      <div className="modal-actions">
        <Button onClick={onCancel}>Annulla</Button>
        <Button onClick={onCompare}>Confronta</Button>
        <Button variant="primary" onClick={onReload}>
          Ricarica dal server
        </Button>
      </div>
    </Dialog>
  );
}
