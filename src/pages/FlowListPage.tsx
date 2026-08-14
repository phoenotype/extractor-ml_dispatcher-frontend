import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Database, Plus, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { CreateFlowDialog } from "@/features/flows/CreateFlowDialog";
import {
  FlowFilters,
  type FlowFiltersState,
} from "@/features/flows/FlowFilters";
import { FlowListTable } from "@/features/flows/FlowListTable";
import {
  cloneFlow,
  createBlankFlow,
  isVisualFlow,
  slug,
} from "@/features/flows/flow-utils";
import { canEditFlows } from "@/features/flows/permissions";
import { useFlowMutations } from "@/features/flows/useFlowMutations";
import { useFlowsQuery } from "@/features/flows/useFlowsQuery";
import { useRole } from "@/hooks/useRole";
import { ApiError } from "@/services/api/client";
import { getDispatcherConfig } from "@/services/api/config";
import { dispatcherApi, starterFlow } from "@/services/api/dispatcher";
import type { FlowListItem } from "@/types/flow";

export function FlowListPage() {
  const navigate = useNavigate();
  const { role } = useRole();
  const canEdit = canEditFlows(role);
  const { useMocks } = getDispatcherConfig();
  const flowsQuery = useFlowsQuery();
  const { createFlow, deactivateFlow, updateFlow } = useFlowMutations();

  const [filters, setFilters] = useState<FlowFiltersState>({
    search: "",
    status: "all",
    documentType: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<FlowListItem | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const items = flowsQuery.data?.data ?? [];
  const documentTypes = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.documentType)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return items.filter((item) => {
      if (filters.status === "active" && !item.isActive) return false;
      if (filters.status === "inactive" && item.isActive) return false;
      if (filters.documentType && item.documentType !== filters.documentType) {
        return false;
      }
      if (!q) return true;
      return (
        item.flowName.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        (item.documentType || "").toLowerCase().includes(q)
      );
    });
  }, [filters, items]);

  const errorMessage = useMemo(() => {
    const error = flowsQuery.error;
    if (!error) return null;
    if (error instanceof ApiError) {
      if (error.isUnauthorized) {
        return "Autenticazione richiesta (401). Accedi con Lucy oppure verifica il BFF.";
      }
      if (error.isForbidden) {
        return "Accesso non consentito (403). Contatta un amministratore.";
      }
      return error.message;
    }
    return "Errore di rete: impossibile raggiungere il dispatcher.";
  }, [flowsQuery.error]);

  const openItem = (item: FlowListItem) => {
    navigate(`/flows/${encodeURIComponent(item.flowName)}`);
  };

  const handleCreate = async (input: {
    flowName: string;
    description: string;
    documentType: string;
  }) => {
    try {
      const flowDefinition = {
        ...cloneFlow(starterFlow),
        flowName: input.flowName,
      };
      await createFlow.mutateAsync({
        flowName: input.flowName,
        description: input.description,
        documentType: input.documentType,
        isActive: false,
        flowDefinition,
        metadata: {},
      });
      setCreateOpen(false);
      navigate(`/flows/${encodeURIComponent(input.flowName)}`);
    } catch (error) {
      setNotice(
        error instanceof ApiError
          ? error.message
          : "Creazione flusso non riuscita",
      );
    }
  };

  const handleDuplicate = async (item: FlowListItem) => {
    try {
      const detail = await dispatcherApi.getFlow(item.flowName);
      const definition = detail.flowDefinition;
      const nextName = slug(`${item.flowName}_copia`);
      const flowDefinition = isVisualFlow(definition)
        ? { ...definition, flowName: nextName }
        : createBlankFlow(nextName);
      await createFlow.mutateAsync({
        flowName: nextName,
        description: item.description
          ? `${item.description} (copia)`
          : undefined,
        documentType: item.documentType,
        isActive: false,
        flowDefinition,
        metadata: { ...(item.metadata || {}), duplicatedFrom: item.flowName },
      });
      setNotice(`Flusso duplicato come ${nextName}`);
      navigate(`/flows/${encodeURIComponent(nextName)}`);
    } catch (error) {
      setNotice(
        error instanceof ApiError ? error.message : "Duplicazione non riuscita",
      );
    }
  };

  const handleToggleActive = async (item: FlowListItem) => {
    if (item.isActive) {
      setDeactivateTarget(item);
      return;
    }
    try {
      const detail = await dispatcherApi.getFlow(item.flowName);
      if (!isVisualFlow(detail.flowDefinition)) {
        setNotice("Impossibile attivare un flusso legacy da questa UI.");
        return;
      }
      const validation = await dispatcherApi.validateFlow(item.flowName, {
        flowDefinition: detail.flowDefinition,
      });
      if (!validation.valid) {
        setNotice(
          "Il flusso non è valido: correggi gli errori prima di attivarlo.",
        );
        return;
      }
      await updateFlow.mutateAsync({
        flowName: item.flowName,
        body: {
          flowDefinition: detail.flowDefinition,
          description: detail.description,
          documentType: detail.documentType,
          isActive: true,
          metadata: detail.metadata,
          expectedUpdatedAt:
            detail.expectedUpdatedAt || detail.updatedAt || "",
        },
      });
      setNotice("Flusso attivato");
    } catch (error) {
      setNotice(
        error instanceof ApiError ? error.message : "Attivazione non riuscita",
      );
    }
  };

  return (
    <AppShell>
      <nav className="app-tabs" aria-label="Sezioni">
        <Link to="/" className="active" aria-current="page">
          Dispatcher
        </Link>
        <Link to="/connections">Connessioni HTTP</Link>
      </nav>
      <section className="list-content">
        <div className="hero-row">
          <div>
            <p className="eyebrow">AUTOMAZIONI DOCUMENTALI</p>
            <h1>Flussi del dispatcher</h1>
            <p>
              Configura, valida e simula il percorso dei documenti senza toccare
              il database.
            </p>
          </div>
          <Button
            variant="primary"
            disabled={!canEdit}
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={17} /> Nuovo flusso
          </Button>
        </div>

        <FlowFilters
          value={filters}
          documentTypes={documentTypes}
          onChange={setFilters}
        />

        {useMocks || flowsQuery.data?.source === "mock" ? (
          <div className="mock-banner" role="status">
            <Database size={16} />
            <span>Modalità mock attiva</span>
            <small>VITE_USE_DISPATCHER_MOCKS=true · nessun fallback silenzioso</small>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="error-banner">
            <AlertTriangle size={16} />
            <span>{errorMessage}</span>
            <Button onClick={() => void flowsQuery.refetch()}>
              <RefreshCw size={14} /> Riprova
            </Button>
          </div>
        ) : null}

        {!errorMessage ? (
          <FlowListTable
            items={filtered}
            loading={flowsQuery.isLoading}
            canEdit={canEdit}
            onOpen={openItem}
            onDuplicate={(item) => void handleDuplicate(item)}
            onToggleActive={(item) => void handleToggleActive(item)}
          />
        ) : (
          <EmptyState
            icon={AlertTriangle}
            title="Elenco non disponibile"
            description={errorMessage}
          />
        )}
      </section>

      <CreateFlowDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(input) => void handleCreate(input)}
      />

      {deactivateTarget ? (
        <ConfirmDialog
          title="Disattiva flusso"
          description={`Confermi la disattivazione di “${deactivateTarget.flowName}”? Verrà inviata una DELETE al backend.`}
          confirmLabel="Disattiva"
          danger
          onCancel={() => setDeactivateTarget(null)}
          onConfirm={() => {
            void deactivateFlow
              .mutateAsync(deactivateTarget.flowName)
              .then(() => setNotice("Flusso disattivato"))
              .catch((error: unknown) =>
                setNotice(
                  error instanceof ApiError
                    ? error.message
                    : "Disattivazione non riuscita",
                ),
              )
              .finally(() => setDeactivateTarget(null));
          }}
        />
      ) : null}

      {notice ? <Toast message={notice} onClose={() => setNotice(null)} /> : null}
    </AppShell>
  );
}
