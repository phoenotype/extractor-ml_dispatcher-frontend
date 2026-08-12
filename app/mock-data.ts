import type {
  Catalog,
  FlowDefinition,
  FlowSummary,
  SimulationResult,
} from "./types";
export const mockCatalog: Catalog = {
  schemaVersion: 1,
  nodeTypes: [
    {
      type: "trigger.export_status",
      category: "trigger",
      label: "Stato di esportazione",
      description: "Avvia il flusso per i documenti negli stati selezionati",
      configSchema: {
        exportStatuses: {
          type: "array",
          items: "number",
          required: true,
          source: "exportStatuses",
          label: "Stati iniziali",
        },
      },
      outputs: ["always"],
    },
    {
      type: "condition",
      category: "logic",
      label: "Condizione",
      description: "Confronta un campo del documento con un valore",
      configSchema: {
        field: {
          type: "string",
          required: true,
          source: "documentFields",
          label: "Campo",
        },
        operator: {
          type: "enum",
          values: [
            "eq",
            "ne",
            "in",
            "not_in",
            "exists",
            "gt",
            "gte",
            "lt",
            "lte",
          ],
          required: true,
          label: "Operatore",
        },
        value: { type: "any", requiredExceptFor: ["exists"], label: "Valore" },
      },
      outputs: ["true", "false"],
    },
    {
      type: "action.update_export_status",
      category: "action",
      label: "Aggiorna stato di esportazione",
      description: "Imposta il nuovo export_status del documento",
      configSchema: {
        exportStatus: {
          type: "number",
          required: true,
          source: "exportStatuses",
          label: "Nuovo stato",
        },
      },
      outputs: ["always"],
    },
    {
      type: "stop",
      category: "control",
      label: "Termina flusso",
      description: "Interrompe il ramo senza ulteriori azioni",
      configSchema: {},
      outputs: [],
    },
  ],
  documentFields: [
    { path: "document_type", label: "Tipo documento", dataType: "string" },
    { path: "id_company", label: "Azienda", dataType: "number" },
    { path: "doc_status", label: "Stato documento", dataType: "string" },
    { path: "workflow_status", label: "Stato workflow", dataType: "string" },
    {
      path: "metadata.dispatch_ready",
      label: "Pronto per il dispatcher",
      dataType: "boolean",
    },
  ],
  exportStatuses: [
    { value: -6, label: "Errore riconoscimento AI" },
    { value: 2, label: "Elaborazione AI" },
    { value: 4, label: "Validazione" },
    { value: 90, label: "Coda di archiviazione" },
    { value: 91, label: "Coda eliminazione" },
    { value: 95, label: "Errore archiviazione" },
    { value: 100, label: "Archiviazione completata" },
  ],
};
export const starterFlow: FlowDefinition = {
  schemaVersion: 1,
  flowName: "invoice_opt_in_archive",
  nodes: [
    {
      id: "invoice_in_validation",
      type: "trigger.export_status",
      name: "Fattura in validazione",
      config: { exportStatuses: [4] },
      position: { x: 90, y: 175 },
    },
    {
      id: "explicitly_ready",
      type: "condition",
      name: "Opt-in esplicito",
      config: { field: "metadata.dispatch_ready", operator: "eq", value: true },
      position: { x: 410, y: 175 },
    },
    {
      id: "send_to_archive",
      type: "action.update_export_status",
      name: "Invia all'archivio",
      config: { exportStatus: 90 },
      position: { x: 750, y: 85 },
    },
    {
      id: "not_ready",
      type: "stop",
      name: "Lascia invariato",
      config: {},
      position: { x: 750, y: 285 },
    },
  ],
  edges: [
    {
      source: "invoice_in_validation",
      target: "explicitly_ready",
      branch: "always",
    },
    { source: "explicitly_ready", target: "send_to_archive", branch: "true" },
    { source: "explicitly_ready", target: "not_ready", branch: "false" },
  ],
  settings: { requiresExplicitOptIn: true },
};
export const mockFlows: FlowSummary[] = [
  {
    flowName: starterFlow.flowName,
    active: true,
    documentType: "Fattura",
    updatedAt: "2026-08-11T10:24:00Z",
    schemaVersion: 1,
    definition: starterFlow,
  },
  {
    flowName: "receipt_quality_gate",
    active: false,
    documentType: "Scontrino",
    updatedAt: "2026-08-09T14:30:00Z",
    schemaVersion: 1,
    definition: { ...starterFlow, flowName: "receipt_quality_gate" },
  },
  {
    flowName: "legacy_invoice_router",
    active: false,
    documentType: "Fattura",
    updatedAt: "2026-07-28T08:12:00Z",
    definition: {
      flowName: "legacy_invoice_router",
      rules: [{ expression: "legacy" }],
    },
  },
];
export const mockSimulation: SimulationResult = {
  count: 1,
  documents: [
    {
      protocol: 123,
      sourceExportStatus: 4,
      stopped: false,
      databaseWrites: 0,
      trace: [
        { nodeId: "invoice_in_validation", branch: "always" },
        { nodeId: "explicitly_ready", branch: "true", conditionResult: true },
        { nodeId: "send_to_archive" },
      ],
      plannedMutations: [{ field: "export_status", from: 4, to: 90 }],
    },
  ],
};
