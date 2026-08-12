import { Download, FileJson } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadJson } from "@/features/flows/flow-utils";

interface LegacyReadonlyViewProps {
  flowName: string;
  definition: unknown;
}

export function LegacyReadonlyView({
  flowName,
  definition,
}: LegacyReadonlyViewProps) {
  return (
    <section className="legacy-view">
      <FileJson size={35} />
      <h2>Flusso legacy in sola lettura</h2>
      <p>
        Questo flusso usa regole o espressioni non compatibili con il nuovo
        motore. Puoi consultarlo ed esportarlo, ma non modificarlo o eseguirlo
        dalla canvas.
      </p>
      <div className="legacy-actions">
        <Button
          onClick={() => downloadJson(`${flowName}.json`, definition ?? {})}
        >
          <Download size={15} /> Esporta JSON
        </Button>
        <Button
          onClick={() =>
            void navigator.clipboard.writeText(
              JSON.stringify(definition ?? {}, null, 2),
            )
          }
        >
          Copia JSON
        </Button>
      </div>
      <pre>{JSON.stringify(definition ?? {}, null, 2)}</pre>
    </section>
  );
}
