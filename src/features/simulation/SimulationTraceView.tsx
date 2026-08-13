import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Play,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type {
  SimulationDocument,
  TraceCheck,
  TraceStep,
} from "@/types/flow";

interface SimulationTraceViewProps {
  documents: SimulationDocument[];
  count?: number | null;
  index: number;
  onIndexChange: (index: number) => void;
  loading?: boolean;
  triggerSummary?: string | null;
}

function asMutationList(
  value: SimulationDocument["plannedMutations"] | TraceStep["plannedMutations"],
): Array<Record<string, unknown>> {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && Object.keys(value).length === 0) return [];
  return [value as Record<string, unknown>];
}

function criterionLabel(criterion: string): string {
  switch (criterion) {
    case "exportStatus":
      return "Stato di esportazione";
    case "documentType":
      return "Tipo documento";
    case "companyModuleEnabled":
      return "Abilitazione aziendale";
    default:
      return criterion;
  }
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "vero" : "falso";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function stepResultLabel(step: TraceStep): string {
  if (typeof step.conditionResult === "boolean") {
    return step.conditionResult ? "vera" : "falsa";
  }
  if (typeof step.result === "boolean") {
    return step.result ? "vero" : "falso";
  }
  if (typeof step.result === "string") {
    if (step.result === "not_reached") return "non raggiunto";
    if (step.result === "true") return "vero";
    if (step.result === "false") return "falso";
    return step.result;
  }
  return "";
}

function isTriggerFailed(document: SimulationDocument): boolean {
  const trigger = (document.trace || []).find(
    (step) =>
      step.nodeType === "trigger.export_status" ||
      String(step.nodeId || "").includes("validation") ||
      Array.isArray(step.details?.checks),
  );
  if (!trigger) return false;
  if (trigger.result === false || trigger.result === "false") return true;
  return Boolean(trigger.details?.failedCriteria?.length);
}

function collectChecks(document: SimulationDocument): TraceCheck[] {
  for (const step of document.trace || []) {
    if (step.details?.checks?.length) return step.details.checks;
  }
  return [];
}

function failedCriteria(document: SimulationDocument): string[] {
  for (const step of document.trace || []) {
    if (step.details?.failedCriteria?.length) {
      return step.details.failedCriteria;
    }
  }
  return collectChecks(document)
    .filter((check) => !check.matched)
    .map((check) => check.criterion);
}

function stopMessage(document: SimulationDocument): string | null {
  if (document.stopReason) return document.stopReason;
  const failed = failedCriteria(document);
  if (failed.length) {
    return `Simulazione fermata: criteri non soddisfatti (${failed
      .map(criterionLabel)
      .join(", ")}). Nessuna azione successiva eseguita.`;
  }
  const skipped = (document.trace || []).find(
    (step) =>
      step.status === "skipped" &&
      typeof step.details?.reason === "string" &&
      step.details.reason,
  );
  if (skipped?.details?.reason) return String(skipped.details.reason);
  if (document.stopped) {
    return "La simulazione si è fermata senza produrre azioni.";
  }
  return null;
}

export function SimulationTraceView({
  documents,
  count,
  index,
  onIndexChange,
  loading,
  triggerSummary,
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
        {triggerSummary ? (
          <small className="sim-trigger-summary">{triggerSummary}</small>
        ) : null}
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

  const checks = collectChecks(document);
  const failed = failedCriteria(document);
  const triggerFailed = isTriggerFailed(document);
  const stop = stopMessage(document);
  const mutations = asMutationList(document.plannedMutations);
  const executed = (document.trace || []).filter(
    (step) => !step.status || step.status === "executed",
  );
  const skipped = (document.trace || []).filter(
    (step) => step.status === "skipped",
  );

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

      {triggerSummary ? (
        <div className="sim-criteria-banner">
          <b>Criteri del trigger</b>
          <span>{triggerSummary.replace(/\n/g, " · ")}</span>
        </div>
      ) : null}

      {triggerFailed ? (
        <div className="sim-alert warn">
          <AlertTriangle size={18} />
          <div>
            <b>Il documento non attiva il flusso</b>
            <small>
              Protocollo {document.protocol ?? "—"}
              {document.documentType
                ? ` · tipo osservato: ${document.documentType}`
                : ""}
              {failed.length
                ? ` · falliti: ${failed.map(criterionLabel).join(", ")}`
                : ""}
            </small>
          </div>
        </div>
      ) : (
        <div className="safety-result">
          <ShieldCheck size={18} />
          <div>
            <b>
              {document.databaseWrites === 0
                ? "Nessuna scrittura sul database"
                : `${document.databaseWrites} scritture segnalate`}
            </b>
            <small>
              Simulazione completata · protocollo{" "}
              {document.protocol ?? "campione"}
            </small>
          </div>
        </div>
      )}

      {stop ? (
        <div className="sim-alert info">
          <CircleOff size={18} />
          <div>
            <b>Perché si è fermata</b>
            <small>{stop}</small>
          </div>
        </div>
      ) : null}

      {checks.length > 0 ? (
        <div className="sim-checks">
          <b>Criteri del trigger</b>
          {checks.map((check, checkIndex) => (
            <div
              key={`${check.criterion}-${checkIndex}`}
              className={`sim-check ${check.matched ? "ok" : "ko"}`}
            >
              {check.matched ? (
                <CheckCircle2 size={16} />
              ) : (
                <XCircle size={16} />
              )}
              <div>
                <strong>{criterionLabel(check.criterion)}</strong>
                <small>
                  atteso: {formatValue(check.expected)} · osservato:{" "}
                  {formatValue(check.actual)}
                </small>
              </div>
              <em>{check.matched ? "ok" : "fallito"}</em>
            </div>
          ))}
        </div>
      ) : null}

      <div className="trace">
        <b>Nodi eseguiti</b>
        {executed.length === 0 ? (
          <div className="trace-empty">Nessun nodo eseguito</div>
        ) : (
          executed.map((step, stepIndex) => (
            <div key={`exec-${stepIndex}`} className="trace-step executed">
              <i>{stepIndex + 1}</i>
              <span>
                <strong>{step.nodeId || step.node || "Nodo"}</strong>
                {step.nodeType ? <small>{step.nodeType}</small> : null}
                {stepResultLabel(step) ? (
                  <small>Esito: {stepResultLabel(step)}</small>
                ) : null}
              </span>
              {step.branch ? (
                <em className={String(step.branch)}>{String(step.branch)}</em>
              ) : (
                <em className="executed">eseguito</em>
              )}
            </div>
          ))
        )}
      </div>

      {skipped.length > 0 ? (
        <div className="trace skipped-trace">
          <b>Nodi non raggiunti</b>
          {skipped.map((step, stepIndex) => (
            <div key={`skip-${stepIndex}`} className="trace-step skipped">
              <i>—</i>
              <span>
                <strong>{step.nodeId || step.node || "Nodo"}</strong>
                {step.nodeType ? <small>{step.nodeType}</small> : null}
                {typeof step.details?.reason === "string" ? (
                  <small>{step.details.reason}</small>
                ) : (
                  <small>Non raggiunto dal ramo selezionato</small>
                )}
              </span>
              <em className="skipped">skipped</em>
            </div>
          ))}
        </div>
      ) : null}

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
              mutations[0]?.to ?? mutations[0]?.value ?? "Invariato",
            )}
          </b>
        </span>
      </div>

      {mutations.length > 0 ? (
        <div className="planned-mutations">
          <b>Modifiche pianificate</b>
          <pre>{JSON.stringify(mutations, null, 2)}</pre>
        </div>
      ) : (
        <div className="planned-mutations muted">
          <b>Nessuna modifica pianificata</b>
        </div>
      )}
    </div>
  );
}
