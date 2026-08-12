export type FlowNodeType = string;
export type Branch = string;
export type Operator = string;
export interface FlowNodeDefinition {
  id: string;
  type: FlowNodeType;
  name: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
}
export interface FlowEdgeDefinition {
  source: string;
  target: string;
  branch: Branch;
}
export interface FlowDefinition {
  schemaVersion: 1;
  flowName: string;
  nodes: FlowNodeDefinition[];
  edges: FlowEdgeDefinition[];
  settings: { requiresExplicitOptIn: boolean };
}
export interface FlowSummary {
  flowName: string;
  active: boolean;
  documentType: string;
  updatedAt: string;
  schemaVersion?: number;
  definition?: FlowDefinition | Record<string, unknown>;
}
export interface ValidationIssue {
  message: string;
  nodeId?: string;
}
export interface ValidationResult {
  valid: boolean;
  flowName?: string;
  nodes?: number;
  edges?: number;
  issues?: ValidationIssue[];
}
export interface TraceStep {
  nodeId?: string;
  node?: string;
  branch?: Branch;
  result?: boolean;
  conditionResult?: boolean;
  [key: string]: unknown;
}
export interface SimulationDocument {
  protocol?: number;
  trace?: TraceStep[];
  plannedMutations?: Array<Record<string, unknown>>;
  sourceExportStatus?: number;
  stopped?: boolean;
  databaseWrites?: number;
}
export interface SimulationResult extends SimulationDocument {
  documents?: SimulationDocument[];
  count?: number;
}
export type Role = "viewer" | "editor" | "operator";
export type CatalogFieldType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "enum"
  | "any";
export interface CatalogConfigField {
  type: CatalogFieldType;
  items?: CatalogFieldType;
  values?: Array<string | number | boolean>;
  required?: boolean;
  requiredExceptFor?: string[];
  source?: "documentFields" | "exportStatuses";
  label?: string;
}
export interface CatalogNodeType {
  type: string;
  category: string;
  label: string;
  description: string;
  configSchema: Record<string, CatalogConfigField>;
  outputs: string[];
}
export interface CatalogDocumentField {
  path: string;
  label: string;
  dataType: "string" | "number" | "boolean" | "array";
}
export interface CatalogExportStatus {
  value: number;
  label: string;
}
export interface Catalog {
  schemaVersion: number;
  nodeTypes: CatalogNodeType[];
  documentFields: CatalogDocumentField[];
  exportStatuses: CatalogExportStatus[];
}
