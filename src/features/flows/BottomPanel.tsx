import {
  Activity,
  Braces,
  Check,
  ChevronDown,
  Play,
  RefreshCw,
  History,
  ShieldCheck,
  X,
} from "lucide-react";
import type {
  SimulationDocument,
  ValidationResult,
  DispatcherRun,
  ScheduledRun,
} from "@/types/flow";
import { SimulationTraceView } from "@/features/simulation/SimulationTraceView";
import { JsonSyncPanel } from "@/features/flows/JsonSyncPanel";

export type BottomTab = "validation" | "simulation" | "runs" | "json";

interface BottomPanelProps {
  open: boolean;
  tab: BottomTab;
  onToggle: () => void;
  onTabChange: (tab: BottomTab) => void;
  validation: ValidationResult | null;
  validationLoading: boolean;
  onValidationIssueSelect?: (nodeId: string) => void;
  simulationDocs: SimulationDocument[];
  simulationCount?: number | null;
  simulationIndex: number;
  onSimulationIndexChange: (index: number) => void;
  simulationLoading: boolean;
  runs: DispatcherRun[];
  scheduledRuns: ScheduledRun[];
  runsLoading: boolean;
  onRefreshRuns: () => void;
  triggerSummary?: string | null;
  jsonDraft: string;
  jsonError: string | null;
  onJsonChange: (value: string) => void;
  onApplyJson: () => void;
  readOnly?: boolean;
}

export function BottomPanel({
  open,
  tab,
  onToggle,
  onTabChange,
  validation,
  validationLoading,
  onValidationIssueSelect,
  simulationDocs,
  simulationCount = null,
  simulationIndex,
  onSimulationIndexChange,
  simulationLoading,
  runs,
  scheduledRuns,
  runsLoading,
  onRefreshRuns,
  triggerSummary = null,
  jsonDraft,
  jsonError,
  onJsonChange,
  onApplyJson,
  readOnly,
}: BottomPanelProps) {
  return (
    <>
      <button
        type="button"
        className={`bottom-toggle ${open ? "open" : ""}`}
        onClick={onToggle}
      >
        <Activity size={15} /> Risultati <ChevronDown size={15} />
      </button>
      {open ? (
        <section className="bottom-panel">
          <div className="bottom-tabs">
            <button
              type="button"
              className={tab === "runs" ? "active" : ""}
              onClick={() => { onTabChange("runs"); onRefreshRuns(); }}
            >
              <History size={15} /> Ultime esecuzioni
            </button>
            <button
              type="button"
              className={tab === "validation" ? "active" : ""}
              onClick={() => onTabChange("validation")}
            >
              <ShieldCheck size={15} /> Validazione{" "}
              {validation ? (
                <i className={validation.valid ? "ok" : "bad"} />
              ) : null}
            </button>
            <button
              type="button"
              className={tab === "simulation" ? "active" : ""}
              onClick={() => onTabChange("simulation")}
            >
              <Play size={15} /> Simulazione
            </button>
            <button
              type="button"
              className={tab === "json" ? "active" : ""}
              onClick={() => onTabChange("json")}
            >
              <Braces size={15} /> JSON
            </button>
            <button
              type="button"
              className="close-bottom"
              onClick={onToggle}
            >
              <X size={16} />
            </button>
          </div>
          <div className="bottom-content">
            {tab === "validation" ? (
              <ValidationPanel
                result={validation}
                loading={validationLoading}
                onIssueSelect={onValidationIssueSelect}
              />
            ) : null}
            {tab === "simulation" ? (
              <SimulationTraceView
                documents={simulationDocs}
                count={simulationCount}
                index={simulationIndex}
                onIndexChange={onSimulationIndexChange}
                loading={simulationLoading}
                triggerSummary={triggerSummary}
              />
            ) : null}
            {tab === "json" ? (
              <JsonSyncPanel
                value={jsonDraft}
                error={jsonError}
                readOnly={readOnly}
                onChange={onJsonChange}
                onApply={onApplyJson}
              />
            ) : null}
            {tab === "runs" ? (
              <RunHistoryPanel runs={runs} scheduledRuns={scheduledRuns} loading={runsLoading} onRefresh={onRefreshRuns} />
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function RunHistoryPanel({ runs, scheduledRuns, loading, onRefresh }: {
  runs: DispatcherRun[]; scheduledRuns: ScheduledRun[]; loading: boolean; onRefresh: () => void;
}) {
  return <div className="run-history">
    <div className="run-history-head"><b>Ultime esecuzioni</b><button type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""} /> Aggiorna</button></div>
    <div className="run-history-grid">
      <section><h4>Documenti</h4>{runs.length ? runs.map((run, index) => <div className="run-history-row" key={`${run.startedAt}-${run.protocol}-${index}`}><code>{run.protocol}</code><span>{run.sourceExportStatus} → {run.targetExportStatus ?? "—"}</span><b className={`run-status ${run.status}`}>{run.status}</b><time>{new Date(run.startedAt).toLocaleString("it-IT")}</time>{run.errorDetail?.message ? <p>{run.errorDetail.message}</p> : null}</div>) : <p>Nessuna esecuzione documento registrata.</p>}</section>
      <section><h4>Scheduler</h4>{scheduledRuns.length ? scheduledRuns.map((run) => <div className="run-history-row" key={run.scheduledFor}><code>{new Date(run.scheduledFor).toLocaleString("it-IT")}</code><b className={`run-status ${run.status}`}>{run.status}</b><span>Trovati: {String(run.executionResult?.found ?? "—")} · Completati: {String(run.executionResult?.completed ?? "—")} · Falliti: {String(run.executionResult?.failed ?? "—")}</span></div>) : <p>Nessuna esecuzione schedulata registrata.</p>}</section>
    </div>
  </div>;
}

function ValidationPanel({
  result,
  loading,
  onIssueSelect,
}: {
  result: ValidationResult | null;
  loading: boolean;
  onIssueSelect?: (nodeId: string) => void;
}) {
  if (loading) {
    return (
      <div className="result-empty">
        <RefreshCw className="spin" />
        <b>Validazione in corso…</b>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="result-empty">
        <ShieldCheck size={25} />
        <b>Il flusso non è ancora stato validato</b>
        <span>Usa “Valida” per inviare la definizione al backend.</span>
      </div>
    );
  }
  return result.valid ? (
    <div className="valid-result">
      <span>
        <Check size={19} />
      </span>
      <div>
        <b>Flusso valido</b>
        <p>
          {result.nodes ?? "—"} nodi e {result.edges ?? "—"} collegamenti
          verificati dal backend.
        </p>
      </div>
    </div>
  ) : (
    <div className="issues">
      <b>{result.issues?.length || 1} problemi da risolvere</b>
      {(result.issues || []).map((issue, index) => (
        <button
          key={index}
          type="button"
          disabled={!issue.nodeId || !onIssueSelect}
          onClick={() => issue.nodeId && onIssueSelect?.(issue.nodeId)}
          title={issue.nodeId ? `Apri il nodo ${issue.nodeId}` : undefined}
        >
          <X size={15} />
          <span>{issue.message}</span>
          {issue.nodeId ? <code>{issue.nodeId}</code> : null}
        </button>
      ))}
    </div>
  );
}
