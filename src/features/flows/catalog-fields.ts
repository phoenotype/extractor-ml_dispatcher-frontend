import type { CatalogDocumentField } from "@/types/catalog";

/** Operatori attualmente sicuri per collezioni esposte come array. */
export const ARRAY_SAFE_OPERATORS = ["exists"] as const;

export type FieldSectionId =
  | "base"
  | "batch_fields"
  | "table_fields"
  | "comments"
  | "attachments"
  | "other";

export interface FieldSection {
  id: FieldSectionId;
  label: string;
  fields: CatalogDocumentField[];
}

const SECTION_LABELS: Record<FieldSectionId, string> = {
  base: "Campi base",
  batch_fields: "Campi documento",
  table_fields: "Campi tabellari",
  comments: "Commenti",
  attachments: "Allegati",
  other: "Altri percorsi",
};

const KNOWN_COLLECTION_ROOTS = new Set([
  "batch_fields",
  "table_fields",
  "comments",
  "attachments",
]);

export function fieldRoot(path: string): string {
  return path.split(".")[0] || path;
}

export function resolveFieldSectionId(
  field: CatalogDocumentField,
): FieldSectionId {
  const explicit =
    typeof (field as { group?: unknown }).group === "string"
      ? String((field as { group?: string }).group)
      : typeof (field as { section?: unknown }).section === "string"
        ? String((field as { section?: string }).section)
        : "";
  if (explicit === "batch_fields" || explicit === "document") {
    return "batch_fields";
  }
  if (explicit === "table_fields" || explicit === "table") {
    return "table_fields";
  }
  if (explicit === "comments" || explicit === "comment") {
    return "comments";
  }
  if (explicit === "attachments" || explicit === "attachment") {
    return "attachments";
  }

  const root = fieldRoot(field.path);
  if (root === "batch_fields") return "batch_fields";
  if (root === "table_fields") return "table_fields";
  if (root === "comments") return "comments";
  if (root === "attachments") return "attachments";
  if (KNOWN_COLLECTION_ROOTS.has(root)) return "other";
  return "base";
}

export function groupDocumentFields(
  fields: CatalogDocumentField[],
): FieldSection[] {
  const buckets = new Map<FieldSectionId, CatalogDocumentField[]>();
  for (const field of fields) {
    const id = resolveFieldSectionId(field);
    const list = buckets.get(id) || [];
    list.push(field);
    buckets.set(id, list);
  }

  const order: FieldSectionId[] = [
    "base",
    "batch_fields",
    "table_fields",
    "comments",
    "attachments",
    "other",
  ];

  return order
    .filter((id) => (buckets.get(id) || []).length > 0)
    .map((id) => ({
      id,
      label: SECTION_LABELS[id],
      fields: buckets.get(id) || [],
    }));
}

export function findDocumentField(
  fields: CatalogDocumentField[],
  path: string,
): CatalogDocumentField | undefined {
  return fields.find((field) => field.path === path);
}

export function isCollectionArrayField(
  field: CatalogDocumentField | undefined,
): boolean {
  if (!field) return false;
  if (field.dataType !== "array") return false;
  return KNOWN_COLLECTION_ROOTS.has(fieldRoot(field.path));
}

export function operatorsForDocumentField(
  field: CatalogDocumentField | undefined,
  catalogOperators: Array<string | number | boolean>,
): string[] {
  const available = catalogOperators.map(String);
  if (field?.dataType === "array") {
    return available.filter((op) =>
      (ARRAY_SAFE_OPERATORS as readonly string[]).includes(op),
    );
  }
  return available;
}

export function filterDocumentFields(
  fields: CatalogDocumentField[],
  query: string,
): CatalogDocumentField[] {
  const q = query.trim().toLowerCase();
  if (!q) return fields;
  return fields.filter((field) => {
    const haystack = `${field.path} ${field.label} ${field.dataType}`.toLowerCase();
    return haystack.includes(q);
  });
}

/** Conserva il percorso così com’è stato digitato (trim soltanto). */
export function normalizeManualFieldPath(value: string): string {
  return value.trim();
}
