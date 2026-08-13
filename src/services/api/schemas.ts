import { z } from "zod";

export const flowFormatSchema = z.enum(["visual_v1", "legacy"]);

export const flowNodeDefinitionSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  config: z.record(z.string(), z.unknown()),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

export const flowEdgeDefinitionSchema = z.object({
  source: z.string(),
  target: z.string(),
  branch: z.string().optional().default("always"),
});

export const flowDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  flowName: z.string(),
  nodes: z.array(flowNodeDefinitionSchema),
  edges: z.array(flowEdgeDefinitionSchema),
  settings: z.object({
    requiresExplicitOptIn: z.boolean(),
  }),
});

export const flowListItemSchema = z
  .object({
    flowName: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    documentType: z.string().optional(),
    isActive: z.boolean(),
    format: flowFormatSchema,
    editable: z.boolean(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    expectedUpdatedAt: z.string().optional(),
    schemaVersion: z.number().optional(),
    flowDefinition: z
      .union([flowDefinitionSchema, z.record(z.string(), z.unknown())])
      .optional(),
    definition: z
      .union([flowDefinitionSchema, z.record(z.string(), z.unknown())])
      .optional(),
  })
  .transform((item) => ({
    ...item,
    expectedUpdatedAt: item.expectedUpdatedAt ?? item.updatedAt,
  }));

export const flowDetailSchema = z.object({
  flowName: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  documentType: z.string().optional(),
  isActive: z.boolean(),
  format: flowFormatSchema,
  editable: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  expectedUpdatedAt: z.string().optional(),
  schemaVersion: z.number().optional(),
  flowDefinition: z.union([
    flowDefinitionSchema,
    z.record(z.string(), z.unknown()),
  ]),
  definition: z
    .union([flowDefinitionSchema, z.record(z.string(), z.unknown())])
    .optional(),
});

export const flowListResponseSchema = z.object({
  items: z.array(flowListItemSchema),
});

/** Accetta { items }, array grezzo o { flows } legacy (normalizzazione a parte). */
export const flowListPayloadSchema = z.union([
  z.object({ items: z.array(z.record(z.string(), z.unknown())) }),
  z.array(z.record(z.string(), z.unknown())),
  z.object({
    flows: z.array(z.record(z.string(), z.unknown())),
  }),
]);

export const validationIssueSchema = z.object({
  message: z.string(),
  nodeId: z.string().optional(),
  path: z.string().optional(),
  code: z.string().optional(),
});

export const validationResultSchema = z.object({
  valid: z.boolean(),
  flowName: z.string().optional(),
  nodes: z.number().optional(),
  edges: z.number().optional(),
  issues: z.array(validationIssueSchema).optional(),
});

export const simulationDocumentSchema = z
  .object({
    protocol: z.number().optional(),
    documentType: z.string().optional(),
    trace: z.array(z.record(z.string(), z.unknown())).optional(),
    plannedMutations: z
      .union([
        z.array(z.record(z.string(), z.unknown())),
        z.record(z.string(), z.unknown()),
      ])
      .optional(),
    sourceExportStatus: z.number().optional(),
    stopped: z.boolean().optional(),
    stopReason: z.string().optional(),
    databaseWrites: z.number().optional(),
  })
  .passthrough();

export const simulationResultSchema = simulationDocumentSchema.extend({
  flowName: z.string().optional(),
  simulation: z.boolean().optional(),
  documents: z.array(simulationDocumentSchema).optional(),
  count: z.number().optional(),
});

export const catalogConfigFieldSchema = z
  .object({
    type: z.enum(["string", "number", "boolean", "array", "enum", "any"]),
    items: z
      .enum(["string", "number", "boolean", "array", "enum", "any"])
      .optional(),
    values: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    required: z.boolean().optional(),
    requiredExceptFor: z.array(z.string()).optional(),
    source: z.enum(["documentFields", "exportStatuses"]).optional(),
    label: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

export const catalogNodeTypeSchema = z.object({
  type: z.string(),
  category: z.string(),
  label: z.string(),
  description: z.string(),
  configSchema: z.record(z.string(), catalogConfigFieldSchema),
  outputs: z.array(z.string()),
});

export const catalogSchema = z.object({
  schemaVersion: z.number(),
  nodeTypes: z.array(catalogNodeTypeSchema),
  documentFields: z.array(
    z.object({
      path: z.string(),
      label: z.string(),
      dataType: z.enum(["string", "number", "boolean", "array"]),
    }),
  ),
  exportStatuses: z.array(
    z.object({
      value: z.number(),
      label: z.string(),
    }),
  ),
});

export type FlowListItemParsed = z.infer<typeof flowListItemSchema>;
export type CatalogParsed = z.infer<typeof catalogSchema>;
export type ValidationResultParsed = z.infer<typeof validationResultSchema>;
export type SimulationResultParsed = z.infer<typeof simulationResultSchema>;
