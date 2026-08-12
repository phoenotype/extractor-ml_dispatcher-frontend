import type { Catalog } from "./catalog";
import type {
  FlowDefinition,
  FlowDetail,
  FlowListItem,
  RunRequest,
  RunResult,
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

export interface DispatcherApi {
  getCatalog(): Promise<ApiResult<Catalog>>;
  listFlows(options?: { activeOnly?: boolean }): Promise<ApiResult<FlowListItem[]>>;
  getFlow(flowName: string): Promise<FlowDetail>;
  createFlow(body: CreateFlowBody): Promise<FlowDetail>;
  updateFlow(flowName: string, body: UpdateFlowBody): Promise<FlowDetail>;
  deactivateFlow(flowName: string): Promise<void>;
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
