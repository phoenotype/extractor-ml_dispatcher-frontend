import { describe, expect, it } from "vitest";
import {
  flowListItemSchema,
  flowListPayloadSchema,
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
