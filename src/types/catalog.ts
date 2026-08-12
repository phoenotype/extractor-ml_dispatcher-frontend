export type CatalogFieldType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "enum"
  | "any";

export interface CatalogConfigField {
  type: CatalogFieldType;
  items?: CatalogFieldType;
  values?: Array<string | number | boolean>;
  required?: boolean;
  requiredExceptFor?: string[];
  source?: "documentFields" | "exportStatuses";
  label?: string;
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
