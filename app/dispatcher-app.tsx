"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  ArrowLeft,
  Braces,
  Check,
  ChevronDown,
  CircleStop,
  Clock3,
  Copy,
  Database,
  Download,
  FileJson,
  GitBranch,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { api } from "./api";
import { starterFlow } from "./mock-data";
import type {
  Branch,
  Catalog,
  CatalogConfigField,
  CatalogNodeType,
  FlowDefinition,
  FlowNodeDefinition,
  FlowNodeType,
  FlowSummary,
  Role,
  SimulationDocument,
  ValidationResult,
} from "./types";
import { mockCatalog } from "./mock-data";

const CATEGORY_META: Record<string, { icon: typeof Zap; color: string }> = {
  trigger: { icon: Zap, color: "violet" },
  logic: { icon: GitBranch, color: "amber" },
  action: { icon: RefreshCw, color: "blue" },
  control: { icon: CircleStop, color: "slate" },
};
const catalogNode = (catalog: Catalog, type: string): CatalogNodeType =>
  catalog.nodeTypes.find((item) => item.type === type) || {
    type,
    category: "action",
    label: type,
    description: "Nodo configurabile",
    configSchema: {},
    outputs: ["always"],
  };
const nodeVisual = (definition: CatalogNodeType) =>
  CATEGORY_META[definition.category] || { icon: Settings2, color: "slate" };

type NodeData = {
  definition: FlowNodeDefinition;
  catalogDefinition: CatalogNodeType;
  traced?: boolean;
  issue?: boolean;
};
const cloneFlow = (flow: FlowDefinition): FlowDefinition =>
  JSON.parse(JSON.stringify(flow));
const slug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
const toFlowNodes = (
  flow: FlowDefinition,
  catalog: Catalog,
  traced = new Set<string>(),
  issues = new Set<string>(),
): Node<NodeData>[] =>
  flow.nodes.map((item, index) => ({
    id: item.id,
    type: "flowNode",
    position: item.position || { x: 80 + index * 280, y: 180 },
    data: {
      definition: item,
      catalogDefinition: catalogNode(catalog, item.type),
      traced: traced.has(item.id),
      issue: issues.has(item.id),
    },
  }));
const toFlowEdges = (
  flow: FlowDefinition,
  traced = new Set<string>(),
): Edge[] =>
  flow.edges.map((edge, index) => {
    const id = `${edge.source}-${edge.target}-${index}`;
    const active = traced.has(id);
    return {
      id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.branch === "always" ? undefined : edge.branch,
    label: edge.branch === "always" ? undefined : edge.branch.toUpperCase(),
      animated: active,
      style: {
        stroke: active ? "#17a673" : "#aeb7c5",
        strokeWidth: active ? 3 : 1.8,
      },
      labelStyle: {
        fill: edge.branch === "true" ? "#11835b" : "#6a7482",
        fontWeight: 700,
        fontSize: 10,
      },
    };
  });

function FlowNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const def = data.definition;
  const catalogDefinition = data.catalogDefinition;
  const meta = nodeVisual(catalogDefinition);
  const Icon = meta.icon;
  const detail =
    def.type === "trigger.export_status"
      ? `Stati: ${((def.config.exportStatuses as number[]) || []).join(", ")}`
      : def.type === "condition"
        ? `${String(def.config.field || "Campo")} · ${String(def.config.operator || "eq")}`
        : def.type === "action.update_export_status"
          ? `Nuovo stato: ${String(def.config.exportStatus ?? "—")}`
          : "Nessuna modifica";
  return (
    <div
      className={`flow-node ${meta.color} ${selected ? "selected" : ""} ${data.traced ? "traced" : ""} ${data.issue ? "issue" : ""}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-icon">
        <Icon size={17} />
      </div>
      <div className="node-copy">
        <span>{catalogDefinition.label}</span>
        <strong>{def.name}</strong>
        <small>{detail}</small>
      </div>
      {catalogDefinition.outputs.map((output, index) => (
        <div key={output}>
          <Handle
            id={output === "always" ? undefined : output}
            type="source"
            position={Position.Right}
            style={{
              top: `${((index + 1) / (catalogDefinition.outputs.length + 1)) * 100}%`,
              background: output === "true" ? "#17a673" : "#84909f",
            }}
          />
          {output !== "always" && (
            <i
              className={`port-label ${output}`}
              style={{
                top: `${((index + 1) / (catalogDefinition.outputs.length + 1)) * 100 - 6}%`,
              }}
            >
              {output.toUpperCase()}
            </i>
          )}
        </div>
      ))}
      {data.issue && <span className="node-error">!</span>}
    </div>
  );
}

export function DispatcherApp() {
  const [catalog, setCatalog] = useState<Catalog>(mockCatalog);
  const [catalogSource, setCatalogSource] = useState<"api" | "mock">("mock");
  const [page, setPage] = useState<"list" | "editor">("list");
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"api" | "mock">("api");
  const [search, setSearch] = useState("");
  const [flow, setFlow] = useState<FlowDefinition>(() =>
    cloneFlow(starterFlow),
  );
  const [active, setActive] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(
    "explicitly_ready",
  );
  const [dirty, setDirty] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [role, setRole] = useState<Role>("operator");
  const [nodes, setNodes] = useState<Node<NodeData>[]>(() =>
    toFlowNodes(starterFlow, mockCatalog),
  );
  const [edges, setEdges] = useState<Edge[]>(() => toFlowEdges(starterFlow));
  const [bottomOpen, setBottomOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<
    "validation" | "simulation" | "json"
  >("validation");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [simulation, setSimulation] = useState<SimulationDocument | null>(null);
  const [busy, setBusy] = useState<"validate" | "simulate" | "save" | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [showSimModal, setShowSimModal] = useState(false);
  const [protocol, setProtocol] = useState("123");
  const [batchSize, setBatchSize] = useState(1);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const history = useRef<FlowDefinition[]>([]);
  const future = useRef<FlowDefinition[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api.listFlows(), api.getCatalog()])
      .then(([flowResult, catalogResult]) => {
        setFlows(flowResult.data);
        setSource(flowResult.source);
        setCatalog(catalogResult.data);
        setCatalogSource(catalogResult.source);
        setNodes(toFlowNodes(flow, catalogResult.data));
      })
      .catch(() => setNotice("Impossibile caricare flussi o catalogo"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!dirty || legacy) return;
    const timer = window.setTimeout(
      () =>
        localStorage.setItem(
          `dispatcher-draft:${flow.flowName}`,
          JSON.stringify({ flow, active, savedAt: new Date().toISOString() }),
        ),
      450,
    );
    return () => window.clearTimeout(timer);
  }, [flow, active, dirty, legacy]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const sync = useCallback(
    (next: FlowDefinition, remember = true) => {
      if (remember) {
        history.current.push(cloneFlow(flow));
        history.current = history.current.slice(-40);
        future.current = [];
      }
      setFlow(next);
      setNodes(toFlowNodes(next, catalog));
      setEdges(toFlowEdges(next));
      setDirty(true);
      setValidation(null);
    },
    [flow, catalog],
  );
  const selected = flow.nodes.find((node) => node.id === selectedId) || null;
  const openFlow = (summary: FlowSummary) => {
    const isLegacy =
      summary.schemaVersion !== 1 ||
      !summary.definition ||
      !("schemaVersion" in summary.definition);
    const definition = isLegacy
      ? cloneFlow(starterFlow)
      : cloneFlow(summary.definition as FlowDefinition);
    const draftRaw = !isLegacy
      ? localStorage.getItem(`dispatcher-draft:${summary.flowName}`)
      : null;
    const draft = draftRaw ? JSON.parse(draftRaw) : null;
    const next = draft?.flow || definition;
    setFlow(next);
    setNodes(toFlowNodes(next, catalog));
    setEdges(toFlowEdges(next));
    setActive(summary.active);
    setLegacy(isLegacy);
    setDirty(Boolean(draft));
    setSelectedId(next.nodes[0]?.id || null);
    setPage("editor");
    setValidation(null);
    setSimulation(null);
  };
  const newFlow = () => {
    const next = cloneFlow(starterFlow);
    next.flowName = `nuovo_flusso_${flows.length + 1}`;
    sync(next, false);
    setActive(false);
    setLegacy(false);
    setPage("editor");
  };
  const updateNode = (
    patch: Partial<FlowNodeDefinition>,
    config?: Record<string, unknown>,
  ) => {
    if (!selected) return;
    const next = cloneFlow(flow);
    const target = next.nodes.find((item) => item.id === selected.id)!;
    Object.assign(target, patch);
    if (config) target.config = { ...target.config, ...config };
    sync(next);
  };
  const addNode = (type: FlowNodeType) => {
    const next = cloneFlow(flow);
    const definition = catalogNode(catalog, type);
    const count = next.nodes.filter((node) => node.type === type).length + 1;
    const id = `${type
      .split(".")
      .pop()
      ?.replace(/[^a-z]/g, "_")}_${count}`;
    const config = Object.fromEntries(
      Object.entries(definition.configSchema).map(([key, field]) => [
        key,
        defaultFieldValue(field, catalog),
      ]),
    );
    next.nodes.push({
      id,
      type,
      name: definition.label,
      config,
      position: { x: 280 + count * 40, y: 90 + count * 80 },
    });
    sync(next);
    setSelectedId(id);
  };
  const duplicateNode = () => {
    if (!selected) return;
    const next = cloneFlow(flow);
    const copy = cloneFlow({ ...flow, nodes: [selected] }).nodes[0];
    copy.id = `${selected.id}_copia`;
    copy.name = `${selected.name} (copia)`;
    copy.position = {
      x: (selected.position?.x || 0) + 40,
      y: (selected.position?.y || 0) + 60,
    };
    next.nodes.push(copy);
    sync(next);
    setSelectedId(copy.id);
  };
  const deleteNode = () => {
    if (!selected || selected.type === "trigger.export_status") return;
    const next = cloneFlow(flow);
    next.nodes = next.nodes.filter((item) => item.id !== selected.id);
    next.edges = next.edges.filter(
      (edge) => edge.source !== selected.id && edge.target !== selected.id,
    );
    sync(next);
    setSelectedId(null);
  };
  const onNodesChange = (changes: NodeChange<Node<NodeData>>[]) => {
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
      sync(next);
    }
  };
  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const branch = (connection.sourceHandle || "always") as Branch;
    const next = cloneFlow(flow);
    next.edges.push({
      source: connection.source,
      target: connection.target,
      branch,
    });
    sync(next);
    setEdges((current) => addEdge(connection, current));
  };
  const doValidate = async () => {
    setBusy("validate");
    setBottomOpen(true);
    setBottomTab("validation");
    const preliminary = preliminaryValidate(flow, catalog);
    if (preliminary.length) {
      const result = { valid: false, issues: preliminary };
      setValidation(result);
      setNodes(
        toFlowNodes(
          flow,
          catalog,
          new Set(),
          new Set(preliminary.map((i) => i.nodeId).filter(Boolean) as string[]),
        ),
      );
      setBusy(null);
      return;
    }
    try {
      const result = await api.validate(flow);
      setValidation(result);
      const issues = new Set(
        result.issues?.map((i) => i.nodeId).filter(Boolean) as string[],
      );
      setNodes(toFlowNodes(flow, catalog, new Set(), issues));
    } catch {
      setValidation({
        valid: false,
        issues: [
          { message: "Backend non raggiungibile. Verifica l'URL configurato." },
        ],
      });
    } finally {
      setBusy(null);
    }
  };
  const doSimulate = async () => {
    setShowSimModal(false);
    setBusy("simulate");
    setBottomOpen(true);
    setBottomTab("simulation");
    try {
      const result = await api.simulate(
        flow.flowName,
        protocol ? Number(protocol) : undefined,
        batchSize,
      );
      const doc = result.data.documents?.[0] || result.data;
      setSimulation(doc);
      const tracedNodes = new Set(
        (doc.trace || [])
          .map((step) => step.nodeId || step.node)
          .filter(Boolean) as string[],
      );
      const tracedEdges = new Set<string>();
      for (let i = 0; i < (doc.trace || []).length - 1; i++) {
        const a = doc.trace![i];
        const b = doc.trace![i + 1];
        const edgeIndex = flow.edges.findIndex(
          (edge) =>
            edge.source === (a.nodeId || a.node) &&
            edge.target === (b.nodeId || b.node),
        );
        if (edgeIndex >= 0)
          tracedEdges.add(
            `${flow.edges[edgeIndex].source}-${flow.edges[edgeIndex].target}-${edgeIndex}`,
          );
      }
      setNodes(toFlowNodes(flow, catalog, tracedNodes));
      setEdges(toFlowEdges(flow, tracedEdges));
      if (result.source === "mock")
        setNotice("Simulazione demo: il backend non è raggiungibile");
    } catch {
      setNotice("Simulazione non riuscita");
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    if (active && validation?.valid !== true) {
      setNotice("Valida il flusso prima di salvarlo come attivo");
      return;
    }
    setBusy("save");
    try {
      await api.updateFlow(flow.flowName, flow, active);
      setDirty(false);
      localStorage.removeItem(`dispatcher-draft:${flow.flowName}`);
      setNotice("Flusso salvato");
    } catch {
      setNotice("API CRUD non ancora disponibile: bozza conservata localmente");
    } finally {
      setBusy(null);
    }
  };
  const undo = () => {
    const previous = history.current.pop();
    if (!previous) return;
    future.current.push(cloneFlow(flow));
    setFlow(previous);
    setNodes(toFlowNodes(previous, catalog));
    setEdges(toFlowEdges(previous));
    setDirty(true);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    history.current.push(cloneFlow(flow));
    setFlow(next);
    setNodes(toFlowNodes(next, catalog));
    setEdges(toFlowEdges(next));
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
      const parsed = JSON.parse(jsonDraft);
      if (parsed.schemaVersion !== 1)
        throw new Error("È supportato solo schemaVersion: 1");
      sync(parsed);
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "JSON non valido");
    }
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(flow, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${flow.flowName}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const importJson = (file?: File) => {
    if (!file) return;
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text);
        if (parsed.schemaVersion !== 1) throw new Error();
        sync(parsed);
        setNotice("Flusso importato");
      } catch {
        setNotice("Il file non contiene un flusso schemaVersion 1 valido");
      }
    });
  };
  const filtered = useMemo(
    () =>
      flows.filter(
        (item) =>
          item.flowName.toLowerCase().includes(search.toLowerCase()) ||
          item.documentType.toLowerCase().includes(search.toLowerCase()),
      ),
    [flows, search],
  );

  if (page === "list")
    return (
      <main className="app list-page">
        <header className="list-header">
          <div className="brand">
            <span className="brand-logo" aria-label="Lucy" />
            <div className="brand-copy">
              <strong>Extractor ML</strong>
              <small>Dispatcher</small>
            </div>
          </div>
          <div className="header-actions">
            <span className="environment">
              <i /> Ambiente locale
            </span>
            <select
              aria-label="Ruolo"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="operator">Operator</option>
            </select>
            <div className="user-chip" aria-label="Utente">
              <span className="avatar">AG</span>
              <span>
                <b>Alessandro Garbossa</b>
                <small>Profilo</small>
              </span>
            </div>
          </div>
        </header>
        <nav className="app-tabs" aria-label="Sezioni">
          <button type="button" className="active">
            Dispatcher
          </button>
        </nav>
        <section className="list-content">
          <div className="hero-row">
            <div>
              <p className="eyebrow">AUTOMAZIONI DOCUMENTALI</p>
              <h1>Flussi del dispatcher</h1>
              <p>
                Configura, valida e simula il percorso dei documenti senza
                toccare il database.
              </p>
            </div>
            <button
              className="primary"
              onClick={newFlow}
              disabled={role === "viewer"}
            >
              <Plus size={17} /> Nuovo flusso
            </button>
          </div>
          <div className="toolbar">
            <label className="search">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per nome o tipo documento…"
              />
            </label>
            <div className="filter-buttons">
              <button>
                Stato <ChevronDown size={14} />
              </button>
              <button>
                Tipo documento <ChevronDown size={14} />
              </button>
            </div>
          </div>
          {(source === "mock" || catalogSource === "mock") && (
            <div className="mock-banner">
              <Database size={16} />
              <span>Modalità sviluppo · dati demo</span>
              <small>
                {catalogSource === "mock" ? "Catalogo demo: GET /catalog non raggiungibile." : "Le API CRUD del backend non sono ancora disponibili."}
              </small>
            </div>
          )}
          <div className="flow-table">
            <div className="table-head">
              <span>Nome flusso</span>
              <span>Stato</span>
              <span>Tipo documento</span>
              <span>Ultima modifica</span>
              <span />
            </div>
            {loading ? (
              <div className="empty">
                <RefreshCw className="spin" /> Caricamento flussi…
              </div>
            ) : (
              filtered.map((item) => {
                const isLegacy = item.schemaVersion !== 1;
                return (
                  <button
                    className="table-row"
                    key={item.flowName}
                    onClick={() => openFlow(item)}
                  >
                    <span className="flow-name">
                      <i className={isLegacy ? "legacy-icon" : "flow-icon"}>
                        {isLegacy ? (
                          <FileJson size={17} />
                        ) : (
                          <GitBranch size={17} />
                        )}
                      </i>
                      <b>{item.flowName}</b>
                      <small>
                        {isLegacy
                          ? "Legacy — sola lettura"
                          : `${(item.definition as FlowDefinition)?.nodes?.length || 0} nodi`}
                      </small>
                    </span>
                    <span>
                      <em
                        className={`status ${item.active ? "active" : "inactive"}`}
                      >
                        <i />
                        {item.active ? "Attivo" : "Inattivo"}
                      </em>
                    </span>
                    <span>{item.documentType}</span>
                    <span className="date">
                      <Clock3 size={14} />{" "}
                      {new Intl.DateTimeFormat("it-IT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(item.updatedAt))}
                    </span>
                    <span>
                      <MoreHorizontal size={18} />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </main>
    );

  return (
    <main className="app editor-page">
      <header className="editor-header">
        <button
          className="icon-button"
          aria-label="Torna ai flussi"
          onClick={() => {
            if (
              !dirty ||
              confirm("Hai modifiche non salvate. Vuoi abbandonarle?")
            )
              setPage("list");
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="editor-title">
          <input
            value={flow.flowName}
            disabled={legacy || role === "viewer"}
            onChange={(e) => {
              const next = cloneFlow(flow);
              next.flowName = slug(e.target.value);
              sync(next);
            }}
          />
          <span className={active ? "on" : "off"}>
            {active ? "Attivo" : "Inattivo"}
          </span>
          {dirty && <small>Modifiche non salvate</small>}
          {legacy && <strong>Legacy — sola lettura</strong>}
        </div>
        <div className="editor-actions">
          <button
            className="icon-button"
            title="Annulla"
            onClick={undo}
            disabled={!history.current.length}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            title="Ripristina"
            onClick={redo}
            disabled={!future.current.length}
          >
            <Redo2 size={17} />
          </button>
          <button onClick={doValidate} disabled={legacy || busy !== null}>
            <ShieldCheck size={16} />{" "}
            {busy === "validate" ? "Validazione…" : "Valida"}
          </button>
          <button
            onClick={() => setShowSimModal(true)}
            disabled={legacy || busy !== null}
          >
            <Play size={16} /> Simula
          </button>
          <button
            className="primary"
            onClick={save}
            disabled={legacy || role === "viewer" || busy !== null}
          >
            <Save size={16} /> {busy === "save" ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </header>
      {legacy ? (
        <section className="legacy-view">
          <FileJson size={35} />
          <h2>Flusso legacy in sola lettura</h2>
          <p>
            Questo flusso usa regole o espressioni non compatibili con il nuovo
            motore. Puoi consultarlo, ma non modificarlo o eseguirlo dalla
            canvas.
          </p>
          <pre>
            {JSON.stringify(
              flows.find((f) => f.flowName === flow.flowName)?.definition || {},
              null,
              2,
            )}
          </pre>
        </section>
      ) : (
        <section className={`workspace ${bottomOpen ? "with-bottom" : ""}`}>
          <aside className="node-catalog">
            <div className="panel-heading">
              <span>
                <Plus size={15} /> Nodi
              </span>
              <small>Trascina o aggiungi</small>
            </div>
            {catalog.nodeTypes.map((definition) => {
              const type = definition.type;
              const meta = nodeVisual(definition);
              const Icon = meta.icon;
              return (
                <button
                  key={type}
                  className={`catalog-node ${meta.color}`}
                  onClick={() => addNode(type)}
                  disabled={
                    role === "viewer" ||
                    (definition.category === "trigger" &&
                      flow.nodes.some(
                        (n) => catalogNode(catalog, n.type).category === "trigger",
                      ))
                  }
                >
                  <i>
                    <Icon size={17} />
                  </i>
                  <span>
                    <b>{definition.label}</b>
                    <small>{definition.description}</small>
                  </span>
                  <Plus size={15} />
                </button>
              );
            })}
            <div className="catalog-tip">
              <Zap size={14} />
              <span>
                I flussi devono avere un solo trigger e non possono contenere
                cicli.
              </span>
            </div>
          </aside>
          <div className="canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={{ flowNode: FlowNode }}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              fitView
              multiSelectionKeyCode="Shift"
              deleteKeyCode={role === "viewer" ? null : "Delete"}
            >
              <Background color="#dbe1e9" gap={22} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) =>
                  nodeVisual((node.data as NodeData).catalogDefinition).color === "violet"
                    ? "#7557d3"
                    : "#6d86a5"
                }
              />
            </ReactFlow>
            <div className="canvas-toolbar">
              <button onClick={openJson}>
                <Braces size={15} /> JSON
              </button>
              <button onClick={() => fileInput.current?.click()}>
                <Upload size={15} /> Importa
              </button>
              <button onClick={exportJson}>
                <Download size={15} /> Esporta
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => importJson(e.target.files?.[0])}
              />
            </div>
          </div>
          <aside className="config-panel">
            <div className="panel-heading">
              <span>
                <Settings2 size={15} /> Configurazione
              </span>
              {selected && (
                <button
                  className="close-button"
                  onClick={() => setSelectedId(null)}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {selected ? (
              <DynamicNodeForm
                node={selected}
                catalog={catalog}
                disabled={role === "viewer"}
                onUpdate={updateNode}
                onDuplicate={duplicateNode}
                onDelete={deleteNode}
              />
            ) : (
              <div className="no-selection">
                <Settings2 size={26} />
                <b>Nessun nodo selezionato</b>
                <p>Seleziona un nodo sulla canvas per configurarlo.</p>
              </div>
            )}
          </aside>
        </section>
      )}{" "}
      {!legacy && (
        <button
          className={`bottom-toggle ${bottomOpen ? "open" : ""}`}
          onClick={() => setBottomOpen(!bottomOpen)}
        >
          <Activity size={15} /> Risultati <ChevronDown size={15} />
        </button>
      )}
      {!legacy && bottomOpen && (
        <section className="bottom-panel">
          <div className="bottom-tabs">
            <button
              className={bottomTab === "validation" ? "active" : ""}
              onClick={() => setBottomTab("validation")}
            >
              <ShieldCheck size={15} /> Validazione{" "}
              {validation && <i className={validation.valid ? "ok" : "bad"} />}
            </button>
            <button
              className={bottomTab === "simulation" ? "active" : ""}
              onClick={() => setBottomTab("simulation")}
            >
              <Play size={15} /> Simulazione
            </button>
            <button
              className={bottomTab === "json" ? "active" : ""}
              onClick={openJson}
            >
              <Braces size={15} /> JSON
            </button>
            <button
              className="close-bottom"
              onClick={() => setBottomOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="bottom-content">
            {bottomTab === "validation" && (
              <ValidationPanel
                result={validation}
                loading={busy === "validate"}
              />
            )}
            {bottomTab === "simulation" && (
              <SimulationPanel
                document={simulation}
                loading={busy === "simulate"}
              />
            )}
            {bottomTab === "json" && (
              <div className="json-editor">
                <textarea
                  spellCheck={false}
                  value={jsonDraft}
                  onChange={(e) => setJsonDraft(e.target.value)}
                />
                <div>
                  <span className={jsonError ? "json-error" : "json-ok"}>
                    {jsonError || "Canvas e JSON sincronizzati"}
                  </span>
                  <button onClick={applyJson}>Applica JSON</button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
      {showSimModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowSimModal(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sim-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-icon">
              <Play size={20} />
            </div>
            <h2 id="sim-title">Simula il flusso</h2>
            <p>
              La simulazione usa il motore del backend in sola lettura. Non
              modifica il database.
            </p>
            <label>
              Protocollo <span>opzionale</span>
              <input
                value={protocol}
                onChange={(e) => setProtocol(e.target.value.replace(/\D/g, ""))}
                placeholder="es. 123"
              />
            </label>
            <label>
              Numero documenti
              <input
                type="number"
                min={1}
                max={100}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
              />
            </label>
            <div className="safety">
              <Database size={17} />
              <div>
                <b>Nessuna scrittura sul database</b>
                <small>
                  Vedrai soltanto il percorso e le modifiche pianificate.
                </small>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowSimModal(false)}>Annulla</button>
              <button className="primary" onClick={doSimulate}>
                <Play size={15} /> Avvia simulazione
              </button>
            </div>
          </div>
        </div>
      )}
      {notice && (
        <button className="toast" onClick={() => setNotice(null)}>
          <span>{notice}</span>
          <X size={15} />
        </button>
      )}
    </main>
  );
}

function DynamicNodeForm({ node, catalog, disabled, onUpdate, onDuplicate, onDelete }: { node: FlowNodeDefinition; catalog: Catalog; disabled: boolean; onUpdate: (patch: Partial<FlowNodeDefinition>, config?: Record<string, unknown>) => void; onDuplicate: () => void; onDelete: () => void }) {
  const definition = catalogNode(catalog, node.type); const visual = nodeVisual(definition); const Icon = visual.icon;
  return <div className="node-form"><div className={`form-node-head ${visual.color}`}><i><Icon size={18} /></i><div><span>{definition.label}</span><b>{node.type}</b></div></div><label>Nome del nodo<input disabled={disabled} value={node.name} onChange={(e) => onUpdate({ name: e.target.value })} /></label><label>ID tecnico<input disabled={disabled} value={node.id} onChange={(e) => onUpdate({ id: slug(e.target.value) })} /></label>{Object.entries(definition.configSchema).map(([key, field]) => <DynamicConfigField key={key} fieldKey={key} field={field} value={node.config[key]} config={node.config} catalog={catalog} disabled={disabled} onChange={(value) => onUpdate({}, { [key]: value })} />)}{definition.outputs.length === 0 && <div className="stop-note"><Pause size={16} /><span>Questo nodo non espone collegamenti in uscita.</span></div>}{definition.outputs.some((output) => output !== "always") && <div className="branch-legend">{definition.outputs.map((output) => <span key={output}><i className={output} /> {output}</span>)}</div>}<div className="form-actions"><button disabled={disabled} onClick={onDuplicate}><Copy size={15} /> Duplica</button><button className="danger" disabled={disabled || definition.category === "trigger"} onClick={onDelete}><Trash2 size={15} /> Elimina</button></div></div>;
}

function DynamicConfigField({ fieldKey, field, value, config, catalog, disabled, onChange }: { fieldKey: string; field: CatalogConfigField; value: unknown; config: Record<string, unknown>; catalog: Catalog; disabled: boolean; onChange: (value: unknown) => void }) {
  if (field.requiredExceptFor?.includes(String(config.operator))) return null;
  const label = field.label || fieldKey.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
  if (field.source === "documentFields") return <label>{label}<select disabled={disabled} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}><option value="">Seleziona un campo…</option>{catalog.documentFields.map((item) => <option key={item.path} value={item.path}>{item.label} · {item.path}</option>)}</select></label>;
  if (field.source === "exportStatuses" && field.type === "array") { const selected = Array.isArray(value) ? value.map(Number) : []; return <fieldset className="dynamic-checks"><legend>{label}</legend>{catalog.exportStatuses.map((status) => <label key={status.value}><input type="checkbox" disabled={disabled} checked={selected.includes(status.value)} onChange={(e) => onChange(e.target.checked ? [...selected, status.value] : selected.filter((item) => item !== status.value))} /><span>{status.label}<small>{status.value}</small></span></label>)}</fieldset>; }
  if (field.source === "exportStatuses") return <label>{label}<select disabled={disabled} value={String(value ?? "")} onChange={(e) => onChange(Number(e.target.value))}><option value="">Seleziona uno stato…</option>{catalog.exportStatuses.map((status) => <option key={status.value} value={status.value}>{status.label} ({status.value})</option>)}</select></label>;
  if (field.type === "enum") return <label>{label}<select disabled={disabled} value={String(value ?? "")} onChange={(e) => onChange(parseCatalogValue(e.target.value, field))}>{(field.values || []).map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select></label>;
  if (field.type === "boolean") return <label>{label}<select disabled={disabled} value={String(value ?? false)} onChange={(e) => onChange(e.target.value === "true")}><option value="true">Vero</option><option value="false">Falso</option></select></label>;
  return <label>{label}<input disabled={disabled} type={field.type === "number" ? "number" : "text"} value={Array.isArray(value) ? value.join(", ") : String(value ?? "")} onChange={(e) => onChange(parseCatalogValue(e.target.value, field))} /></label>;
}

function parseCatalogValue(value: string, field: CatalogConfigField): unknown { if (field.type === "number") return value === "" ? undefined : Number(value); if (field.type === "boolean") return value === "true"; if (field.type === "array") return value.split(",").map((item) => field.items === "number" ? Number(item.trim()) : item.trim()).filter((item) => item !== "" && !Number.isNaN(item)); if (field.type === "any") { if (value === "true" || value === "false") return value === "true"; if (value !== "" && Number.isFinite(Number(value))) return Number(value); if (value.includes(",")) return value.split(",").map((item) => item.trim()); } return value; }
function defaultFieldValue(field: CatalogConfigField, catalog: Catalog): unknown { if (field.source === "exportStatuses") return field.type === "array" ? [catalog.exportStatuses[0]?.value].filter((value) => value !== undefined) : catalog.exportStatuses[0]?.value; if (field.source === "documentFields") return catalog.documentFields[0]?.path || ""; if (field.type === "enum") return field.values?.[0]; if (field.type === "array") return []; if (field.type === "number") return 0; if (field.type === "boolean") return false; return ""; }
function preliminaryValidate(flow: FlowDefinition, catalog: Catalog): Array<{ message: string; nodeId?: string }> { const issues: Array<{ message: string; nodeId?: string }> = []; for (const node of flow.nodes) { const definition = catalog.nodeTypes.find((item) => item.type === node.type); if (!definition) { issues.push({ nodeId: node.id, message: `Tipo di nodo non presente nel catalogo: ${node.type}` }); continue; } for (const [key, field] of Object.entries(definition.configSchema)) { const value = node.config[key]; const exempt = field.requiredExceptFor?.includes(String(node.config.operator)); if ((field.required || field.requiredExceptFor) && !exempt && (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))) issues.push({ nodeId: node.id, message: `${definition.label}: il campo ${field.label || key} è obbligatorio` }); } const allowedOutputs = new Set(definition.outputs); flow.edges.filter((edge) => edge.source === node.id).forEach((edge) => { if (!allowedOutputs.has(edge.branch)) issues.push({ nodeId: node.id, message: `Collegamento ${edge.branch} non supportato da ${definition.label}` }); }); } return issues; }

function LegacyNodeForm({
  node,
  disabled,
  onUpdate,
  onDuplicate,
  onDelete,
}: {
  node: FlowNodeDefinition;
  disabled: boolean;
  onUpdate: (
    patch: Partial<FlowNodeDefinition>,
    config?: Record<string, unknown>,
  ) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const definition = mockCatalog.nodeTypes.find((item) => item.type === node.type) || mockCatalog.nodeTypes[0];
  const meta = { ...nodeVisual(definition), label: definition.label };
  const Icon = meta.icon;
  const operators: string[] = [
    "eq",
    "ne",
    "in",
    "not_in",
    "exists",
    "gt",
    "gte",
    "lt",
    "lte",
  ];
  const parseValue = (value: string) => {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value !== "" && !Number.isNaN(Number(value))) return Number(value);
    if (value.includes(",")) return value.split(",").map((v) => v.trim());
    return value;
  };
  return (
    <div className="node-form">
      <div className={`form-node-head ${meta.color}`}>
        <i>
          <Icon size={18} />
        </i>
        <div>
          <span>{meta.label}</span>
          <b>{node.type}</b>
        </div>
      </div>
      <label>
        Nome del nodo
        <input
          disabled={disabled}
          value={node.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </label>
      <label>
        ID tecnico
        <input
          disabled={disabled}
          value={node.id}
          onChange={(e) => onUpdate({ id: slug(e.target.value) })}
        />
      </label>
      {node.type === "trigger.export_status" && (
        <label>
          Export status iniziali <small>separati da virgola</small>
          <input
            disabled={disabled}
            value={((node.config.exportStatuses as number[]) || []).join(", ")}
            onChange={(e) =>
              onUpdate(
                {},
                {
                  exportStatuses: e.target.value
                    .split(",")
                    .map(Number)
                    .filter(Number.isFinite),
                },
              )
            }
          />
        </label>
      )}
      {node.type === "condition" && (
        <>
          <label>
            Campo
            <input
              disabled={disabled}
              value={String(node.config.field || "")}
              onChange={(e) => onUpdate({}, { field: e.target.value })}
              placeholder="metadata.dispatch_ready"
            />
          </label>
          <label>
            Operatore
            <select
              disabled={disabled}
              value={String(node.config.operator || "eq")}
              onChange={(e) => onUpdate({}, { operator: e.target.value })}
            >
              {operators.map((op) => (
                <option key={op}>{op}</option>
              ))}
            </select>
          </label>
          {node.config.operator !== "exists" && (
            <label>
              Valore
              <input
                disabled={disabled}
                value={
                  Array.isArray(node.config.value)
                    ? node.config.value.join(", ")
                    : String(node.config.value ?? "")
                }
                onChange={(e) =>
                  onUpdate({}, { value: parseValue(e.target.value) })
                }
              />
            </label>
          )}
          <div className="branch-legend">
            <span>
              <i className="true" /> Vero
            </span>
            <span>
              <i className="false" /> Falso
            </span>
          </div>
        </>
      )}
      {node.type === "action.update_export_status" && (
        <label>
          Nuovo export status
          <input
            disabled={disabled}
            type="number"
            value={Number(node.config.exportStatus ?? 0)}
            onChange={(e) =>
              onUpdate({}, { exportStatus: Number(e.target.value) })
            }
          />
        </label>
      )}
      {node.type === "stop" && (
        <div className="stop-note">
          <Pause size={16} />
          <span>Questo nodo termina il ramo senza pianificare modifiche.</span>
        </div>
      )}
      <div className="form-actions">
        <button disabled={disabled} onClick={onDuplicate}>
          <Copy size={15} /> Duplica
        </button>
        <button
          className="danger"
          disabled={disabled || node.type === "trigger.export_status"}
          onClick={onDelete}
        >
          <Trash2 size={15} /> Elimina
        </button>
      </div>
    </div>
  );
}

function ValidationPanel({
  result,
  loading,
}: {
  result: ValidationResult | null;
  loading: boolean;
}) {
  if (loading)
    return (
      <div className="result-empty">
        <RefreshCw className="spin" />
        <b>Validazione in corso…</b>
      </div>
    );
  if (!result)
    return (
      <div className="result-empty">
        <ShieldCheck size={25} />
        <b>Il flusso non è ancora stato validato</b>
        <span>Usa “Valida” per inviare la definizione al backend.</span>
      </div>
    );
  return result.valid ? (
    <div className="valid-result">
      <span>
        <Check size={19} />
      </span>
      <div>
        <b>Flusso valido</b>
        <p>
          {result.nodes ?? "—"} nodi e {result.edges ?? "—"} collegamenti
          verificati dal backend.
        </p>
      </div>
    </div>
  ) : (
    <div className="issues">
      <b>{result.issues?.length || 1} problemi da risolvere</b>
      {(result.issues || []).map((issue, index) => (
        <div key={index}>
          <X size={15} />
          <span>{issue.message}</span>
          {issue.nodeId && <code>{issue.nodeId}</code>}
        </div>
      ))}
    </div>
  );
}
function SimulationPanel({
  document,
  loading,
}: {
  document: SimulationDocument | null;
  loading: boolean;
}) {
  if (loading)
    return (
      <div className="result-empty">
        <RefreshCw className="spin" />
        <b>Simulazione in corso…</b>
        <span>Il backend sta valutando i documenti in sola lettura.</span>
      </div>
    );
  if (!document)
    return (
      <div className="result-empty">
        <Play size={25} />
        <b>Nessuna simulazione disponibile</b>
        <span>
          Avvia una simulazione per vedere percorso e modifiche pianificate.
        </span>
      </div>
    );
  return (
    <div className="simulation-result">
      <div className="safety-result">
        <ShieldCheck size={18} />
        <div>
          <b>
            {document.databaseWrites === 0
              ? "Nessuna scrittura sul database"
              : `${document.databaseWrites} scritture segnalate`}
          </b>
          <small>
            Simulazione completata · protocollo{" "}
            {document.protocol ?? "campione"}
          </small>
        </div>
      </div>
      <div className="trace">
        <b>Percorso eseguito</b>
        {(document.trace || []).map((step, index) => (
          <div key={index}>
            <i>{index + 1}</i>
            <span>
              <strong>{step.nodeId || step.node || "Nodo"}</strong>
              {typeof step.conditionResult === "boolean" && (
                <small>
                  Condizione: {step.conditionResult ? "vera" : "falsa"}
                </small>
              )}
            </span>
            {step.branch && <em className={step.branch}>{step.branch}</em>}
          </div>
        ))}
      </div>
      <div className="mutation">
        <span>
          <small>Stato iniziale</small>
          <b>{document.sourceExportStatus ?? "—"}</b>
        </span>
        <i>→</i>
        <span>
          <small>Stato previsto</small>
          <b>
            {String(
              document.plannedMutations?.[0]?.to ??
                document.plannedMutations?.[0]?.value ??
                "Invariato",
            )}
          </b>
        </span>
      </div>
    </div>
  );
}
