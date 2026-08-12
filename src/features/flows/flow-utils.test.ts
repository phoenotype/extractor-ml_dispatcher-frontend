import { describe, expect, it } from "vitest";
import {
  defaultFieldValue,
  formatTriggerSummary,
  preliminaryValidate,
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
          description: "Tipi documento ammessi; se omesso accetta tutti i tipi",
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
  it("mostra tipi selezionati o Tutti", () => {
    expect(
      formatTriggerSummary({
        exportStatuses: [4, 90],
        documentTypes: ["Invoice", "Commercial Invoice"],
      }),
    ).toBe("Stati: 4, 90\nTipi: Invoice, Commercial Invoice");
    expect(formatTriggerSummary({ exportStatuses: [4] })).toBe(
      "Stati: 4\nTipi: Tutti",
    );
  });
});

describe("defaultFieldValue", () => {
  it("omite documentTypes opzionali", () => {
    const field = catalog.nodeTypes[0].configSchema.documentTypes;
    expect(defaultFieldValue(field, catalog, "documentTypes")).toBeUndefined();
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
});
