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
  HttpExecution,
  SimulationDocument,
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

function json(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function resultLabel(step: TraceStep): string {
  const value = step.conditionResult ?? step.result;
  if (value === true || value === "true") return "vero";
  if (value === false || value === "false") return "falso";
  if (value === "not_reached") return "non raggiunto";
  return value == null ? "—" : String(value);
}

function httpExecution(step: TraceStep): HttpExecution | undefined {
  return step.nodeType === "action.http_request"
    ? step.details?.httpExecution
    : undefined;
}

function httpTone(step: TraceStep): string {
  if (step.nodeType !== "action.http_request") return "";
  const execution = httpExecution(step);
  if (execution?.status === "completed") return "http-completed";
  if (execution?.status === "failed") return "http-failed";
  return "http-planned";
}

function httpLabel(step: TraceStep): string {
  const execution = httpExecution(step);
  if (execution?.status === "completed") return "HTTP eseguito";
  if (execution?.status === "failed") return "HTTP fallito";
  return "HTTP pianificato";
}

function externalSummary(document: SimulationDocument) {
  const trace = document.trace || [];
  const executions = trace
    .map(httpExecution)
    .filter((value): value is HttpExecution => Boolean(value));
  const externalRequests = document.externalRequests || [];
  const failed = [
    ...executions
      .filter((execution) => execution.status === "failed")
      .map((execution) => execution.error || "Errore HTTP"),
    ...externalRequests
      .filter((request) => request.status === "failed")
      .map((request) => request.error || "Errore HTTP"),
  ];
  const completedFromTrace = executions.filter(
    (execution) => execution.status === "completed",
  ).length;
  const completedFromRequests = externalRequests.filter(
    (request) => request.status === "completed",
  ).length;
  const attempted =
    document.externalCallsAttempted ??
    Math.max(executions.length, externalRequests.length);
  const succeeded =
    document.externalCallsSucceeded ??
    Math.max(completedFromTrace, completedFromRequests);
  const planned = trace.filter(
    (step) =>
      step.nodeType === "action.http_request" &&
      step.status !== "skipped" &&
      !httpExecution(step),
  ).length;
  return { attempted, succeeded, planned, failed };
}

function NodeTraceCard({ step, index }: { step: TraceStep; index: number }) {
  const skipped = step.status === "skipped";
  const isHttp = step.nodeType === "action.http_request";
  const execution = httpExecution(step);
  const tone = httpTone(step);

  return (
    <article className={`trace-node-card ${tone} ${skipped ? "is-skipped" : ""}`}>
      <div className={`trace-step ${skipped ? "skipped" : "executed"}`}>
        <i>{index + 1}</i>
        <span>
          <strong>{step.nodeId || step.node || "Nodo"}</strong>
          <small>Tipo: {step.nodeType || "—"}</small>
          <small>Status: {step.status || "executed"}</small>
          <small>Result: {resultLabel(step)}</small>
          {skipped && typeof step.details?.reason === "string" ? (
            <small>Motivo: {step.details.reason}</small>
          ) : null}
        </span>
        <em className={tone || (skipped ? "skipped" : "executed")}>
          {isHttp ? httpLabel(step) : step.status || "executed"}
        </em>
      </div>

      {!skipped ? (
        <div className="trace-io">
          <details>
            <summary>Input</summary>
            <pre>{json(step.input)}</pre>
          </details>
          <details open={isHttp}>
            <summary>Output</summary>
            <pre>{json(isHttp ? execution : step.output)}</pre>
          </details>
        </div>
      ) : null}
    </article>
  );
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

  if (count === 0 && documents.length === 0) {
    return (
      <div className="result-empty">
        <Play size={25} />
        <b>Nessun documento trovato</b>
        <span>Nessun documento soddisfa i criteri del trigger.</span>
      </div>
    );
  }

  const document = documents[index];
  if (!document) {
    return (
      <div className="result-empty">
        <Play size={25} />
        <b>Nessuna simulazione disponibile</b>
        <span>Avvia una simulazione per vedere la traccia dettagliata.</span>
      </div>
    );
  }

  const trace = document.trace || [];
  const external = externalSummary(document);
  const stoppedReason =
    document.stopReason ||
    (document.stopped
      ? trace.find((step) => step.status === "skipped")?.details?.reason
      : undefined);
  const mutations = Array.isArray(document.plannedMutations)
    ? document.plannedMutations
    : document.plannedMutations && Object.keys(document.plannedMutations).length
      ? [document.plannedMutations]
      : [];

  return (
    <div className="simulation-result simulation-result-detailed">
      {documents.length > 1 ? (
        <div className="doc-switcher">
          <label>
            Documento
            <select value={index} onChange={(event) => onIndexChange(Number(event.target.value))}>
              {documents.map((item, itemIndex) => (
                <option key={itemIndex} value={itemIndex}>
                  #{itemIndex + 1}{item.protocol != null ? ` · protocollo ${item.protocol}` : ""}
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

      <div className="simulation-outcome-grid">
        <div className="safety-result">
          <ShieldCheck size={18} />
          <div>
            <b>Nessuna scrittura sul database</b>
            <small>Scritture rilevate: {document.databaseWrites ?? 0}</small>
          </div>
        </div>

        {external.failed.length > 0 || external.attempted > external.succeeded ? (
          <div className="sim-alert error">
            <XCircle size={18} />
            <div>
              <b>Chiamata HTTP fallita</b>
              <small>
                {external.failed.length
                  ? external.failed.join(" · ")
                  : `${external.attempted - external.succeeded} chiamate non riuscite`}
              </small>
            </div>
          </div>
        ) : external.attempted > 0 ? (
          <div className="sim-alert success">
            <CheckCircle2 size={18} />
            <div>
              <b>Chiamata HTTP realmente eseguita</b>
              <small>{external.succeeded} di {external.attempted} chiamate riuscite</small>
            </div>
          </div>
        ) : external.planned > 0 || document.plannedExternalRequests ? (
          <div className="sim-alert warn">
            <AlertTriangle size={18} />
            <div><b>Chiamata HTTP solamente pianificata</b><small>Nessuna richiesta esterna è stata eseguita.</small></div>
          </div>
        ) : (
          <div className="sim-alert info">
            <CircleOff size={18} />
            <div><b>Nessuna chiamata HTTP</b><small>Nessun nodo HTTP raggiunto.</small></div>
          </div>
        )}
      </div>

      {stoppedReason ? (
        <div className="sim-alert info">
          <CircleOff size={18} />
          <div><b>Flusso interrotto</b><small>{String(stoppedReason)}</small></div>
        </div>
      ) : null}

      <section className="trace detailed-trace">
        <b>Traccia ordinata dei nodi</b>
        {trace.length ? (
          trace.map((step, stepIndex) => (
            <NodeTraceCard
              key={`${step.nodeId || step.node || "node"}-${stepIndex}`}
              step={step}
              index={stepIndex}
            />
          ))
        ) : (
          <div className="trace-empty">Nessun nodo presente nella traccia</div>
        )}
      </section>

      <div className="planned-mutations">
        <b>{mutations.length ? "Modifiche pianificate" : "Nessuna modifica pianificata"}</b>
        {mutations.length ? <pre>{json(mutations)}</pre> : null}
      </div>
    </div>
  );
}
