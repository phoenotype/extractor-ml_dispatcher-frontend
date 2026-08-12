import { Plus, Zap } from "lucide-react";
import { catalogNode, nodeVisual } from "@/features/flows/flow-utils";
import type { Catalog } from "@/types/catalog";
import type { FlowDefinition } from "@/types/flow";

interface NodeCatalogPanelProps {
  catalog: Catalog;
  flow: FlowDefinition;
  disabled?: boolean;
  onAdd: (type: string) => void;
}

export function NodeCatalogPanel({
  catalog,
  flow,
  disabled,
  onAdd,
}: NodeCatalogPanelProps) {
  const hasTrigger = flow.nodes.some(
    (node) => catalogNode(catalog, node.type).category === "trigger",
  );

  return (
    <aside className="node-catalog">
      <div className="panel-heading">
        <span>
          <Plus size={15} /> Nodi
        </span>
        <small>Aggiungi dal catalogo</small>
      </div>
      {catalog.nodeTypes.map((definition) => {
        const meta = nodeVisual(definition);
        const Icon = meta.icon;
        const isTriggerBlocked =
          definition.category === "trigger" && hasTrigger;
        return (
          <button
            key={definition.type}
            type="button"
            className={`catalog-node ${meta.color}`}
            onClick={() => onAdd(definition.type)}
            disabled={disabled || isTriggerBlocked}
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
          I flussi devono avere un solo trigger e non possono contenere cicli.
        </span>
      </div>
    </aside>
  );
}
