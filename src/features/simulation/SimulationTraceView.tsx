import { Play, RefreshCw, ShieldCheck } from "lucide-react";
import type { SimulationDocument } from "@/types/flow";

interface SimulationTraceViewProps {
  documents: SimulationDocument[];
  count?: number | null;
  index: number;
  onIndexChange: (index: number) => void;
  loading?: boolean;
}

export function SimulationTraceView({
  documents,
  count,
  index,
  onIndexChange,
  loading,
}: SimulationTraceViewProps) {
  if (loading) {
    return (
      <div className="result-empty">
        <RefreshCw className="spin" />
        <b>Simulazione in corso…</b>
        <span>Il backend sta valutando i documenti in sola lettura.</span>
      </div>
    );
  }

  const resolvedCount =
    typeof count === "number" ? count : documents.length;
  const hasCompletedEmptyRun =
    typeof count === "number" && count === 0 && documents.length === 0;

  if (hasCompletedEmptyRun) {
    return (
      <div className="result-empty">
        <Play size={25} />
        <b>Nessun documento trovato</b>
        <span>
          Nessun documento soddisfa tutti i criteri del trigger: stato di
          esportazione, tipo documento e abilitazione aziendale.
        </span>
      </div>
    );
  }

  const document = documents[index];
  if (!document) {
    return (
      <div className="result-empty">
        <Play size={25} />
        <b>Nessuna simulazione disponibile</b>
        <span>
          Avvia una simulazione per vedere percorso e modifiche pianificate.
        </span>
      </div>
    );
  }

  return (
    <div className="simulation-result">
      {documents.length > 1 || resolvedCount > 1 ? (
        <div className="doc-switcher">
          <label>
            Documento
            <select
              value={index}
              onChange={(event) => onIndexChange(Number(event.target.value))}
            >
              {documents.map((doc, docIndex) => (
                <option key={docIndex} value={docIndex}>
                  #{docIndex + 1}
                  {doc.protocol != null ? ` · protocollo ${doc.protocol}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <div className="safety-result">
        <ShieldCheck size={18} />
        <div>
          <b>
            {document.databaseWrites === 0
              ? "Nessuna scrittura sul database"
              : `${document.databaseWrites} scritture segnalate`}
          </b>
          <small>
            Simulazione completata · protocollo {document.protocol ?? "campione"}
          </small>
        </div>
      </div>
      <div className="trace">
        <b>Percorso eseguito</b>
        {(document.trace || []).map((step, stepIndex) => (
          <div key={stepIndex}>
            <i>{stepIndex + 1}</i>
            <span>
              <strong>{step.nodeId || step.node || "Nodo"}</strong>
              {typeof step.conditionResult === "boolean" ? (
                <small>
                  Condizione: {step.conditionResult ? "vera" : "falsa"}
                </small>
              ) : null}
            </span>
            {step.branch ? (
              <em className={String(step.branch)}>{String(step.branch)}</em>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mutation">
        <span>
          <small>Stato iniziale</small>
          <b>{document.sourceExportStatus ?? "—"}</b>
        </span>
        <i>→</i>
        <span>
          <small>Stato previsto</small>
          <b>
            {String(
              document.plannedMutations?.[0]?.to ??
                document.plannedMutations?.[0]?.value ??
                "Invariato",
            )}
          </b>
        </span>
      </div>
      {(document.plannedMutations || []).length > 0 ? (
        <div className="planned-mutations">
          <b>Modifiche pianificate</b>
          <pre>{JSON.stringify(document.plannedMutations, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
