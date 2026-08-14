import { describe, expect, it } from "vitest";
import {
  defaultFieldValue,
  formatTriggerSummary,
  getFlowTriggerSummary,
  preliminaryValidate,
  sanitizeDocumentTypes,
  slug,
  toFlowEdges,
} from "./flow-utils";
import type { Catalog } from "@/types/catalog";
import type { FlowDefinition } from "@/types/flow";

const catalog: Catalog = {
  schemaVersion: 1,
  nodeTypes: [
    {
      type: "trigger.export_status",
      category: "trigger",
      label: "Trigger",
      description: "",
      configSchema: {
        exportStatuses: {
          type: "array",
          items: "number",
          required: true,
          source: "exportStatuses",
        },
        documentTypes: {
          type: "array",
          items: "string",
          required: false,
        },
      },
      outputs: ["always"],
    },
    {
      type: "condition",
      category: "logic",
      label: "Condizione",
      description: "",
      configSchema: {
        field: { type: "string", required: true, source: "documentFields" },
        operator: { type: "enum", values: ["eq", "exists"], required: true },
        value: { type: "any", requiredExceptFor: ["exists"] },
      },
      outputs: ["true", "false"],
    },
  ],
  documentFields: [{ path: "a", label: "A", dataType: "string" }],
  exportStatuses: [{ value: 4, label: "Validazione" }],
};

describe("slug", () => {
  it("normalizza spazi e caratteri", () => {
    expect(slug(" Invoice Opt-In ")).toBe("invoice_opt_in");
  });
});

describe("toFlowEdges", () => {
  it("assegna handle e colori ai branch", () => {
    const flow: FlowDefinition = {
      schemaVersion: 1,
      flowName: "demo",
      nodes: [],
      edges: [
        { source: "a", target: "b", branch: "true" },
        { source: "a", target: "c", branch: "false" },
        { source: "t", target: "a", branch: "always" },
      ],
      settings: { requiresExplicitOptIn: true },
    };
    const edges = toFlowEdges(flow);
    expect(edges[0].sourceHandle).toBe("true");
    expect(edges[1].sourceHandle).toBe("false");
    expect(edges[2].sourceHandle).toBeUndefined();
    expect(edges[0].label).toBe("TRUE");
  });

  it("tollera edge senza branch (default always)", () => {
    const flow = {
      schemaVersion: 1 as const,
      flowName: "demo",
      nodes: [],
      edges: [
        {
          source: "t",
          target: "a",
        } as { source: string; target: string; branch?: string },
      ],
      settings: { requiresExplicitOptIn: true },
    };
    const edges = toFlowEdges(flow as FlowDefinition);
    expect(edges[0].sourceHandle).toBeUndefined();
    expect(edges[0].label).toBeUndefined();
  });
});

describe("formatTriggerSummary", () => {
  it("mostra tipi selezionati o Tutti e tronca liste lunghe", () => {
    expect(
      formatTriggerSummary({
        exportStatuses: [4, 90],
        documentTypes: ["Invoice", "Commercial Invoice"],
      }),
    ).toBe("Stati: 4, 90\nTipi: Invoice, Commercial Invoice");
    expect(formatTriggerSummary({ exportStatuses: [4] })).toBe(
      "Stati: 4\nTipi: Tutti",
    );
    expect(
      formatTriggerSummary({
        exportStatuses: [4],
        documentTypes: ["Invoice", "Receipt", "DN", "POD", "Other"],
      }),
    ).toBe("Stati: 4\nTipi: Invoice, Receipt +3");
  });
});

describe("sanitizeDocumentTypes", () => {
  it("deduplica case-insensitive e omette array vuoti", () => {
    expect(sanitizeDocumentTypes([" Invoice ", "invoice", "Receipt"])).toEqual([
      "Invoice",
      "Receipt",
    ]);
    expect(sanitizeDocumentTypes([])).toBeUndefined();
    expect(sanitizeDocumentTypes(["  ", ""])).toBeUndefined();
  });
});

describe("defaultFieldValue", () => {
  it("omite documentTypes opzionali", () => {
    const field = catalog.nodeTypes[0].configSchema.documentTypes;
    expect(defaultFieldValue(field, catalog, "documentTypes")).toBeUndefined();
  });

  it("non inserisce valori fittizi nei campi opzionali HTTP", () => {
    expect(
      defaultFieldValue({ type: "number", required: false }, catalog, "timeoutSeconds"),
    ).toBeUndefined();
    expect(
      defaultFieldValue({ type: "any", required: false }, catalog, "headers"),
    ).toBeUndefined();
  });
});

describe("getFlowTriggerSummary", () => {
  it("estrae i criteri dal nodo trigger", () => {
    const flow: FlowDefinition = {
      schemaVersion: 1,
      flowName: "demo",
      nodes: [
        {
          id: "t1",
          type: "trigger.export_status",
          name: "Trigger",
          config: { exportStatuses: [4], documentTypes: ["Invoice"] },
        },
      ],
      edges: [],
      settings: { requiresExplicitOptIn: true },
    };
    expect(getFlowTriggerSummary(flow)).toEqual({
      statusLine: "Stati: 4",
      typesLine: "Tipi: Invoice",
    });
  });
});

describe("preliminaryValidate", () => {
  it("segnala campi obbligatori mancanti", () => {
    const flow: FlowDefinition = {
      schemaVersion: 1,
      flowName: "demo",
      nodes: [
        {
          id: "t1",
          type: "trigger.export_status",
          name: "Trigger",
          config: { exportStatuses: [] },
        },
        {
          id: "c1",
          type: "condition",
          name: "Condizione",
          config: { operator: "eq" },
        },
      ],
      edges: [{ source: "c1", target: "t1", branch: "maybe" }],
      settings: { requiresExplicitOptIn: true },
    };
    const issues = preliminaryValidate(flow, catalog);
    expect(issues.some((i) => i.nodeId === "t1")).toBe(true);
    expect(issues.some((i) => i.nodeId === "c1")).toBe(true);
    expect(issues.some((i) => i.message.includes("maybe"))).toBe(true);
  });

  it("rifiuta documentTypes come array vuoto", () => {
    const flow: FlowDefinition = {
      schemaVersion: 1,
      flowName: "demo",
      nodes: [
        {
          id: "t1",
          type: "trigger.export_status",
          name: "Trigger",
          config: { exportStatuses: [4], documentTypes: [] },
        },
      ],
      edges: [],
      settings: { requiresExplicitOptIn: true },
    };
    const issues = preliminaryValidate(flow, catalog);
    expect(
      issues.some((i) => i.message.toLowerCase().includes("documenttypes")),
    ).toBe(true);
  });
});
