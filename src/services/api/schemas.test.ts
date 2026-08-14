import { describe, expect, it } from "vitest";
import {
  flowListItemSchema,
  flowListPayloadSchema,
  httpConnectionSchema,
  simulationResultSchema,
} from "@/services/api/schemas";
import { normalizeFlowList } from "@/services/api/dispatcher";

describe("flow list schemas", () => {
  it("parsa payload con items e flowName", () => {
    const payload = {
      items: [
        {
          flowName: "invoice_opt_in_archive",
          description: "demo",
          documentType: "Fattura",
          isActive: true,
          format: "visual_v1",
          editable: true,
          metadata: { owner: "x" },
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-08-11T10:24:00Z",
        },
      ],
    };
    const parsed = flowListPayloadSchema.parse(payload);
    expect("items" in parsed).toBe(true);
    const items = normalizeFlowList(payload);
    expect(items[0].flowName).toBe("invoice_opt_in_archive");
    expect(items[0].expectedUpdatedAt).toBe("2026-08-11T10:24:00Z");
  });

  it("accetta name come alias e normalizza la lista", () => {
    const items = normalizeFlowList({
      items: [
        {
          name: "legacy_router",
          active: false,
          format: "legacy",
          editable: false,
          updatedAt: "2026-07-28T08:12:00Z",
        },
      ],
    });
    expect(items[0].flowName).toBe("legacy_router");
    expect(items[0].isActive).toBe(false);
    expect(items[0].format).toBe("legacy");
  });

  it("valida un singolo item", () => {
    const item = flowListItemSchema.parse({
      flowName: "a",
      isActive: false,
      format: "visual_v1",
      editable: true,
      updatedAt: "2026-08-12T00:00:00Z",
    });
    expect(item.expectedUpdatedAt).toBe("2026-08-12T00:00:00Z");
  });
});

describe("simulation result schema", () => {
  it("accetta una simulazione fermata dal trigger senza mutazioni", () => {
    const parsed = simulationResultSchema.parse({
      flowName: "invoice_opt_in_archive",
      simulation: true,
      documents: [
        {
          protocol: 3141,
          sourceExportStatus: 4,
          trace: [
            {
              nodeId: "invoice_in_validation",
              nodeType: "trigger.export_status",
              status: "executed",
              result: "false",
              details: {
                checks: [
                  {
                    criterion: "documentType",
                    expected: ["Invoice"],
                    actual: "passive_cycle",
                    matched: false,
                  },
                ],
                failedCriteria: ["documentType"],
              },
              plannedMutations: {},
            },
          ],
          plannedMutations: {},
          stopped: true,
        },
      ],
      count: 1,
      databaseWrites: 0,
      requestedProtocol: 3141,
      status: "evaluated",
    });

    expect(parsed.documents).toHaveLength(1);
    expect(parsed.documents?.[0].plannedMutations).toEqual({});
    expect(parsed.documents?.[0].stopped).toBe(true);
  });

  it("mantiene traccia HTTP dettagliata e contatori esterni", () => {
    const parsed = simulationResultSchema.parse({
      simulation: true,
      status: "evaluated",
      externalCallsAttempted: 1,
      externalCallsSucceeded: 1,
      documents: [
        {
          protocol: 3141,
          externalRequests: [
            {
              nodeId: "send",
              connectionRef: "ifttt_dispatcher",
              method: "POST",
              path: "/",
              status: "completed",
            },
          ],
          trace: [
            {
              nodeId: "send",
              nodeType: "action.http_request",
              status: "executed",
              input: { protocol: 3141 },
              output: { ignored: true },
              details: {
                httpExecution: {
                  status: "completed",
                  statusCode: 200,
                  request: { method: "POST", url: "https://masked/***" },
                  response: { statusCode: 200, body: "ok" },
                },
              },
            },
          ],
        },
      ],
    });

    expect(parsed.externalCallsAttempted).toBe(1);
    expect(parsed.documents?.[0].trace?.[0].details).toEqual(
      expect.objectContaining({ httpExecution: expect.any(Object) }),
    );
  });
});

describe("HTTP connection schema", () => {
  it("normalizza baseUrlEnv null restituito da backend precedenti", () => {
    const parsed = httpConnectionSchema.parse({
      connectionName: "ifttt_dispatcher",
      baseUrl: "https://maker.ifttt.com",
      baseUrlEnv: null,
      authType: "none",
      authConfig: {},
      defaultHeaders: {},
      allowedMethods: ["POST"],
      allowedPathPrefixes: ["/"],
      timeoutSeconds: 20,
      isActive: true,
    });
    expect(parsed.baseUrl).toBe("https://maker.ifttt.com");
    expect(parsed.baseUrlEnv).toBeUndefined();
  });

  it("normalizza baseUrl null restituito da backend precedenti", () => {
    const parsed = httpConnectionSchema.parse({
      connectionName: "ifttt_dispatcher",
      baseUrl: null,
      baseUrlEnv: "IFTTT_WEBHOOK_BASE_URL",
      authType: "none",
      authConfig: {},
      defaultHeaders: {},
      allowedMethods: ["POST"],
      allowedPathPrefixes: ["/"],
      timeoutSeconds: 20,
      isActive: true,
    });
    expect(parsed.baseUrl).toBeUndefined();
    expect(parsed.baseUrlEnv).toBe("IFTTT_WEBHOOK_BASE_URL");
  });
});
