import { describe, expect, it } from "vitest";
import { catalogSchema } from "@/services/api/schemas";
import { mockCatalog } from "@/services/api/mocks";
import {
  filterDocumentFields,
  groupDocumentFields,
  normalizeManualFieldPath,
  operatorsForDocumentField,
} from "./catalog-fields";

describe("catalog related document fields", () => {
  it("carica i nuovi campi correlati dal catalogo", () => {
    const parsed = catalogSchema.parse(mockCatalog);
    const paths = parsed.documentFields.map((field) => field.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "document_type",
        "metadata.dispatch_ready",
        "batch_fields",
        "table_fields",
        "comments",
        "attachments",
      ]),
    );

    const sections = groupDocumentFields(parsed.documentFields);
    const labels = sections.map((section) => section.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Campi base",
        "Campi documento",
        "Campi tabellari",
        "Commenti",
        "Allegati",
      ]),
    );
  });

  it("consente un percorso manuale senza trasformarlo", () => {
    expect(normalizeManualFieldPath("  metadata.custom_flag  ")).toBe(
      "metadata.custom_flag",
    );
    expect(normalizeManualFieldPath("attachments")).toBe("attachments");
  });

  it("salva il percorso esclusivamente come stringa field", () => {
    const path = normalizeManualFieldPath("attachments");
    const config = {
      field: path,
      operator: "exists" as const,
    };
    expect(config).toEqual({
      field: "attachments",
      operator: "exists",
    });
    expect(Object.keys(config)).toEqual(["field", "operator"]);
  });

  it("limita gli operatori per i campi array alle sole operazioni supportate", () => {
    const attachments = mockCatalog.documentFields.find(
      (field) => field.path === "attachments",
    );
    const operators = operatorsForDocumentField(attachments, [
      "eq",
      "ne",
      "in",
      "not_in",
      "exists",
      "gt",
      "gte",
      "lt",
      "lte",
    ]);
    expect(operators).toEqual(["exists"]);

    const scalar = mockCatalog.documentFields.find(
      (field) => field.path === "document_type",
    );
    expect(
      operatorsForDocumentField(scalar, ["eq", "ne", "exists"]),
    ).toEqual(["eq", "ne", "exists"]);
  });

  it("filtra i campi del catalogo per ricerca", () => {
    const matches = filterDocumentFields(mockCatalog.documentFields, "attach");
    expect(matches.map((field) => field.path)).toEqual(["attachments"]);
  });
});
