import type { Catalog } from "./catalog";
import type { HttpConnection } from "./connection";
import type {
  FlowDefinition,
  FlowDetail,
  FlowListItem,
  RunRequest,
  RunResult,
  DispatcherRun,
  ScheduledRun,
  SimulationRequest,
  SimulationResult,
  ValidationResult,
} from "./flow";

export type ApiSource = "api" | "mock";

export interface ApiResult<T> {
  data: T;
  source: ApiSource;
}

export interface FlowListResponse {
  items: FlowListItem[];
}

export interface CreateFlowBody {
  flowName: string;
  description?: string;
  documentType?: string;
  isActive?: boolean;
  flowDefinition: FlowDefinition;
  metadata?: Record<string, unknown>;
}

export interface UpdateFlowBody {
  flowName?: string;
  description?: string;
  documentType?: string;
  isActive?: boolean;
  flowDefinition: FlowDefinition;
  metadata?: Record<string, unknown>;
  expectedUpdatedAt: string;
}

export interface ValidateFlowBody {
  flowDefinition: FlowDefinition;
}

export interface FlowStatusBody {
  expectedUpdatedAt: string;
}

export interface DispatcherApi {
  getCatalog(): Promise<ApiResult<Catalog>>;
  listFlows(options?: { activeOnly?: boolean }): Promise<ApiResult<FlowListItem[]>>;
  getFlow(flowName: string): Promise<FlowDetail>;
  createFlow(body: CreateFlowBody): Promise<FlowDetail>;
  updateFlow(flowName: string, body: UpdateFlowBody): Promise<FlowDetail>;
  activateFlow(flowName: string, body: FlowStatusBody): Promise<FlowDetail>;
  deactivateFlow(flowName: string, body: FlowStatusBody): Promise<FlowDetail>;
  listConnections(): Promise<ApiResult<HttpConnection[]>>;
  getConnection(connectionName: string): Promise<HttpConnection>;
  upsertConnection(
    connectionName: string,
    body: HttpConnection,
  ): Promise<HttpConnection>;
  validate(body: ValidateFlowBody): Promise<ValidationResult>;
  validateFlow(
    flowName: string,
    body: ValidateFlowBody,
  ): Promise<ValidationResult>;
  simulate(
    flowName: string,
    body: SimulationRequest,
  ): Promise<ApiResult<SimulationResult>>;
  run(flowName: string, body: RunRequest): Promise<RunResult>;
  listRuns(flowName: string, options?: { limit?: number; protocol?: number }): Promise<DispatcherRun[]>;
  listScheduledRuns(flowName: string, limit?: number): Promise<ScheduledRun[]>;
}

export type {
  Catalog,
  FlowDefinition,
  FlowDetail,
  FlowListItem,
  RunRequest,
  RunResult,
  SimulationRequest,
  SimulationResult,
  ValidationResult,
};
