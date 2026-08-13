import { useState } from "react";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { slug } from "@/features/flows/flow-utils";

interface CreateFlowDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    flowName: string;
    description: string;
    documentType: string;
  }) => void;
}

export function CreateFlowDialog({
  open,
  onClose,
  onCreate,
}: CreateFlowDialogProps) {
  const [flowName, setFlowName] = useState("");
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] = useState("Fattura");

  if (!open) return null;

  return (
    <Dialog
      title="Nuovo flusso"
      description="Crea una definizione visuale. Il flusso nasce inattivo."
      icon={<Plus size={20} />}
      onClose={onClose}
    >
      <label>
        Nome tecnico
        <input
          value={flowName}
          onChange={(event) => setFlowName(slug(event.target.value))}
          placeholder="es. invoice_opt_in_archive"
        />
      </label>
      <label>
        Descrizione
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Breve descrizione operativa"
        />
      </label>
      <label>
        Categoria descrittiva
        <input
          value={documentType}
          onChange={(event) => setDocumentType(event.target.value)}
          placeholder="Non è un filtro operativo"
        />
      </label>
      <div className="modal-actions">
        <Button onClick={onClose}>Annulla</Button>
        <Button
          variant="primary"
          disabled={!flowName}
          onClick={() => {
            onCreate({ flowName, description, documentType });
            setFlowName("");
            setDescription("");
            setDocumentType("Fattura");
          }}
        >
          Crea e apri
        </Button>
      </div>
    </Dialog>
  );
}
