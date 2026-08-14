import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { Braces, Download, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { BottomPanel, type BottomTab } from "@/features/flows/BottomPanel";
import { ConflictDialog } from "@/features/flows/ConflictDialog";
import { EditorToolbar } from "@/features/flows/EditorToolbar";
import { FlowCanvas } from "@/features/flows/FlowCanvas";
import { LegacyReadonlyView } from "@/features/flows/LegacyReadonlyView";
import { NodeCatalogPanel } from "@/features/flows/NodeCatalogPanel";
import { NodeConfigPanel } from "@/features/flows/NodeConfigPanel";
import {
  catalogNode,
  cloneFlow,
  createBlankFlow,
  defaultFieldValue,
  downloadJson,
  formatTriggerSummary,
  getFlowTriggerSummary,
  isVisualFlow,
  normalizeFlowDefinition,
  preliminaryValidate,
  sanitizeDocumentTypes,
  slug,
  toFlowEdges,
  toFlowNodes,
  type FlowNodeData,
} from "@/features/flows/flow-utils";
import {
  canEditFlows,
  canRunNow,
  canSimulate,
  canValidate,
  isReadOnlyRole,
} from "@/features/flows/permissions";
import { useCatalogQuery } from "@/features/flows/useCatalogQuery";
import { useFlowMutations } from "@/features/flows/useFlowMutations";
import { useConnectionsQuery } from "@/features/connections/useConnectionsQuery";
import {
  containsEmbeddedSecret,
  sanitizeHttpRequestConfig,
} from "@/features/connections/http-config";
import { RunConfirmDialog } from "@/features/simulation/RunConfirmDialog";
import { SimulationModal } from "@/features/simulation/SimulationModal";
import { useSimulationHighlight } from "@/features/simulation/useSimulationHighlight";
import { useRole } from "@/hooks/useRole";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { ApiError } from "@/services/api/client";
import { dispatcherApi, starterFlow, toValidationResult } from "@/services/api/dispatcher";
import type {
  FlowDefinition,
  FlowDetail,
  FlowNodeDefinition,
  SimulationDocument,
  ValidationResult,
} from "@/types/flow";

export function FlowEditorPage() {
  const { flowName: routeName } = useParams();
  const navigate = useNavigate();
  const isNew = !routeName || routeName === "new";
  const { role } = useRole();
  const catalogQuery = useCatalogQuery();
  const connectionsQuery = useConnectionsQuery();
  const mutations = useFlowMutations();
  const connections = useMemo(
    () => connectionsQuery.data?.data ?? [],
    [connectionsQuery.data?.data],
  );

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<FlowDetail | null>(null);
  const [legacyPayload, setLegacyPayload] = useState<unknown>(null);
  const [legacy, setLegacy] = useState(false);
  const [flow, setFlow] = useState<FlowDefinition>(() =>
    cloneFlow({ ...starterFlow, flowName: "nuovo_flusso" }),
  );
  const [isActive, setIsActive] = useState(false);
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] = useState("Fattura");
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState("");
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>("validation");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [simulationDocs, setSimulationDocs] = useState<SimulationDocument[]>(
    [],
  );
  const [simulationCount, setSimulationCount] = useState<number | null>(null);
  const [simulationIndex, setSimulationIndex] = useState(0);
  const [recentSimulationAt, setRecentSimulationAt] = useState<number | null>(
    null,
  );
  const [clock, setClock] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showSimModal, setShowSimModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [conflictRemote, setConflictRemote] = useState<FlowDetail | null>(null);
  const [protocol, setProtocol] = useState("");
  const [batchSize, setBatchSize] = useState(1);
  const [executeSimulationHttp, setExecuteSimulationHttp] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const history = useRef<FlowDefinition[]>([]);
  const future = useRef<FlowDefinition[]>([]);
  const [historyAvailability, setHistoryAvailability] = useState({
    canUndo: false,
    canRedo: false,
  });
  const fileInput = useRef<HTMLInputElement>(null);

  const catalog = catalogQuery.data?.data;
  const readOnly = legacy || isReadOnlyRole(role);
  const canEdit = canEditFlows(role) && !legacy;
  const selected = flow.nodes.find((node) => node.id === selectedId) || null;
  const activeSimulation = simulationDocs[simulationIndex] || null;
  const highlight = useSimulationHighlight(flow, activeSimulation);
  const unsaved = useUnsavedGuard(dirty);

  const syncGraph = useCallback(
    (
      next: FlowDefinition,
      options?: {
        issues?: Set<string>;
        tracedNodes?: Set<string>;
        dimmedNodes?: Set<string>;
        tracedEdges?: Set<string>;
        selectedId?: string | null;
      },
    ) => {
      if (!catalog) return;
      setNodes((current) => {
        const built = toFlowNodes(
          next,
          catalog,
          options?.tracedNodes,
          options?.issues,
          options?.dimmedNodes,
        );
        const selectedIds = new Set(
          current.filter((node) => node.selected).map((node) => node.id),
        );
        if (options?.selectedId) {
          selectedIds.clear();
          selectedIds.add(options.selectedId);
        } else if (options?.selectedId === null) {
          selectedIds.clear();
        }
        return built.map((node) => {
          const previous = current.find((item) => item.id === node.id);
          return {
            ...node,
            position: previous?.position ?? node.position,
            selected: selectedIds.has(node.id),
          };
        });
      });
      setEdges(
        toFlowEdges(next, options?.tracedEdges, {
          grayInactive: Boolean(options?.tracedEdges?.size),
        }),
      );
    },
    [catalog],
  );

  const commitFlow = useCallback(
    (next: FlowDefinition, remember = true) => {
      if (remember) {
        history.current.push(cloneFlow(flow));
        history.current = history.current.slice(-40);
        future.current = [];
        setHistoryAvailability({ canUndo: true, canRedo: false });
      }
      setFlow(next);
      syncGraph(next, { selectedId });
      setDirty(true);
      setValidation(null);
      setRecentSimulationAt(null);
    },
    [flow, selectedId, syncGraph],
  );

  const loadFlow = useCallback(async () => {
    if (!catalog) return;
    history.current = [];
    future.current = [];
    setHistoryAvailability({ canUndo: false, canRedo: false });
    setLoading(true);
    try {
      if (isNew) {
        const blank = cloneFlow({
          ...starterFlow,
          flowName: `nuovo_flusso_${Date.now().toString(36)}`,
        });
        setFlow(blank);
        setIsActive(false);
        setDescription("");
        setDocumentType("Fattura");
        setMetadata({});
        setExpectedUpdatedAt("");
        setLegacy(false);
        setLegacyPayload(null);
        setDirty(true);
        setSelectedId(blank.nodes[0]?.id || null);
        syncGraph(blank);
        return;
      }

      const remote = await dispatcherApi.getFlow(routeName!);
      setDetail(remote);
      setDescription(remote.description || "");
      setDocumentType(remote.documentType || "");
      setMetadata(remote.metadata || {});
      setIsActive(remote.isActive);
      setExpectedUpdatedAt(
        remote.expectedUpdatedAt || remote.updatedAt || "",
      );

      const definition = remote.flowDefinition;
      const isLegacy =
        remote.format === "legacy" ||
        remote.editable === false ||
        !isVisualFlow(definition);

      if (isLegacy) {
        setLegacy(true);
        setLegacyPayload(definition);
        const placeholder = createBlankFlow(remote.flowName);
        setFlow(placeholder);
        syncGraph(placeholder);
      } else {
        const draftRaw = localStorage.getItem(
          `dispatcher-draft:${remote.flowName}`,
        );
        const draft = draftRaw
          ? (JSON.parse(draftRaw) as {
              flow?: FlowDefinition;
              remoteUpdatedAt?: string;
            })
          : null;
        const remoteUpdatedAt =
          remote.expectedUpdatedAt || remote.updatedAt || "";
        const draftMatchesRemote =
          Boolean(draft?.flow) &&
          Boolean(draft?.remoteUpdatedAt) &&
          draft?.remoteUpdatedAt === remoteUpdatedAt;
        if (draftRaw && !draftMatchesRemote) {
          localStorage.removeItem(`dispatcher-draft:${remote.flowName}`);
        }
        const next = normalizeFlowDefinition(
          draftMatchesRemote && draft?.flow ? draft.flow : definition,
          remote.flowName,
        );
        setLegacy(false);
        setLegacyPayload(null);
        setFlow(next);
        setDirty(draftMatchesRemote);
        setSelectedId(next.nodes[0]?.id || null);
        syncGraph(next);
      }
    } catch (error) {
      setNotice(
        error instanceof ApiError
          ? error.message
          : "Impossibile caricare il flusso",
      );
    } finally {
      setLoading(false);
    }
  }, [catalog, isNew, routeName, syncGraph]);

  useEffect(() => {
    // Route hydration intentionally initializes the independent editor states.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFlow();
  }, [loadFlow]);

  useEffect(() => {
    if (!dirty || legacy) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(
        `dispatcher-draft:${flow.flowName}`,
        JSON.stringify({
          flow,
          isActive,
          remoteUpdatedAt: expectedUpdatedAt,
          savedAt: new Date().toISOString(),
        }),
      );
    }, 450);
    return () => window.clearTimeout(timer);
  }, [dirty, expectedUpdatedAt, flow, isActive, legacy]);

  useEffect(() => {
    if (!catalog || !activeSimulation) return;
    // Do not depend on selectedId here: rewriting nodes on selection would
    // fight React Flow and can trigger maximum update depth errors.
    // React Flow nodes are an external projection of the domain flow state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncGraph(flow, {
      tracedNodes: highlight.tracedNodes,
      dimmedNodes: highlight.dimmedNodes,
      tracedEdges: highlight.tracedEdges,
    });
  }, [
    activeSimulation,
    catalog,
    flow,
    highlight.dimmedNodes,
    highlight.tracedEdges,
    highlight.tracedNodes,
    syncGraph,
  ]);

  useEffect(() => {
    if (recentSimulationAt == null) return;
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [recentSimulationAt]);

  const updateNode = (
    patch: Partial<FlowNodeDefinition>,
    config?: Record<string, unknown>,
  ) => {
    if (!selected || readOnly) return;
    const next = cloneFlow(flow);
    const target = next.nodes.find((item) => item.id === selected.id);
    if (!target) return;
    const previousId = target.id;
    Object.assign(target, patch);
    if (config) {
      const merged = { ...target.config };
      for (const [key, value] of Object.entries(config)) {
        if (key === "documentTypes") {
          const sanitized = sanitizeDocumentTypes(value);
          if (sanitized) merged.documentTypes = sanitized;
          else delete merged.documentTypes;
          continue;
        }
        if (value === undefined) delete merged[key];
        else merged[key] = value;
      }
      target.config =
        target.type === "action.http_request"
          ? sanitizeHttpRequestConfig(merged)
          : merged;
    }
    if (patch.id && patch.id !== previousId) {
      next.edges = next.edges.map((edge) => ({
        ...edge,
        source: edge.source === previousId ? patch.id! : edge.source,
        target: edge.target === previousId ? patch.id! : edge.target,
      }));
      setSelectedId(patch.id);
    }
    commitFlow(next);
  };

  const addNode = (type: string) => {
    if (!catalog || readOnly) return;
    const next = cloneFlow(flow);
    const definition = catalogNode(catalog, type);
    const count = next.nodes.filter((node) => node.type === type).length + 1;
    const id = `${type.split(".").pop()?.replace(/[^a-z]/g, "_")}_${count}`;
    const config = Object.fromEntries(
      Object.entries(definition.configSchema)
        .map(([key, field]) => [key, defaultFieldValue(field, catalog, key)] as const)
        .filter((entry) => entry[1] !== undefined),
    );
    next.nodes.push({
      id,
      type,
      name: definition.label,
      config,
      position: { x: 280 + count * 40, y: 90 + count * 80 },
    });
    commitFlow(next);
    setSelectedId(id);
  };

  const duplicateNode = () => {
    if (!selected || readOnly) return;
    const next = cloneFlow(flow);
    const copy = cloneFlow({ ...flow, nodes: [selected] }).nodes[0];
    copy.id = `${selected.id}_copia`;
    copy.name = `${selected.name} (copia)`;
    copy.position = {
      x: (selected.position?.x || 0) + 40,
      y: (selected.position?.y || 0) + 60,
    };
    next.nodes.push(copy);
    commitFlow(next);
    setSelectedId(copy.id);
  };

  const deleteNode = () => {
    if (!selected || readOnly) return;
    if (catalogNode(catalog!, selected.type).category === "trigger") return;
    const next = cloneFlow(flow);
    next.nodes = next.nodes.filter((item) => item.id !== selected.id);
    next.edges = next.edges.filter(
      (edge) => edge.source !== selected.id && edge.target !== selected.id,
    );
    commitFlow(next);
    setSelectedId(null);
  };

  const onNodesChange = (changes: NodeChange<Node<FlowNodeData>>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
    const positions = changes.filter(
      (change) => change.type === "position" && change.position,
    );
    if (positions.length) {
      const next = cloneFlow(flow);
      positions.forEach((change) => {
        if (change.type === "position") {
          const item = next.nodes.find((node) => node.id === change.id);
          if (item && change.position) item.position = change.position;
        }
      });
      setFlow(next);
      setDirty(true);
    }
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
    if (changes.some((change) => change.type === "remove")) {
      const removed = new Set(
        changes.filter((c) => c.type === "remove").map((c) => c.id),
      );
      const next = cloneFlow(flow);
      next.edges = next.edges.filter(
        (edge, i) => !removed.has(`${edge.source}-${edge.target}-${i}`),
      );
      commitFlow(next);
    }
  };

  const onConnect = (connection: Connection) => {
    if (readOnly || !connection.source || !connection.target) return;
    const branch = (connection.sourceHandle || "always") as string;
    const next = cloneFlow(flow);
    next.edges.push({
      source: connection.source,
      target: connection.target,
      branch,
    });
    commitFlow(next);
    setEdges((current) => addEdge(connection, current));
  };

  const runValidation = async (
    flowToValidate: FlowDefinition,
  ): Promise<ValidationResult | null> => {
    if (!catalog) return null;
    setBottomOpen(true);
    setBottomTab("validation");
    const preliminary = preliminaryValidate(
      flowToValidate,
      catalog,
      connections,
    );
    if (preliminary.length) {
      const result = { valid: false, issues: preliminary };
      setValidation(result);
      syncGraph(flowToValidate, {
        issues: new Set(
          preliminary.map((i) => i.nodeId).filter(Boolean) as string[],
        ),
      });
      return result;
    }
    try {
      const result = isNew
        ? await mutations.validate.mutateAsync({
            flowDefinition: flowToValidate,
          })
        : await mutations.validateFlow.mutateAsync({
            flowName: flowToValidate.flowName,
            body: { flowDefinition: flowToValidate },
          });
      setValidation(result);
      syncGraph(flowToValidate, {
        issues: new Set(
          (result.issues || [])
            .map((i) => i.nodeId)
            .filter(Boolean) as string[],
        ),
      });
      return result;
    } catch (error) {
      const from422 = toValidationResult(error);
      if (from422) {
        setValidation(from422);
        syncGraph(flowToValidate, {
          issues: new Set(
            (from422.issues || [])
              .map((i) => i.nodeId)
              .filter(Boolean) as string[],
          ),
        });
        return from422;
      }
      const result = {
        valid: false,
        issues: [
          {
            message:
              error instanceof ApiError
                ? error.message
                : "Backend non raggiungibile. Verifica l'URL configurato.",
          },
        ],
      };
      setValidation(result);
      return result;
    }
  };

  const doValidate = async () => {
    setBusy("validate");
    try {
      await runValidation(flow);
    } finally {
      setBusy(null);
    }
  };

  const doSimulate = async () => {
    if (dirty) {
      setNotice(
        "Salva prima il JSON: la simulazione usa sempre il flusso salvato nel database.",
      );
      return;
    }
    setShowSimModal(false);
    setBusy("simulate");
    setBottomOpen(true);
    setBottomTab("simulation");
    try {
      const result = await mutations.simulate.mutateAsync({
        flowName: flow.flowName,
        body: {
          flowName: flow.flowName,
          protocol: protocol ? Number(protocol) : undefined,
          batchSize,
          executeHttp: executeSimulationHttp,
        },
      });
      const rawDocs = Array.isArray(result.data.documents)
        ? result.data.documents
        : result.data.trace
          ? [result.data]
          : [];
      const docs = rawDocs.map((document) => ({
        ...document,
        databaseWrites:
          document.databaseWrites ?? result.data.databaseWrites,
        externalCallsAttempted:
          document.externalCallsAttempted ?? result.data.externalCallsAttempted,
        externalCallsSucceeded:
          document.externalCallsSucceeded ?? result.data.externalCallsSucceeded,
      }));
      const count =
        typeof result.data.count === "number" ? result.data.count : docs.length;
      setSimulationDocs(docs);
      setSimulationCount(count);
      setSimulationIndex(0);
      setRecentSimulationAt(Date.now());
    } catch (error) {
      setNotice(
        error instanceof ApiError ? error.message : "Simulazione non riuscita",
      );
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!catalog) {
      setNotice("Catalogo non disponibile");
      return;
    }
    const flowToSave = normalizeFlowDefinition(flow, flow.flowName);
    setBusy("save");
    try {
      const validationResult = await runValidation(flowToSave);
      if (!validationResult || validationResult.valid !== true) {
        setNotice("Correggi gli errori di validazione prima di salvare");
        return;
      }
      if (isNew || !detail) {
        const created = await mutations.createFlow.mutateAsync({
          flowName: flowToSave.flowName,
          description,
          documentType,
          isActive: false,
          flowDefinition: flowToSave,
          metadata,
        });
        setDetail(created);
        setExpectedUpdatedAt(
          created.expectedUpdatedAt || created.updatedAt || "",
        );
        setFlow(flowToSave);
        setDirty(false);
        localStorage.removeItem(`dispatcher-draft:${flowToSave.flowName}`);
        setNotice("Flusso creato");
        navigate(`/flows/${encodeURIComponent(flowToSave.flowName)}`, {
          replace: true,
        });
      } else {
        const updated = await mutations.updateFlow.mutateAsync({
          flowName: flowToSave.flowName,
          body: {
            flowName: flowToSave.flowName,
            description,
            documentType,
            isActive,
            flowDefinition: flowToSave,
            metadata,
            expectedUpdatedAt,
          },
        });
        setDetail(updated);
        setExpectedUpdatedAt(
          updated.expectedUpdatedAt || updated.updatedAt || "",
        );
        setFlow(flowToSave);
        setDirty(false);
        localStorage.removeItem(`dispatcher-draft:${flowToSave.flowName}`);
        setNotice("Flusso salvato");
      }
    } catch (error) {
      if (error instanceof ApiError && error.isConflict) {
        setShowConflict(true);
        try {
          const remote = await dispatcherApi.getFlow(flow.flowName);
          setConflictRemote(remote);
        } catch {
          setConflictRemote(null);
        }
      } else if (error instanceof ApiError && error.isValidation) {
        const from422 = toValidationResult(error);
        if (from422) {
          setValidation(from422);
          setBottomOpen(true);
          setBottomTab("validation");
          setNotice("Correggi gli errori di validazione prima di salvare");
        } else {
          setNotice(error.message);
        }
      } else {
        setNotice(
          error instanceof ApiError ? error.message : "Salvataggio non riuscito",
        );
      }
    } finally {
      setBusy(null);
    }
  };

  const doRun = async () => {
    setShowRunModal(false);
    setBusy("run");
    try {
      await mutations.run.mutateAsync({
        flowName: flow.flowName,
        body: {
          flowName: flow.flowName,
          batchSize,
          dryRun: false,
        },
      });
      setNotice("Esecuzione accettata dal backend");
    } catch (error) {
      setNotice(
        error instanceof ApiError ? error.message : "Esecuzione non riuscita",
      );
    } finally {
      setBusy(null);
    }
  };

  const undo = () => {
    const previous = history.current.pop();
    if (!previous) return;
    future.current.push(cloneFlow(flow));
    setHistoryAvailability({
      canUndo: history.current.length > 0,
      canRedo: true,
    });
    setFlow(previous);
    syncGraph(previous);
    setDirty(true);
  };

  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    history.current.push(cloneFlow(flow));
    setHistoryAvailability({
      canUndo: true,
      canRedo: future.current.length > 0,
    });
    setFlow(next);
    syncGraph(next);
    setDirty(true);
  };

  const openJson = () => {
    setJsonDraft(JSON.stringify(flow, null, 2));
    setJsonError(null);
    setBottomOpen(true);
    setBottomTab("json");
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonDraft) as FlowDefinition;
      if (containsEmbeddedSecret(parsed)) {
        throw new Error(
          "Il JSON del flusso non può contenere segreti: usa una connessione configurata tramite variabili d'ambiente",
        );
      }
      if (parsed.schemaVersion !== 1) {
        throw new Error("È supportato solo schemaVersion: 1");
      }
      commitFlow(normalizeFlowDefinition(parsed, flow.flowName));
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "JSON non valido");
    }
  };

  const triggerCriteria = useMemo(() => getFlowTriggerSummary(flow), [flow]);
  const triggerSummaryText = useMemo(() => {
    const trigger = flow.nodes.find(
      (node) => node.type === "trigger.export_status",
    );
    return trigger ? formatTriggerSummary(trigger.config) : null;
  }, [flow]);

  const hasRecentSimulation =
    recentSimulationAt != null && clock - recentSimulationAt < 30 * 60_000;

  const runEnabled = canRunNow({
    role,
    legacy,
    dirty,
    valid: validation?.valid === true,
    hasRecentSimulation,
  });

  const goBack = async () => {
    const ok = await unsaved.requestLeave();
    if (ok || !dirty) navigate("/");
  };

  if (catalogQuery.isError) {
    return (
      <main className="app editor-page">
        <div className="empty">
          Impossibile caricare il catalogo nodi. Torna all&apos;elenco e riprova.
        </div>
      </main>
    );
  }

  if (loading || !catalog) {
    return (
      <main className="app editor-page">
        <div className="empty">Caricamento…</div>
      </main>
    );
  }

  return (
    <main className="app editor-page">
      <EditorToolbar
        flowName={flow.flowName}
        isActive={isActive}
        dirty={dirty}
        legacy={legacy}
        busy={busy}
        canEdit={canEdit}
        canValidate={canValidate(role)}
        canSimulate={canSimulate(role) && !dirty}
        canRun={runEnabled}
        canUndo={historyAvailability.canUndo}
        canRedo={historyAvailability.canRedo}
        triggerStatusLine={triggerCriteria?.statusLine}
        triggerTypesLine={triggerCriteria?.typesLine}
        onBack={() => void goBack()}
        onRename={(value) => {
          const next = cloneFlow(flow);
          next.flowName = slug(value);
          commitFlow(next);
        }}
        onUndo={undo}
        onRedo={redo}
        onValidate={() => void doValidate()}
        onSimulate={() => setShowSimModal(true)}
        onSave={() => void save()}
        onRun={() => setShowRunModal(true)}
      />

      {legacy ? (
        <LegacyReadonlyView
          flowName={detail?.flowName || flow.flowName}
          definition={legacyPayload}
        />
      ) : (
        <section className={`workspace ${bottomOpen ? "with-bottom" : ""}`}>
          <NodeCatalogPanel
            catalog={catalog}
            flow={flow}
            disabled={readOnly}
            onAdd={addNode}
          />
          <div className="canvas-wrap">
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              readOnly={readOnly}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelect={setSelectedId}
            />
            <div className="canvas-toolbar">
              <button type="button" onClick={openJson}>
                <Braces size={15} /> JSON
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={15} /> Importa
              </button>
              <button
                type="button"
                onClick={() => downloadJson(`${flow.flowName}.json`, flow)}
              >
                <Download size={15} /> Esporta
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void file.text().then((text) => {
                    try {
                      const parsed = JSON.parse(text) as FlowDefinition;
                      if (containsEmbeddedSecret(parsed)) {
                        throw new Error(
                          "Il JSON del flusso non può contenere segreti: usa una connessione configurata tramite variabili d'ambiente",
                        );
                      }
                      if (parsed.schemaVersion !== 1) throw new Error();
                      commitFlow(parsed);
                      setNotice("Flusso importato");
                    } catch {
                      setNotice(
                        "Il file non contiene un flusso schemaVersion 1 valido",
                      );
                    }
                  });
                }}
              />
            </div>
          </div>
          <NodeConfigPanel
            node={selected}
            catalog={catalog}
            disabled={readOnly}
            issues={(validation?.issues || []).filter(
              (issue) => issue.nodeId && issue.nodeId === selected?.id,
            )}
            onClose={() => setSelectedId(null)}
            onUpdate={updateNode}
            onDuplicate={duplicateNode}
            onDelete={deleteNode}
          />
        </section>
      )}

      {!legacy ? (
        <BottomPanel
          open={bottomOpen}
          tab={bottomTab}
          onToggle={() => setBottomOpen((value) => !value)}
          onTabChange={(tab) => {
            if (tab === "json") openJson();
            else setBottomTab(tab);
          }}
          validation={validation}
          validationLoading={busy === "validate"}
          simulationDocs={simulationDocs}
          simulationCount={simulationCount}
          simulationIndex={simulationIndex}
          onSimulationIndexChange={setSimulationIndex}
          simulationLoading={busy === "simulate"}
          triggerSummary={triggerSummaryText}
          jsonDraft={jsonDraft}
          jsonError={jsonError}
          onJsonChange={setJsonDraft}
          onApplyJson={applyJson}
          readOnly={readOnly}
        />
      ) : null}

      <SimulationModal
        open={showSimModal}
        protocol={protocol}
        batchSize={batchSize}
        executeHttp={executeSimulationHttp}
        busy={busy === "simulate"}
        onProtocolChange={setProtocol}
        onBatchSizeChange={setBatchSize}
        onExecuteHttpChange={setExecuteSimulationHttp}
        onClose={() => setShowSimModal(false)}
        onSubmit={() => void doSimulate()}
      />

      <RunConfirmDialog
        open={showRunModal}
        flowName={flow.flowName}
        batchSize={batchSize}
        busy={busy === "run"}
        onClose={() => setShowRunModal(false)}
        onConfirm={() => void doRun()}
      />

      <ConflictDialog
        open={showConflict}
        onCancel={() => setShowConflict(false)}
        onReload={() => {
          setShowConflict(false);
          void loadFlow();
        }}
        onCompare={() => {
          setBottomOpen(true);
          setBottomTab("json");
          setJsonDraft(
            JSON.stringify(
              {
                locale: flow,
                remoto: conflictRemote?.flowDefinition ?? null,
              },
              null,
              2,
            ),
          );
          setShowConflict(false);
        }}
      />

      {unsaved.pendingLeave ? (
        <ConfirmDialog
          title="Modifiche non salvate"
          description="Hai modifiche non salvate. Vuoi abbandonarle?"
          confirmLabel="Abbandona"
          danger
          onCancel={unsaved.cancelLeave}
          onConfirm={unsaved.confirmLeave}
        />
      ) : null}

      {notice ? <Toast message={notice} onClose={() => setNotice(null)} /> : null}
    </main>
  );
}
