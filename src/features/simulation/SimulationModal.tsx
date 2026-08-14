import { AlertTriangle, Database, Play } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

interface SimulationModalProps {
  open: boolean;
  protocol: string;
  batchSize: number;
  executeHttp: boolean;
  busy?: boolean;
  onProtocolChange: (value: string) => void;
  onBatchSizeChange: (value: number) => void;
  onExecuteHttpChange: (value: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function SimulationModal({
  open,
  protocol,
  batchSize,
  executeHttp,
  busy,
  onProtocolChange,
  onBatchSizeChange,
  onExecuteHttpChange,
  onClose,
  onSubmit,
}: SimulationModalProps) {
  if (!open) return null;
  return (
    <Dialog
      title="Simula il flusso"
      description="La simulazione non modifica il database. Puoi scegliere se eseguire realmente i nodi HTTP raggiunti."
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
          <b>Simulazione dry-run</b>
          <small>
            Nessuna scrittura sul database.
          </small>
        </div>
      </div>
      <label className="simulation-http-option">
        <input
          type="checkbox"
          checked={executeHttp}
          onChange={(event) => onExecuteHttpChange(event.target.checked)}
        />
        <AlertTriangle size={17} />
        <span>
          <b>Esegui realmente i nodi HTTP</b>
          <small>
            Può generare effetti su sistemi esterni, anche se il database viene
            lasciato invariato.
          </small>
        </span>
      </label>
      <div className="modal-actions">
        <Button onClick={onClose}>Annulla</Button>
        <Button variant="primary" disabled={busy} onClick={onSubmit}>
          <Play size={15} /> Avvia simulazione
        </Button>
      </div>
    </Dialog>
  );
}
