import {
  Activity,
  Braces,
  Check,
  ChevronDown,
  Play,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import type {
  SimulationDocument,
  ValidationResult,
} from "@/types/flow";
import { SimulationTraceView } from "@/features/simulation/SimulationTraceView";
import { JsonSyncPanel } from "@/features/flows/JsonSyncPanel";

export type BottomTab = "validation" | "simulation" | "json";

interface BottomPanelProps {
  open: boolean;
  tab: BottomTab;
  onToggle: () => void;
  onTabChange: (tab: BottomTab) => void;
  validation: ValidationResult | null;
  validationLoading: boolean;
  simulationDocs: SimulationDocument[];
  simulationCount?: number | null;
  simulationIndex: number;
  onSimulationIndexChange: (index: number) => void;
  simulationLoading: boolean;
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
  simulationDocs,
  simulationCount = null,
  simulationIndex,
  onSimulationIndexChange,
  simulationLoading,
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
              />
            ) : null}
            {tab === "simulation" ? (
              <SimulationTraceView
                documents={simulationDocs}
                count={simulationCount}
                index={simulationIndex}
                onIndexChange={onSimulationIndexChange}
                loading={simulationLoading}
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
          </div>
        </section>
      ) : null}
    </>
  );
}

function ValidationPanel({
  result,
  loading,
}: {
  result: ValidationResult | null;
  loading: boolean;
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
        <div key={index}>
          <X size={15} />
          <span>{issue.message}</span>
          {issue.nodeId ? <code>{issue.nodeId}</code> : null}
        </div>
      ))}
    </div>
  );
}
