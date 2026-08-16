import type { Catalog } from "@/types/catalog";
import type { HttpConnection } from "@/types/connection";
import type {
  FlowDefinition,
  FlowDetail,
  FlowListItem,
  SimulationResult,
  ValidationResult,
} from "@/types/flow";

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
          label: "Stati di esportazione",
        },
        documentTypes: {
          type: "array",
          items: "string",
          required: false,
          description:
            "Se non selezioni alcun tipo, il trigger considera tutti i tipi documento.",
          label: "Tipi documento ammessi",
        },
      },
      outputs: ["always"],
    },
    {
      type: "trigger.schedule",
      category: "trigger",
      label: "Scheduler",
      description: "Avvia periodicamente il flusso",
      configSchema: {
        cron: { type: "string", required: true, label: "Espressione cron" },
        timezone: { type: "string", required: true, label: "Timezone" },
        batchSize: { type: "number", required: true, label: "Documenti per esecuzione" },
        exportStatuses: { type: "array", items: "number", required: true, source: "exportStatuses" },
        documentTypes: { type: "array", items: "string", required: false },
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
      type: "action.http_request",
      category: "action",
      label: "Richiesta HTTP",
      description:
        "Invia una richiesta HTTP tramite una connessione configurata (senza segreti nel flusso)",
      configSchema: {
        connectionRef: {
          type: "string",
          required: true,
          label: "Connessione",
          description: "Nome connessione HTTP attiva",
        },
        method: {
          type: "enum",
          values: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
          required: true,
          label: "Metodo",
        },
        path: {
          type: "string",
          required: true,
          label: "Percorso",
          description: "Percorso relativo che inizia con /",
        },
        headers: {
          type: "any",
          required: false,
          label: "Headers",
        },
        body: {
          type: "any",
          required: false,
          label: "Body",
        },
        successStatusCodes: {
          type: "array",
          items: "number",
          required: true,
          label: "Status di successo",
        },
        timeoutSeconds: {
          type: "number",
          required: false,
          label: "Timeout (secondi)",
        },
      },
      outputs: ["always"],
    },
    {
      type: "action.python",
      category: "action",
      label: "Python",
      description: "Elabora il documento e gli output dei nodi precedenti",
      configSchema: {
        code: {
          type: "code",
          language: "python",
          required: true,
          label: "Codice Python",
        },
      },
      outputs: ["always"],
    },
    {
      type: "action.write_document_data",
      category: "action",
      label: "Scrivi dati documento",
      description: "Aggiorna w_doc_batch, w_batch_fields o w_table_fields",
      configSchema: {
        target: {
          type: "enum",
          values: ["w_doc_batch", "w_batch_fields", "w_table_fields"],
          required: true,
        },
        mode: {
          type: "enum",
          values: ["update", "upsert"],
          required: true,
        },
        selector: {
          type: "any",
          required: false,
          description:
            "w_batch_fields: fieldCode + number. w_table_fields: idFieldGroup + rowNumber + idColumn.",
        },
        values: { type: "any", required: true },
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
    {
      path: "batch_fields",
      label: "Campi documento (batch_fields)",
      dataType: "array",
      group: "batch_fields",
      description: "Righe w_batch_fields (field_code, field_name)",
    },
    {
      path: "table_fields",
      label: "Campi tabellari (table_fields)",
      dataType: "array",
      group: "table_fields",
      description: "Righe w_table_fields (group/column code e name)",
    },
    {
      path: "comments",
      label: "Commenti documento",
      dataType: "array",
      group: "comments",
      description: "Righe w_document_comments",
    },
    {
      path: "attachments",
      label: "Allegati",
      dataType: "array",
      group: "attachments",
      description: "Righe w_doc_batch_attach",
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
      name: "Invoice in validation queue",
      config: { exportStatuses: [4], documentTypes: ["Invoice"] },
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

const updatedAt = "2026-08-11T10:24:00Z";
const createdAt = "2026-07-01T09:00:00Z";

export const mockFlowItems: FlowListItem[] = [
  {
    flowName: starterFlow.flowName,
    description: "Archiviazione con opt-in esplicito",
    documentType: "Fattura",
    isActive: true,
    format: "visual_v1",
    editable: true,
    metadata: { owner: "dispatcher" },
    createdAt,
    updatedAt,
    expectedUpdatedAt: updatedAt,
    schemaVersion: 1,
    flowDefinition: starterFlow,
  },
  {
    flowName: "receipt_quality_gate",
    description: "Gate qualità scontrini",
    documentType: "Scontrino",
    isActive: false,
    format: "visual_v1",
    editable: true,
    metadata: {},
    createdAt: "2026-08-01T10:00:00Z",
    updatedAt: "2026-08-09T14:30:00Z",
    expectedUpdatedAt: "2026-08-09T14:30:00Z",
    schemaVersion: 1,
    flowDefinition: { ...starterFlow, flowName: "receipt_quality_gate" },
  },
  {
    flowName: "legacy_invoice_router",
    description: "Router legacy (sola lettura)",
    documentType: "Fattura",
    isActive: false,
    format: "legacy",
    editable: false,
    metadata: { legacy: true },
    createdAt: "2026-06-01T08:00:00Z",
    updatedAt: "2026-07-28T08:12:00Z",
    expectedUpdatedAt: "2026-07-28T08:12:00Z",
    flowDefinition: {
      flowName: "legacy_invoice_router",
      rules: [{ expression: "legacy" }],
    },
  },
];

export const mockFlowDetails: Record<string, FlowDetail> = Object.fromEntries(
  mockFlowItems.map((item) => [
    item.flowName,
    {
      ...item,
      flowDefinition: item.flowDefinition ?? { flowName: item.flowName },
    },
  ]),
);

export const mockSimulation: SimulationResult = {
  flowName: "invoice_opt_in_archive",
  simulation: true,
  count: 1,
  documents: [
    {
      protocol: 3141,
      documentType: "passive_cycle",
      sourceExportStatus: 4,
      stopped: true,
      stopReason:
        "Il trigger non corrisponde: tipo documento non ammesso. Nessuna azione successiva eseguita.",
      databaseWrites: 0,
      trace: [
        {
          nodeId: "invoice_in_validation",
          nodeType: "trigger.export_status",
          status: "executed",
          result: "false",
          details: {
            checks: [
              {
                criterion: "exportStatus",
                expected: [4],
                actual: 4,
                matched: true,
              },
              {
                criterion: "documentType",
                expected: ["Invoice"],
                actual: "passive_cycle",
                matched: false,
              },
              {
                criterion: "companyModuleEnabled",
                expected: true,
                actual: true,
                matched: true,
              },
            ],
            failedCriteria: ["documentType"],
          },
          plannedMutations: {},
        },
        {
          nodeId: "explicitly_ready",
          nodeType: "condition",
          status: "skipped",
          result: "not_reached",
          details: {
            reason: "Node not reached by the selected branch",
          },
        },
        {
          nodeId: "send_to_archive",
          nodeType: "action.update_export_status",
          status: "skipped",
          result: "not_reached",
          details: {
            reason: "Node not reached by the selected branch",
          },
        },
      ],
      plannedMutations: [],
    },
  ],
};

export const mockValidationOk: ValidationResult = {
  valid: true,
  flowName: starterFlow.flowName,
  nodes: starterFlow.nodes.length,
  edges: starterFlow.edges.length,
  issues: [],
};

export const mockConnections: HttpConnection[] = [
  {
    connectionName: "ifttt_dispatcher",
    baseUrlEnv: "IFTTT_WEBHOOK_BASE_URL",
    authType: "none",
    authConfig: {},
    defaultHeaders: {},
    allowedMethods: ["POST"],
    allowedPathPrefixes: ["/"],
    timeoutSeconds: 20,
    isActive: true,
  },
  {
    connectionName: "archive_api",
    baseUrl: "https://api.example.com",
    authType: "bearer_env",
    authConfig: { tokenEnv: "EXTERNAL_API_TOKEN" },
    defaultHeaders: { Accept: "application/json" },
    allowedMethods: ["GET", "POST"],
    allowedPathPrefixes: ["/v1/", "/webhooks/"],
    timeoutSeconds: 30,
    isActive: true,
  },
  {
    connectionName: "legacy_inactive",
    baseUrl: "https://legacy.example.com",
    authType: "api_key_env",
    authConfig: {
      headerName: "X-API-Key",
      valueEnv: "EXTERNAL_API_KEY",
    },
    defaultHeaders: {},
    allowedMethods: ["GET"],
    allowedPathPrefixes: ["/"],
    timeoutSeconds: 15,
    isActive: false,
  },
];
