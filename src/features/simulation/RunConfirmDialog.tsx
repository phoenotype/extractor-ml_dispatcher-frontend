import { useState } from "react";
import { Play } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

interface RunConfirmDialogProps {
  open: boolean;
  flowName: string;
  batchSize: number;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RunConfirmDialog({
  open,
  flowName,
  batchSize,
  busy,
  onClose,
  onConfirm,
}: RunConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  if (!open) return null;
  const matches = typed.trim() === flowName;

  return (
    <Dialog
      title="Esegui il flusso"
      description="Questa operazione può scrivere sul database. Digita il nome del flusso per confermare. L'esecuzione non viene mai avviata automaticamente."
      icon={<Play size={20} />}
      onClose={() => {
        setTyped("");
        onClose();
      }}
    >
      <p className="run-batch">Batch size: {batchSize}</p>
      <label>
        Digita <code>{flowName}</code> per confermare
        <input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={flowName}
          autoComplete="off"
        />
      </label>
      <div className="modal-actions">
        <Button
          onClick={() => {
            setTyped("");
            onClose();
          }}
        >
          Annulla
        </Button>
        <Button
          variant="danger"
          disabled={!matches || busy}
          onClick={() => {
            onConfirm();
            setTyped("");
          }}
        >
          Esegui ora
        </Button>
      </div>
    </Dialog>
  );
}
