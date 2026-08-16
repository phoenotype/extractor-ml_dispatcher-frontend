export type CatalogFieldType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "enum"
  | "code"
  | "any";

export interface CatalogConfigField {
  type: CatalogFieldType;
  items?: CatalogFieldType;
  values?: Array<string | number | boolean>;
  required?: boolean;
  requiredExceptFor?: string[];
  source?: "documentFields" | "exportStatuses";
  label?: string;
  description?: string;
  language?: string;
}

export interface CatalogNodeType {
  type: string;
  category: string;
  label: string;
  description: string;
  configSchema: Record<string, CatalogConfigField>;
  outputs: string[];
}

export interface CatalogDocumentField {
  path: string;
  label: string;
  dataType: "string" | "number" | "boolean" | "array";
  /** Raggruppamento opzionale dal catalogo (es. batch_fields). */
  group?: string;
  section?: string;
  description?: string;
}

export interface CatalogExportStatus {
  value: number;
  label: string;
}

export interface Catalog {
  schemaVersion: number;
  nodeTypes: CatalogNodeType[];
  documentFields: CatalogDocumentField[];
  exportStatuses: CatalogExportStatus[];
}
