import { mockCatalog, mockFlows, mockSimulation } from "./mock-data";
import type {
  Catalog,
  FlowDefinition,
  FlowSummary,
  SimulationResult,
  ValidationResult,
} from "./types";
const API_URL = (
  process.env.NEXT_PUBLIC_DISPATCHER_API_URL || "http://localhost:8000"
).replace(/\/$/, "");
const USE_MOCK_FALLBACK =
  process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK !== "false";
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown,
  ) {
    super(message);
  }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      typeof body?.detail === "string"
        ? body.detail
        : "Il backend ha restituito un errore",
      response.status,
      body?.detail,
    );
  return body as T;
}
export const api = {
  async getCatalog(): Promise<{ data: Catalog; source: "api" | "mock" }> {
    try {
      return { data: await request<Catalog>("/catalog"), source: "api" };
    } catch (error) {
      if (!USE_MOCK_FALLBACK) throw error;
      return { data: mockCatalog, source: "mock" };
    }
  },
  async listFlows(): Promise<{ data: FlowSummary[]; source: "api" | "mock" }> {
    try {
      const body = await request<FlowSummary[] | { flows: FlowSummary[] }>(
        "/flows",
      );
      return { data: Array.isArray(body) ? body : body.flows, source: "api" };
    } catch (error) {
      if (!USE_MOCK_FALLBACK) throw error;
      return { data: mockFlows, source: "mock" };
    }
  },
  getFlow: (name: string) =>
    request<FlowSummary | FlowDefinition>(`/flows/${encodeURIComponent(name)}`),
  createFlow: (flowDefinition: FlowDefinition, active: boolean) =>
    request<FlowSummary>("/flows", {
      method: "POST",
      body: JSON.stringify({ flowDefinition, active }),
    }),
  updateFlow: (name: string, flowDefinition: FlowDefinition, active: boolean) =>
    request<FlowSummary>(`/flows/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ flowDefinition, active }),
    }),
  deactivateFlow: (name: string) =>
    request<void>(`/flows/${encodeURIComponent(name)}`, { method: "DELETE" }),
  async validate(flowDefinition: FlowDefinition): Promise<ValidationResult> {
    try {
      return await request<ValidationResult>("/flows/validate", {
        method: "POST",
        body: JSON.stringify({ flowDefinition }),
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const details = Array.isArray(error.details) ? error.details : [];
        return {
          valid: false,
          issues: details.map((item: { msg?: string }) => ({
            message: item.msg || "Definizione non valida",
            nodeId: /Node ([^ ]+)/.exec(item.msg || "")?.[1],
          })),
        };
      }
      throw error;
    }
  },
  async simulate(
    flowName: string,
    protocol: number | undefined,
    batchSize: number,
  ): Promise<{ data: SimulationResult; source: "api" | "mock" }> {
    try {
      return {
        data: await request<SimulationResult>("/simulations", {
          method: "POST",
          body: JSON.stringify({ flowName, protocol, batchSize }),
        }),
        source: "api",
      };
    } catch (error) {
      if (!USE_MOCK_FALLBACK) throw error;
      return { data: mockSimulation, source: "mock" };
    }
  },
  run: (flowName: string, batchSize: number) =>
    request<Record<string, unknown>>("/runs", {
      method: "POST",
      body: JSON.stringify({ flowName, batchSize, dryRun: false }),
    }),
};
