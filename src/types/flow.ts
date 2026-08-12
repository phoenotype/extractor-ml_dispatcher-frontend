export type FlowNodeType = string;
export type Branch = string;
export type Operator = string;
export type FlowFormat = "visual_v1" | "legacy";

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

/** Voce lista flussi (GET /flows). */
export interface FlowListItem {
  flowName: string;
  /** Alias opzionale; preferire sempre flowName. */
  name?: string;
  description?: string;
  documentType?: string;
  isActive: boolean;
  format: FlowFormat;
  editable: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  /** Concurrency token: tipicamente updatedAt dell'ultima lettura. */
  expectedUpdatedAt?: string;
  schemaVersion?: number;
  flowDefinition?: FlowDefinition | Record<string, unknown>;
  definition?: FlowDefinition | Record<string, unknown>;
}

export interface FlowDetail extends FlowListItem {
  flowDefinition: FlowDefinition | Record<string, unknown>;
}

export interface ValidationIssue {
  message: string;
  nodeId?: string;
  path?: string;
  code?: string;
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

export interface SimulationRequest {
  flowName: string;
  protocol?: number;
  batchSize?: number;
}

export interface RunRequest {
  flowName: string;
  batchSize: number;
  dryRun: boolean;
}

export interface RunResult {
  [key: string]: unknown;
}

export type Role = "viewer" | "editor" | "operator";
