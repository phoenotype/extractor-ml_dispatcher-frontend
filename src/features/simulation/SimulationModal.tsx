import { Database, Play } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

interface SimulationModalProps {
  open: boolean;
  protocol: string;
  batchSize: number;
  busy?: boolean;
  onProtocolChange: (value: string) => void;
  onBatchSizeChange: (value: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function SimulationModal({
  open,
  protocol,
  batchSize,
  busy,
  onProtocolChange,
  onBatchSizeChange,
  onClose,
  onSubmit,
}: SimulationModalProps) {
  if (!open) return null;
  return (
    <Dialog
      title="Simula il flusso"
      description="La simulazione usa il motore del backend in sola lettura. Non modifica il database."
      icon={<Play size={20} />}
      onClose={onClose}
    >
      <label>
        Protocollo <span>opzionale</span>
        <input
          value={protocol}
          onChange={(event) =>
            onProtocolChange(event.target.value.replace(/\D/g, ""))
          }
          placeholder="es. 123"
        />
      </label>
      <label>
        Numero documenti
        <input
          type="number"
          min={1}
          max={100}
          value={batchSize}
          onChange={(event) => onBatchSizeChange(Number(event.target.value))}
        />
      </label>
      <div className="safety">
        <Database size={17} />
        <div>
          <b>Nessuna scrittura sul database</b>
          <small>Vedrai soltanto il percorso e le modifiche pianificate.</small>
        </div>
      </div>
      <div className="modal-actions">
        <Button onClick={onClose}>Annulla</Button>
        <Button variant="primary" disabled={busy} onClick={onSubmit}>
          <Play size={15} /> Avvia simulazione
        </Button>
      </div>
    </Dialog>
  );
}
