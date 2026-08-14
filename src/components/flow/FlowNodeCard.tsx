import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  formatTriggerSummary,
  nodeVisual,
  type FlowNodeData,
} from "@/features/flows/flow-utils";

export function FlowNodeCard({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const def = data.definition;
  const catalogDefinition = data.catalogDefinition;
  const meta = nodeVisual(catalogDefinition);
  const Icon = meta.icon;
  const detail =
    def.type === "trigger.export_status"
      ? formatTriggerSummary(def.config)
      : def.type === "condition"
        ? `${String(def.config.field || "Campo")} · ${String(def.config.operator || "eq")}`
        : def.type === "action.update_export_status"
          ? `Nuovo stato: ${String(def.config.exportStatus ?? "—")}`
          : def.type === "action.http_request"
            ? `${String(def.config.method || "POST")} ${String(def.config.connectionRef || "—")}${String(def.config.path || "")}`
            : "Nessuna modifica";

  return (
    <div
      className={`flow-node ${meta.color} ${selected ? "selected" : ""} ${data.traced ? "traced" : ""} ${data.issue ? "issue" : ""} ${data.dimmed ? "dimmed" : ""}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-icon">
        <Icon size={17} />
      </div>
      <div className="node-copy">
        <span>{catalogDefinition.label}</span>
        <strong>{def.name}</strong>
        <small className={def.type === "trigger.export_status" ? "multiline" : undefined}>
          {detail}
        </small>
      </div>
      {catalogDefinition.outputs.map((output, index) => (
        <div key={output}>
          <Handle
            id={output === "always" ? undefined : output}
            type="source"
            position={Position.Right}
            style={{
              top: `${((index + 1) / (catalogDefinition.outputs.length + 1)) * 100}%`,
              background:
                output === "true"
                  ? "#17a673"
                  : output === "false"
                    ? "#c04545"
                    : "#84909f",
            }}
          />
          {output !== "always" && (
            <i
              className={`port-label ${output}`}
              style={{
                top: `${((index + 1) / (catalogDefinition.outputs.length + 1)) * 100 - 6}%`,
              }}
            >
              {output.toUpperCase()}
            </i>
          )}
        </div>
      ))}
      {data.issue ? <span className="node-error">!</span> : null}
    </div>
  );
}
