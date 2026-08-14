import type {
  ApiResult,
  CreateFlowBody,
  DispatcherApi,
  FlowStatusBody,
  UpdateFlowBody,
  ValidateFlowBody,
} from "@/types/api";
import type { Catalog } from "@/types/catalog";
import type { HttpConnection } from "@/types/connection";
import type {
  FlowDetail,
  FlowListItem,
  RunRequest,
  RunResult,
  SimulationRequest,
  SimulationResult,
  ValidationResult,
} from "@/types/flow";
import {
  normalizeConnection,
  validateHttpRequestConfig,
} from "@/features/connections/http-config";
import { ApiError, assertOk } from "./client";
import { getDispatcherConfig } from "./config";
import { dispatcherFetch } from "./http";
import {
  mockCatalog,
  mockConnections,
  mockFlowDetails,
  mockFlowItems,
  mockSimulation,
  mockValidationOk,
  starterFlow,
} from "./mocks";
import {
  catalogSchema,
  flowListItemSchema,
  flowListPayloadSchema,
  httpConnectionListPayloadSchema,
  httpConnectionSchema,
  simulationResultSchema,
  validationResultSchema,
} from "./schemas";

function encodeName(name: string): string {
  return encodeURIComponent(name);
}

function isVisualDefinition(
  value: unknown,
): value is { schemaVersion: 1; nodes: unknown[] } {
  return (
    !!value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    (value as { schemaVersion?: unknown }).schemaVersion === 1
  );
}

export function normalizeListItem(raw: Record<string, unknown>): FlowListItem {
  const flowName =
    (typeof raw.flowName === "string" && raw.flowName) ||
    (typeof raw.name === "string" && raw.name) ||
    "";
  const definition =
    raw.flowDefinition ??
    raw.definition ??
    (isVisualDefinition(raw) ? raw : undefined);
  const format =
    raw.format === "legacy" || raw.format === "visual_v1"
      ? raw.format
      : definition && !isVisualDefinition(definition)
        ? "legacy"
        : "visual_v1";
  const isActive =
    typeof raw.isActive === "boolean"
      ? raw.isActive
      : typeof raw.active === "boolean"
        ? raw.active
        : false;
  const editable =
    typeof raw.editable === "boolean" ? raw.editable : format === "visual_v1";

  return flowListItemSchema.parse({
    flowName,
    name: typeof raw.name === "string" ? raw.name : undefined,
    description:
      typeof raw.description === "string" ? raw.description : undefined,
    documentType:
      typeof raw.documentType === "string" ? raw.documentType : undefined,
    isActive,
    format,
    editable,
    metadata:
      raw.metadata && typeof raw.metadata === "object"
        ? (raw.metadata as Record<string, unknown>)
        : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    expectedUpdatedAt:
      typeof raw.expectedUpdatedAt === "string"
        ? raw.expectedUpdatedAt
        : typeof raw.updatedAt === "string"
          ? raw.updatedAt
          : undefined,
    schemaVersion:
      typeof raw.schemaVersion === "number"
        ? raw.schemaVersion
        : isVisualDefinition(definition)
          ? 1
          : undefined,
    flowDefinition: definition,
    definition,
  });
}

export function normalizeFlowList(payload: unknown): FlowListItem[] {
  const parsed = flowListPayloadSchema.parse(payload);
  if (Array.isArray(parsed)) {
    return parsed.map((item) => normalizeListItem(item));
  }
  if ("items" in parsed) {
    return parsed.items.map((item) => normalizeListItem(item));
  }
  return parsed.flows.map((item) => normalizeListItem(item));
}

export function normalizeFlowDetail(
  payload: unknown,
  fallbackName?: string,
): FlowDetail {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(422, "Risposta flusso non valida", payload);
  }
  const raw = payload as Record<string, unknown>;
  const listPart = normalizeListItem({
    ...raw,
    flowName:
      raw.flowName ||
      raw.name ||
      fallbackName ||
      (isVisualDefinition(raw.flowDefinition)
        ? (raw.flowDefinition as { flowName?: string }).flowName
        : undefined),
  });
  const flowDefinition =
    raw.flowDefinition ??
    raw.definition ??
    listPart.flowDefinition ??
    (isVisualDefinition(raw) ? raw : { flowName: listPart.flowName });

  return {
    ...listPart,
    flowDefinition: flowDefinition as FlowDetail["flowDefinition"],
  };
}

function delay(ms = 160): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await dispatcherFetch(path, init);
  return assertOk(response);
}

export function toValidationResult(error: unknown): ValidationResult | null {
  if (!(error instanceof ApiError) || !error.isValidation) return null;

  const details = error.details;
  const toIssue = (message: string, nodeId?: string) => ({
    message,
    nodeId:
      nodeId ||
      /nodes\.([^.]+)|Node\s+([^\s:]+)/i.exec(message)?.[1] ||
      /Node\s+([^\s:]+)/i.exec(message)?.[2],
  });

  if (typeof details === "string") {
    return { valid: false, issues: [toIssue(details)] };
  }

  if (Array.isArray(details) && details.length > 0) {
    return {
      valid: false,
      issues: details.map((item) => {
        if (typeof item === "string") return toIssue(item);
        if (item && typeof item === "object") {
          const record = item as {
            msg?: string;
            message?: string;
            nodeId?: string;
            loc?: unknown;
          };
          const message =
            record.msg || record.message || error.message || "Definizione non valida";
          return toIssue(message, record.nodeId);
        }
        return toIssue("Definizione non valida");
      }),
    };
  }

  return {
    valid: false,
    issues: [toIssue(error.message || "Definizione non valida")],
  };
}

export function normalizeConnections(payload: unknown): HttpConnection[] {
  const parsed = httpConnectionListPayloadSchema.parse(payload);
  if (Array.isArray(parsed)) return parsed;
  if ("items" in parsed) return parsed.items;
  return parsed.connections;
}

export function parseConnectionWriteResponse(
  payload: unknown,
  fallback: HttpConnection,
): HttpConnection {
  const parsed = httpConnectionSchema.safeParse(payload);
  return parsed.success ? parsed.data : fallback;
}

const mockStore = {
  items: structuredClone(mockFlowItems),
  details: structuredClone(mockFlowDetails) as Record<string, FlowDetail>,
  connections: structuredClone(mockConnections) as HttpConnection[],
};

const mockApi: DispatcherApi = {
  async getCatalog(): Promise<ApiResult<Catalog>> {
    await delay();
    return { data: mockCatalog, source: "mock" };
  },

  async listFlows(options): Promise<ApiResult<FlowListItem[]>> {
    await delay();
    const activeOnly = options?.activeOnly === true;
    const items = activeOnly
      ? mockStore.items.filter((item) => item.isActive)
      : mockStore.items;
    return { data: items, source: "mock" };
  },

  async getFlow(flowName: string): Promise<FlowDetail> {
    await delay();
    const detail = mockStore.details[flowName];
    if (!detail) throw new ApiError(404, `Flusso non trovato: ${flowName}`);
    return structuredClone(detail);
  },

  async createFlow(body: CreateFlowBody): Promise<FlowDetail> {
    await delay();
    if (mockStore.details[body.flowName]) {
      throw new ApiError(409, "Esiste già un flusso con questo nome");
    }
    const now = new Date().toISOString();
    const detail: FlowDetail = {
      flowName: body.flowName,
      description: body.description,
      documentType: body.documentType,
      isActive: body.isActive ?? false,
      format: "visual_v1",
      editable: true,
      metadata: body.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      expectedUpdatedAt: now,
      schemaVersion: 1,
      flowDefinition: { ...body.flowDefinition, flowName: body.flowName },
    };
    mockStore.details[body.flowName] = detail;
    mockStore.items = [detail, ...mockStore.items.filter((i) => i.flowName !== body.flowName)];
    return structuredClone(detail);
  },

  async updateFlow(flowName: string, body: UpdateFlowBody): Promise<FlowDetail> {
    await delay();
    const existing = mockStore.details[flowName];
    if (!existing) throw new ApiError(404, `Flusso non trovato: ${flowName}`);
    if (
      body.expectedUpdatedAt &&
      existing.expectedUpdatedAt &&
      body.expectedUpdatedAt !== existing.expectedUpdatedAt
    ) {
      throw new ApiError(409, "expectedUpdatedAt non corrisponde");
    }
    const now = new Date().toISOString();
    const detail: FlowDetail = {
      ...existing,
      description: body.description ?? existing.description,
      documentType: body.documentType ?? existing.documentType,
      isActive: body.isActive ?? existing.isActive,
      metadata: body.metadata ?? existing.metadata,
      updatedAt: now,
      expectedUpdatedAt: now,
      flowDefinition: { ...body.flowDefinition, flowName },
    };
    mockStore.details[flowName] = detail;
    mockStore.items = mockStore.items.map((item) =>
      item.flowName === flowName ? detail : item,
    );
    return structuredClone(detail);
  },

  async activateFlow(
    flowName: string,
    body: FlowStatusBody = {},
  ): Promise<FlowDetail> {
    await delay();
    const existing = mockStore.details[flowName];
    if (!existing) throw new ApiError(404, `Flusso non trovato: ${flowName}`);
    if (
      body.expectedUpdatedAt &&
      existing.expectedUpdatedAt &&
      body.expectedUpdatedAt !== existing.expectedUpdatedAt
    ) {
      throw new ApiError(409, "expectedUpdatedAt non corrisponde");
    }
    const now = new Date().toISOString();
    const detail = { ...existing, isActive: true, updatedAt: now, expectedUpdatedAt: now };
    mockStore.details[flowName] = detail;
    mockStore.items = mockStore.items.map((item) =>
      item.flowName === flowName ? detail : item,
    );
    return structuredClone(detail);
  },

  async deactivateFlow(
    flowName: string,
    body: FlowStatusBody = {},
  ): Promise<FlowDetail> {
    await delay();
    if (!mockStore.details[flowName]) {
      throw new ApiError(404, `Flusso non trovato: ${flowName}`);
    }
    const existing = mockStore.details[flowName];
    if (
      body.expectedUpdatedAt &&
      existing.expectedUpdatedAt &&
      body.expectedUpdatedAt !== existing.expectedUpdatedAt
    ) {
      throw new ApiError(409, "expectedUpdatedAt non corrisponde");
    }
    const now = new Date().toISOString();
    const detail: FlowDetail = {
      ...existing,
      isActive: false,
      updatedAt: now,
      expectedUpdatedAt: now,
    };
    mockStore.details[flowName] = detail;
    mockStore.items = mockStore.items.map((item) =>
      item.flowName === flowName ? detail : item,
    );
    return structuredClone(detail);
  },

  async listConnections(): Promise<ApiResult<HttpConnection[]>> {
    await delay();
    return { data: structuredClone(mockStore.connections), source: "mock" };
  },

  async getConnection(connectionName: string): Promise<HttpConnection> {
    await delay();
    const found = mockStore.connections.find(
      (item) => item.connectionName === connectionName,
    );
    if (!found) {
      throw new ApiError(404, `Connessione non trovata: ${connectionName}`);
    }
    return structuredClone(found);
  },

  async upsertConnection(
    connectionName: string,
    body: HttpConnection,
  ): Promise<HttpConnection> {
    await delay();
    const next = { ...body, connectionName };
    const index = mockStore.connections.findIndex(
      (item) => item.connectionName === connectionName,
    );
    if (index >= 0) mockStore.connections[index] = next;
    else mockStore.connections.push(next);
    return structuredClone(next);
  },

  async validate(body: ValidateFlowBody): Promise<ValidationResult> {
    await delay();
    if (!body.flowDefinition.nodes.length) {
      return {
        valid: false,
        issues: [{ message: "Il flusso non contiene nodi" }],
      };
    }
    const issues: ValidationResult["issues"] = [];
    for (const node of body.flowDefinition.nodes) {
      if (node.type !== "action.http_request") continue;
      const messages = validateHttpRequestConfig(
        node.config || {},
        mockStore.connections,
      );
      for (const message of messages) {
        issues.push({ nodeId: node.id, message });
      }
    }
    if (issues.length) {
      return {
        valid: false,
        flowName: body.flowDefinition.flowName,
        issues,
      };
    }
    return {
      ...mockValidationOk,
      flowName: body.flowDefinition.flowName,
      nodes: body.flowDefinition.nodes.length,
      edges: body.flowDefinition.edges.length,
    };
  },

  async validateFlow(
    flowName: string,
    body: ValidateFlowBody,
  ): Promise<ValidationResult> {
    const result = await this.validate(body);
    return { ...result, flowName };
  },

  async simulate(
    _flowName: string,
    body: SimulationRequest,
  ): Promise<ApiResult<SimulationResult>> {
    await delay();
    return {
      data: {
        ...mockSimulation,
        documents: (mockSimulation.documents || []).map((doc) => ({
          ...doc,
          protocol: body.protocol ?? doc.protocol,
        })),
        count: body.batchSize ?? mockSimulation.count,
      },
      source: "mock",
    };
  },

  async run(flowName: string, body: RunRequest): Promise<RunResult> {
    await delay();
    return {
      flowName,
      dryRun: body.dryRun,
      batchSize: body.batchSize,
      processed: 0,
      status: "accepted",
    };
  },
};

const liveApi: DispatcherApi = {
  async getCatalog(): Promise<ApiResult<Catalog>> {
    const body = await requestJson("/catalog");
    return { data: catalogSchema.parse(body), source: "api" };
  },

  async listFlows(options): Promise<ApiResult<FlowListItem[]>> {
    const activeOnly = options?.activeOnly === true;
    const qs = `?activeOnly=${activeOnly ? "true" : "false"}`;
    const body = await requestJson(`/flows${qs}`);
    return { data: normalizeFlowList(body), source: "api" };
  },

  async getFlow(flowName: string): Promise<FlowDetail> {
    const body = await requestJson(`/flows/${encodeName(flowName)}`);
    return normalizeFlowDetail(body, flowName);
  },

  async createFlow(body: CreateFlowBody): Promise<FlowDetail> {
    const payload = await requestJson("/flows", {
      method: "POST",
      body: JSON.stringify({
        flowName: body.flowName,
        description: body.description,
        documentType: body.documentType,
        isActive: body.isActive ?? false,
        flowDefinition: body.flowDefinition,
        metadata: body.metadata ?? {},
      }),
    });
    return normalizeFlowDetail(payload, body.flowName);
  },

  async updateFlow(flowName: string, body: UpdateFlowBody): Promise<FlowDetail> {
    const payload = await requestJson(`/flows/${encodeName(flowName)}`, {
      method: "PUT",
      body: JSON.stringify({
        flowName: body.flowName ?? flowName,
        description: body.description,
        documentType: body.documentType,
        isActive: body.isActive,
        flowDefinition: body.flowDefinition,
        metadata: body.metadata,
        expectedUpdatedAt: body.expectedUpdatedAt,
      }),
    });
    return normalizeFlowDetail(payload, flowName);
  },

  async activateFlow(
    flowName: string,
    body: FlowStatusBody = {},
  ): Promise<FlowDetail> {
    const payload = await requestJson(`/flows/${encodeName(flowName)}/activate`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return normalizeFlowDetail(payload, flowName);
  },

  async deactivateFlow(
    flowName: string,
    body: FlowStatusBody = {},
  ): Promise<FlowDetail> {
    const payload = await requestJson(`/flows/${encodeName(flowName)}/deactivate`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return normalizeFlowDetail(payload, flowName);
  },

  async listConnections(): Promise<ApiResult<HttpConnection[]>> {
    const body = await requestJson("/connections");
    return { data: normalizeConnections(body), source: "api" };
  },

  async getConnection(connectionName: string): Promise<HttpConnection> {
    const body = await requestJson(`/connections/${encodeName(connectionName)}`);
    return httpConnectionSchema.parse(body);
  },

  async upsertConnection(
    connectionName: string,
    body: HttpConnection,
  ): Promise<HttpConnection> {
    const requestBody = normalizeConnection({ ...body, connectionName });
    const payload = await requestJson(`/connections/${encodeName(connectionName)}`, {
      method: "PUT",
      body: JSON.stringify(requestBody),
    });
    // A successful PUT remains successful even if an older backend revision
    // returns a response shape the current client cannot parse.
    return parseConnectionWriteResponse(payload, requestBody);
  },

  async validate(body: ValidateFlowBody): Promise<ValidationResult> {
    try {
      const payload = await requestJson("/flows/validate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return validationResultSchema.parse(payload);
    } catch (error) {
      const from422 = toValidationResult(error);
      if (from422) return from422;
      throw error;
    }
  },

  async validateFlow(
    flowName: string,
    body: ValidateFlowBody,
  ): Promise<ValidationResult> {
    try {
      const payload = await requestJson(
        `/flows/${encodeName(flowName)}/validate`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      return validationResultSchema.parse(payload);
    } catch (error) {
      const from422 = toValidationResult(error);
      if (from422) return { ...from422, flowName };
      throw error;
    }
  },

  async simulate(
    flowName: string,
    body: SimulationRequest,
  ): Promise<ApiResult<SimulationResult>> {
    const payload = await requestJson(
      `/flows/${encodeName(flowName)}/simulations`,
      {
        method: "POST",
        body: JSON.stringify({
          flowName: body.flowName || flowName,
          protocol: body.protocol,
          batchSize: body.batchSize,
        }),
      },
    );
    return {
      data: simulationResultSchema.parse(payload),
      source: "api",
    };
  },

  async run(flowName: string, body: RunRequest): Promise<RunResult> {
    const payload = await requestJson(`/flows/${encodeName(flowName)}/runs`, {
      method: "POST",
      body: JSON.stringify({
        flowName: body.flowName || flowName,
        batchSize: body.batchSize,
        dryRun: body.dryRun,
      }),
    });
    return (payload ?? {}) as RunResult;
  },
};

export function createDispatcherApi(): DispatcherApi {
  const { useMocks } = getDispatcherConfig();
  return useMocks ? mockApi : liveApi;
}

/** Client singleton: mock solo se VITE_USE_DISPATCHER_MOCKS=true. */
export const dispatcherApi = createDispatcherApi();

export { starterFlow };
