import type { Edge, Node } from "@xyflow/react";
import type { Catalog, CatalogConfigField, CatalogNodeType } from "@/types/catalog";
import type { HttpConnection } from "@/types/connection";
import type {
  FlowDefinition,
  FlowNodeDefinition,
  ValidationIssue,
} from "@/types/flow";
import {
  containsEmbeddedSecret,
  sanitizeHttpRequestConfig,
  validateHttpRequestConfig,
} from "@/features/connections/http-config";
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

export function removeFlowNodes(
  flow: FlowDefinition,
  nodeIds: Set<string>,
  catalog: Catalog,
): FlowDefinition {
  const removable = new Set(
    flow.nodes
      .filter(
        (node) =>
          nodeIds.has(node.id) && catalogNode(catalog, node.type).category !== "trigger",
      )
      .map((node) => node.id),
  );
  if (!removable.size) return cloneFlow(flow);
  const next = cloneFlow(flow);
  next.nodes = next.nodes.filter((node) => !removable.has(node.id));
  next.edges = next.edges.filter(
    (edge) => !removable.has(edge.source) && !removable.has(edge.target),
  );
  return next;
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

/** Normalizza definizioni backend incomplete (es. edge senza branch). */
export function normalizeFlowDefinition(
  definition: FlowDefinition | Record<string, unknown>,
  fallbackName?: string,
): FlowDefinition {
  if (!isVisualFlow(definition)) {
    throw new Error("Definizione flusso non visual_v1");
  }
  const settings =
    definition.settings && typeof definition.settings === "object"
      ? {
          requiresExplicitOptIn: Boolean(
            (definition.settings as { requiresExplicitOptIn?: unknown })
              .requiresExplicitOptIn,
          ),
        }
      : { requiresExplicitOptIn: true };

  return {
    schemaVersion: 1,
    flowName:
      typeof definition.flowName === "string" && definition.flowName
        ? definition.flowName
        : fallbackName || "flusso",
    nodes: definition.nodes.map((node) => {
      const config =
        node.config && typeof node.config === "object"
          ? { ...(node.config as Record<string, unknown>) }
          : {};
      const sanitized = sanitizeDocumentTypes(config.documentTypes);
      if (sanitized) config.documentTypes = sanitized;
      else delete config.documentTypes;
      if (node.type === "action.http_request") {
        const httpConfig = sanitizeHttpRequestConfig(config);
        return {
          id: node.id,
          type: node.type,
          name: node.name,
          config: httpConfig,
          position: node.position,
        };
      }
      return {
        id: node.id,
        type: node.type,
        name: node.name,
        config,
        position: node.position,
      };
    }),
    edges: definition.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      branch: edge.branch || "always",
    })),
    settings,
  };
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
  fieldKey?: string,
): unknown {
  const key = fieldKey || "";
  if (field.type === "code" && field.language === "python") {
    return 'result = {\n  "protocol": document["protocol"]\n}';
  }
  if (field.source === "exportStatuses" || key === "exportStatuses") {
    return field.type === "array"
      ? [catalog.exportStatuses[0]?.value].filter((value) => value !== undefined)
      : catalog.exportStatuses[0]?.value;
  }
  if (field.source === "documentFields") {
    return catalog.documentFields[0]?.path || "";
  }
  // Optional HTTP / documentTypes fields: omit so empty optionals stay out of JSON.
  if (key === "documentTypes" || key === "timeoutSeconds" || key === "headers" || key === "body") {
    return undefined;
  }
  if (!field.required) {
    return undefined;
  }
  if (key === "path") return "/";
  if (key === "successStatusCodes") return [200];
  if (key === "method" && field.type === "enum") return field.values?.[0] ?? "POST";
  if (key === "connectionRef") return "";
  if (field.type === "array" && field.items === "string" && !field.required) {
    return undefined;
  }
  if (field.type === "enum") return field.values?.[0];
  if (field.type === "array") return [];
  if (field.type === "number") return 0;
  if (field.type === "boolean") return false;
  return "";
}

/** Deduplica tipi documento (case-insensitive) e rimuove vuoti/spazi. */
export function sanitizeDocumentTypes(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result.length ? result : undefined;
}

function formatSummaryList(values: string[], maxVisible = 2): string {
  if (!values.length) return "—";
  if (values.length <= maxVisible) return values.join(", ");
  return `${values.slice(0, maxVisible).join(", ")} +${values.length - maxVisible}`;
}

export function formatTriggerSummary(config: Record<string, unknown>): string {
  const statuses = Array.isArray(config.exportStatuses)
    ? config.exportStatuses.map(String)
    : [];
  const types = sanitizeDocumentTypes(config.documentTypes);
  const statusLine = `Stati: ${statuses.length ? formatSummaryList(statuses) : "—"}`;
  const typesLine = `Tipi: ${types?.length ? formatSummaryList(types) : "Tutti"}`;
  return `${statusLine}\n${typesLine}`;
}

/** Riepilogo criteri trigger per la barra flusso. */
export function getFlowTriggerSummary(
  flow: FlowDefinition,
): { statusLine: string; typesLine: string } | null {
  const trigger = flow.nodes.find((node) =>
    node.type === "trigger.export_status" || node.type.startsWith("trigger."),
  );
  if (!trigger) return null;
  const lines = formatTriggerSummary(trigger.config).split("\n");
  return {
    statusLine: lines[0] || "Stati: —",
    typesLine: lines[1] || "Tipi: Tutti",
  };
}

/**
 * Garantisce che il configSchema del trigger esponga sempre documentTypes
 * anche se il catalogo remoto è incompleto.
 */
export function ensureTriggerConfigSchema(
  definition: CatalogNodeType,
): CatalogNodeType {
  if (definition.type !== "trigger.export_status") return definition;
  const schema = { ...definition.configSchema };
  if (!schema.exportStatuses) {
    schema.exportStatuses = {
      type: "array",
      items: "number",
      required: true,
      source: "exportStatuses",
      label: "Stati di esportazione",
    };
  } else {
    schema.exportStatuses = {
      ...schema.exportStatuses,
      label: schema.exportStatuses.label || "Stati di esportazione",
    };
  }
  if (!schema.documentTypes) {
    schema.documentTypes = {
      type: "array",
      items: "string",
      required: false,
      label: "Tipi documento ammessi",
      description:
        "Se non selezioni alcun tipo, il trigger considera tutti i tipi documento.",
    };
  } else {
    schema.documentTypes = {
      ...schema.documentTypes,
      label: "Tipi documento ammessi",
      description:
        schema.documentTypes.description ||
        "Se non selezioni alcun tipo, il trigger considera tutti i tipi documento.",
    };
  }
  return { ...definition, configSchema: schema };
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
    const branch = edge.branch || "always";
    const branchColor =
      branch === "true"
        ? "#11835b"
        : branch === "false"
          ? "#c04545"
          : "#6a7482";
    return {
      id,
      source: edge.source,
      target: edge.target,
      sourceHandle: branch === "always" ? undefined : branch,
      label: branch === "always" ? undefined : branch.toUpperCase(),
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
  connections: HttpConnection[] = [],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const node of flow.nodes) {
    if (ids.has(node.id)) duplicateIds.add(node.id);
    ids.add(node.id);
  }
  duplicateIds.forEach((nodeId) =>
    issues.push({ nodeId, message: `ID nodo duplicato: ${nodeId}` }),
  );
  for (const edge of flow.edges) {
    if (!ids.has(edge.source)) {
      issues.push({ message: `Collegamento con sorgente inesistente: ${edge.source}` });
    }
    if (!ids.has(edge.target)) {
      issues.push({ message: `Collegamento con destinazione inesistente: ${edge.target}` });
    }
  }
  if (containsEmbeddedSecret(flow)) {
    issues.push({
      message:
        "Il JSON del flusso non può contenere segreti: usa una connessione configurata tramite variabili d'ambiente",
    });
  }
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
    if (
      node.position !== undefined &&
      (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y))
    ) {
      issues.push({
        nodeId: node.id,
        message: "Le coordinate del nodo devono essere numeriche",
      });
    }

    const ancestors = new Set<string>();
    const visit = (target: string) => {
      flow.edges
        .filter((edge) => edge.target === target)
        .forEach((edge) => {
          if (ancestors.has(edge.source)) return;
          ancestors.add(edge.source);
          visit(edge.source);
        });
    };
    visit(node.id);
    const inspectReferences = (value: unknown) => {
      if (typeof value === "string") {
        for (const match of value.matchAll(/nodes\.([A-Za-z0-9_-]+)\./g)) {
          const referenced = match[1];
          if (!ids.has(referenced)) {
            issues.push({ nodeId: node.id, message: `Riferimento a nodo inesistente: ${referenced}` });
          } else if (!ancestors.has(referenced)) {
            issues.push({ nodeId: node.id, message: `Il nodo ${referenced} non precede ${node.id}` });
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach(inspectReferences);
      } else if (value && typeof value === "object") {
        Object.values(value as Record<string, unknown>).forEach(inspectReferences);
      }
    };
    inspectReferences(node.config);

    const definition = catalog.nodeTypes.find((item) => item.type === node.type);
    if (!definition) {
      issues.push({
        nodeId: node.id,
        message: `Tipo di nodo non presente nel catalogo: ${node.type}`,
      });
      continue;
    }

    if (node.type === "action.http_request") {
      for (const message of validateHttpRequestConfig(
        node.config || {},
        connections,
      )) {
        issues.push({ nodeId: node.id, message });
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

      if (key === "documentTypes" && value !== undefined && value !== null) {
        if (!Array.isArray(value)) {
          issues.push({
            nodeId: node.id,
            message: `${definition.label}: documentTypes deve essere un array di stringhe`,
          });
        } else if (value.length === 0) {
          issues.push({
            nodeId: node.id,
            message: `${definition.label}: documentTypes non può essere un array vuoto — ometti la proprietà per accettare tutti i tipi`,
          });
        } else if (
          value.some(
            (item) => typeof item !== "string" || !String(item).trim(),
          )
        ) {
          issues.push({
            nodeId: node.id,
            message: `${definition.label}: ogni documentType deve essere una stringa non vuota`,
          });
        }
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
