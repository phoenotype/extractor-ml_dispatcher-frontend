import type { Edge, Node } from "@xyflow/react";
import type { Catalog, CatalogConfigField, CatalogNodeType } from "@/types/catalog";
import type {
  FlowDefinition,
  FlowNodeDefinition,
  ValidationIssue,
} from "@/types/flow";
import {
  CircleStop,
  GitBranch,
  RefreshCw,
  Settings2,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type FlowNodeData = {
  definition: FlowNodeDefinition;
  catalogDefinition: CatalogNodeType;
  traced?: boolean;
  issue?: boolean;
  dimmed?: boolean;
};

export const CATEGORY_META: Record<
  string,
  { icon: LucideIcon; color: string }
> = {
  trigger: { icon: Zap, color: "violet" },
  logic: { icon: GitBranch, color: "amber" },
  action: { icon: RefreshCw, color: "blue" },
  control: { icon: CircleStop, color: "slate" },
};

export function cloneFlow(flow: FlowDefinition): FlowDefinition {
  return structuredClone(flow);
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function catalogNode(catalog: Catalog, type: string): CatalogNodeType {
  return (
    catalog.nodeTypes.find((item) => item.type === type) || {
      type,
      category: "action",
      label: type,
      description: "Nodo configurabile",
      configSchema: {},
      outputs: ["always"],
    }
  );
}

export function nodeVisual(definition: CatalogNodeType) {
  return CATEGORY_META[definition.category] || { icon: Settings2, color: "slate" };
}

export function isVisualFlow(
  definition: unknown,
): definition is FlowDefinition {
  return (
    !!definition &&
    typeof definition === "object" &&
    "schemaVersion" in definition &&
    (definition as FlowDefinition).schemaVersion === 1 &&
    Array.isArray((definition as FlowDefinition).nodes) &&
    Array.isArray((definition as FlowDefinition).edges)
  );
}

export function parseCatalogValue(
  value: string,
  field: CatalogConfigField,
): unknown {
  if (field.type === "number") return value === "" ? undefined : Number(value);
  if (field.type === "boolean") return value === "true";
  if (field.type === "array") {
    return value
      .split(",")
      .map((item) =>
        field.items === "number" ? Number(item.trim()) : item.trim(),
      )
      .filter((item) => item !== "" && !Number.isNaN(item));
  }
  if (field.type === "any") {
    if (value === "true" || value === "false") return value === "true";
    if (value !== "" && Number.isFinite(Number(value))) return Number(value);
    if (value.includes(",")) return value.split(",").map((item) => item.trim());
  }
  return value;
}

export function defaultFieldValue(
  field: CatalogConfigField,
  catalog: Catalog,
): unknown {
  if (field.source === "exportStatuses") {
    return field.type === "array"
      ? [catalog.exportStatuses[0]?.value].filter((value) => value !== undefined)
      : catalog.exportStatuses[0]?.value;
  }
  if (field.source === "documentFields") {
    return catalog.documentFields[0]?.path || "";
  }
  if (field.type === "enum") return field.values?.[0];
  if (field.type === "array") return [];
  if (field.type === "number") return 0;
  if (field.type === "boolean") return false;
  return "";
}

export function toFlowNodes(
  flow: FlowDefinition,
  catalog: Catalog,
  traced = new Set<string>(),
  issues = new Set<string>(),
  dimmed = new Set<string>(),
): Node<FlowNodeData>[] {
  return flow.nodes.map((item, index) => ({
    id: item.id,
    type: "flowNode",
    position: item.position || { x: 80 + index * 280, y: 180 },
    data: {
      definition: item,
      catalogDefinition: catalogNode(catalog, item.type),
      traced: traced.has(item.id),
      issue: issues.has(item.id),
      dimmed: dimmed.has(item.id),
    },
  }));
}

export function toFlowEdges(
  flow: FlowDefinition,
  traced = new Set<string>(),
  options?: { grayInactive?: boolean },
): Edge[] {
  return flow.edges.map((edge, index) => {
    const id = `${edge.source}-${edge.target}-${index}`;
    const active = traced.has(id);
    const grayInactive = options?.grayInactive && traced.size > 0 && !active;
    const branchColor =
      edge.branch === "true"
        ? "#11835b"
        : edge.branch === "false"
          ? "#c04545"
          : "#6a7482";
    return {
      id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.branch === "always" ? undefined : edge.branch,
      label: edge.branch === "always" ? undefined : edge.branch.toUpperCase(),
      animated: active,
      style: {
        stroke: active ? "#17a673" : grayInactive ? "#c5ccd4" : branchColor,
        strokeWidth: active ? 3 : 1.8,
        opacity: grayInactive ? 0.45 : 1,
      },
      labelStyle: {
        fill: branchColor,
        fontWeight: 700,
        fontSize: 10,
      },
    };
  });
}

export function preliminaryValidate(
  flow: FlowDefinition,
  catalog: Catalog,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const triggers = flow.nodes.filter(
    (node) => catalogNode(catalog, node.type).category === "trigger",
  );
  if (triggers.length === 0) {
    issues.push({ message: "Il flusso deve avere un nodo trigger" });
  }
  if (triggers.length > 1) {
    issues.push({ message: "Il flusso può avere un solo nodo trigger" });
  }

  for (const node of flow.nodes) {
    const definition = catalog.nodeTypes.find((item) => item.type === node.type);
    if (!definition) {
      issues.push({
        nodeId: node.id,
        message: `Tipo di nodo non presente nel catalogo: ${node.type}`,
      });
      continue;
    }
    for (const [key, field] of Object.entries(definition.configSchema)) {
      const value = node.config[key];
      const exempt = field.requiredExceptFor?.includes(
        String(node.config.operator),
      );
      if (
        (field.required || field.requiredExceptFor) &&
        !exempt &&
        (value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0))
      ) {
        issues.push({
          nodeId: node.id,
          message: `${definition.label}: il campo ${field.label || key} è obbligatorio`,
        });
      }
    }
    const allowedOutputs = new Set(definition.outputs);
    flow.edges
      .filter((edge) => edge.source === node.id)
      .forEach((edge) => {
        if (!allowedOutputs.has(edge.branch)) {
          issues.push({
            nodeId: node.id,
            message: `Collegamento ${edge.branch} non supportato da ${definition.label}`,
          });
        }
      });
  }
  return issues;
}

export function formatItalianDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function createBlankFlow(flowName: string): FlowDefinition {
  return {
    schemaVersion: 1,
    flowName,
    nodes: [],
    edges: [],
    settings: { requiresExplicitOptIn: true },
  };
}
