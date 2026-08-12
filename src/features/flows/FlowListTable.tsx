import {
  Copy,
  Download,
  FileJson,
  GitBranch,
  MoreHorizontal,
  Pause,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  downloadJson,
  formatItalianDate,
} from "@/features/flows/flow-utils";
import type { FlowListItem } from "@/types/flow";
import { useState } from "react";

interface FlowListTableProps {
  items: FlowListItem[];
  loading?: boolean;
  canEdit: boolean;
  onOpen: (item: FlowListItem) => void;
  onDuplicate: (item: FlowListItem) => void;
  onToggleActive: (item: FlowListItem) => void;
}

export function FlowListTable({
  items,
  loading,
  canEdit,
  onOpen,
  onDuplicate,
  onToggleActive,
}: FlowListTableProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flow-table">
        <div className="table-head">
          <span>Nome</span>
          <span>Descrizione</span>
          <span>Tipo documento</span>
          <span>Stato</span>
          <span>Formato</span>
          <span>Modificabilità</span>
          <span>Aggiornato</span>
          <span />
        </div>
        <div className="table-loading">
          <Skeleton rows={4} />
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flow-table">
        <EmptyState
          icon={GitBranch}
          title="Nessun flusso trovato"
          description="Prova a modificare i filtri o crea un nuovo flusso."
        />
      </div>
    );
  }

  return (
    <div className="flow-table flow-table-wide">
      <div className="table-head table-head-wide">
        <span>Nome</span>
        <span>Descrizione</span>
        <span>Tipo documento</span>
        <span>Stato</span>
        <span>Formato</span>
        <span>Modificabilità</span>
        <span>Aggiornato</span>
        <span />
      </div>
      {items.map((item) => {
        const legacy = item.format === "legacy" || !item.editable;
        return (
          <div className="table-row table-row-wide" key={item.flowName}>
            <button
              type="button"
              className="table-main"
              onClick={() => onOpen(item)}
            >
              <span className="flow-name">
                <i className={legacy ? "legacy-icon" : "flow-icon"}>
                  {legacy ? <FileJson size={17} /> : <GitBranch size={17} />}
                </i>
                <b>{item.flowName}</b>
                <small>
                  {legacy ? "Legacy — sola lettura" : "Editor visuale"}
                </small>
              </span>
              <span className="muted-cell">{item.description || "—"}</span>
              <span>{item.documentType || "—"}</span>
              <span>
                <em className={`status ${item.isActive ? "active" : "inactive"}`}>
                  <i />
                  {item.isActive ? "Attivo" : "Inattivo"}
                </em>
              </span>
              <span>
                <Badge tone={legacy ? "warning" : "default"}>
                  {item.format}
                </Badge>
              </span>
              <span>
                <Badge tone={item.editable ? "success" : "muted"}>
                  {item.editable ? "Modificabile" : "Sola lettura"}
                </Badge>
              </span>
              <span className="date">{formatItalianDate(item.updatedAt)}</span>
            </button>
            <div className="row-actions">
              <button
                type="button"
                className="icon-button"
                aria-label="Azioni"
                onClick={() =>
                  setMenuFor((current) =>
                    current === item.flowName ? null : item.flowName,
                  )
                }
              >
                <MoreHorizontal size={18} />
              </button>
              {menuFor === item.flowName ? (
                <div className="row-menu">
                  <button type="button" onClick={() => onOpen(item)}>
                    Apri
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit || legacy}
                    onClick={() => onDuplicate(item)}
                  >
                    <Copy size={14} /> Duplica
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => onToggleActive(item)}
                  >
                    {item.isActive ? (
                      <>
                        <Pause size={14} /> Disattiva
                      </>
                    ) : (
                      <>
                        <Play size={14} /> Attiva
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadJson(
                        `${item.flowName}.json`,
                        item.flowDefinition || item.definition || item,
                      )
                    }
                  >
                    <Download size={14} /> Esporta JSON
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
