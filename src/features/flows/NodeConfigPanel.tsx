import { useMemo, useState } from "react";
import { Copy, Pause, Settings2, Trash2, X } from "lucide-react";
import {
  catalogNode,
  nodeVisual,
  parseCatalogValue,
  slug,
} from "@/features/flows/flow-utils";
import type { Catalog, CatalogConfigField } from "@/types/catalog";
import type { FlowNodeDefinition } from "@/types/flow";

interface NodeConfigPanelProps {
  node: FlowNodeDefinition | null;
  catalog: Catalog;
  disabled?: boolean;
  onClose: () => void;
  onUpdate: (
    patch: Partial<FlowNodeDefinition>,
    config?: Record<string, unknown>,
  ) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function NodeConfigPanel({
  node,
  catalog,
  disabled,
  onClose,
  onUpdate,
  onDuplicate,
  onDelete,
}: NodeConfigPanelProps) {
  return (
    <aside className="config-panel">
      <div className="panel-heading">
        <span>
          <Settings2 size={15} /> Configurazione
        </span>
        {node ? (
          <button type="button" className="close-button" onClick={onClose}>
            <X size={16} />
          </button>
        ) : null}
      </div>
      {node ? (
        <DynamicNodeForm
          node={node}
          catalog={catalog}
          disabled={disabled}
          onUpdate={onUpdate}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ) : (
        <div className="no-selection">
          <Settings2 size={26} />
          <b>Nessun nodo selezionato</b>
          <p>Seleziona un nodo sulla canvas per configurarlo.</p>
        </div>
      )}
    </aside>
  );
}

function DynamicNodeForm({
  node,
  catalog,
  disabled,
  onUpdate,
  onDuplicate,
  onDelete,
}: {
  node: FlowNodeDefinition;
  catalog: Catalog;
  disabled?: boolean;
  onUpdate: (
    patch: Partial<FlowNodeDefinition>,
    config?: Record<string, unknown>,
  ) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const definition = catalogNode(catalog, node.type);
  const visual = nodeVisual(definition);
  const Icon = visual.icon;

  return (
    <div className="node-form">
      <div className={`form-node-head ${visual.color}`}>
        <i>
          <Icon size={18} />
        </i>
        <div>
          <span>{definition.label}</span>
          <b>{node.type}</b>
        </div>
      </div>
      <label>
        Nome del nodo
        <input
          disabled={disabled}
          value={node.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
        />
      </label>
      <label>
        ID tecnico
        <input
          disabled={disabled}
          value={node.id}
          onChange={(event) => onUpdate({ id: slug(event.target.value) })}
        />
      </label>
      {Object.entries(definition.configSchema).map(([key, field]) => (
        <DynamicConfigField
          key={key}
          fieldKey={key}
          field={field}
          value={node.config[key]}
          config={node.config}
          catalog={catalog}
          disabled={disabled}
          onChange={(value) => onUpdate({}, { [key]: value })}
        />
      ))}
      {definition.outputs.length === 0 ? (
        <div className="stop-note">
          <Pause size={16} />
          <span>Questo nodo non espone collegamenti in uscita.</span>
        </div>
      ) : null}
      {definition.outputs.some((output) => output !== "always") ? (
        <div className="branch-legend">
          {definition.outputs.map((output) => (
            <span key={output}>
              <i className={output} /> {output}
            </span>
          ))}
        </div>
      ) : null}
      <div className="form-actions">
        <button type="button" disabled={disabled} onClick={onDuplicate}>
          <Copy size={15} /> Duplica
        </button>
        <button
          type="button"
          className="danger"
          disabled={disabled || definition.category === "trigger"}
          onClick={onDelete}
        >
          <Trash2 size={15} /> Elimina
        </button>
      </div>
    </div>
  );
}

function isExportStatusesField(fieldKey: string, field: CatalogConfigField) {
  return (
    field.source === "exportStatuses" ||
    fieldKey === "exportStatuses" ||
    (fieldKey === "exportStatus" && field.type !== "array")
  );
}

function isDocumentTypesField(fieldKey: string, field: CatalogConfigField) {
  return (
    fieldKey === "documentTypes" ||
    (field.type === "array" &&
      field.items === "string" &&
      /document.?type/i.test(fieldKey + (field.description || "") + (field.label || "")))
  );
}

function DynamicConfigField({
  fieldKey,
  field,
  value,
  config,
  catalog,
  disabled,
  onChange,
}: {
  fieldKey: string;
  field: CatalogConfigField;
  value: unknown;
  config: Record<string, unknown>;
  catalog: Catalog;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}) {
  if (field.requiredExceptFor?.includes(String(config.operator))) return null;
  const label =
    field.label ||
    fieldKey.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());

  if (field.source === "documentFields") {
    return (
      <label>
        {label}
        <select
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Seleziona un campo…</option>
          {catalog.documentFields.map((item) => (
            <option key={item.path} value={item.path}>
              {item.label} · {item.path}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (isExportStatusesField(fieldKey, field) && field.type === "array") {
    const selected = Array.isArray(value) ? value.map(Number) : [];
    return (
      <fieldset className="dynamic-checks">
        <legend>{label}</legend>
        {field.description ? (
          <p className="field-hint">{field.description}</p>
        ) : null}
        {catalog.exportStatuses.map((status) => (
          <label key={status.value}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(status.value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, status.value]
                    : selected.filter((item) => item !== status.value),
                )
              }
            />
            <span>
              {status.label}
              <small>{status.value}</small>
            </span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (isExportStatusesField(fieldKey, field)) {
    return (
      <label>
        {label}
        <select
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          <option value="">Seleziona uno stato…</option>
          {catalog.exportStatuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label} ({status.value})
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (isDocumentTypesField(fieldKey, field)) {
    return (
      <DocumentTypesField
        label={label}
        description={
          field.description ||
          "Se non selezioni tipi documento, il trigger considera tutti i tipi"
        }
        value={value}
        disabled={disabled}
        suggestions={field.values?.map(String) || [
          "Invoice",
          "Commercial Invoice",
          "Delivery Note",
          "Proof of Delivery",
        ]}
        onChange={onChange}
      />
    );
  }

  if (field.type === "enum") {
    return (
      <label>
        {label}
        <select
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(event) =>
            onChange(parseCatalogValue(event.target.value, field))
          }
        >
          {(field.values || []).map((option) => (
            <option key={String(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "boolean") {
    return (
      <label>
        {label}
        <select
          disabled={disabled}
          value={String(value ?? false)}
          onChange={(event) => onChange(event.target.value === "true")}
        >
          <option value="true">Vero</option>
          <option value="false">Falso</option>
        </select>
      </label>
    );
  }

  return (
    <label>
      {label}
      <input
        disabled={disabled}
        type={field.type === "number" ? "number" : "text"}
        value={Array.isArray(value) ? value.join(", ") : String(value ?? "")}
        onChange={(event) =>
          onChange(parseCatalogValue(event.target.value, field))
        }
      />
    </label>
  );
}

function DocumentTypesField({
  label,
  description,
  value,
  disabled,
  suggestions,
  onChange,
}: {
  label: string;
  description: string;
  value: unknown;
  disabled?: boolean;
  suggestions: string[];
  onChange: (value: unknown) => void;
}) {
  const selected = useMemo(
    () => (Array.isArray(value) ? value.map(String).filter(Boolean) : []),
    [value],
  );
  const [draft, setDraft] = useState("");

  const commitValue = (next: string[]) => {
    const unique = Array.from(new Set(next.map((item) => item.trim()).filter(Boolean)));
    // Omit the key when empty so the trigger accepts all document types.
    onChange(unique.length ? unique : undefined);
  };

  const addDraft = () => {
    const next = draft.trim();
    if (!next) return;
    commitValue([...selected, next]);
    setDraft("");
  };

  const available = suggestions.filter((item) => !selected.includes(item));

  return (
    <fieldset className="dynamic-checks document-types-field">
      <legend>{label}</legend>
      <p className="field-hint">
        Se non selezioni tipi documento, il trigger considera tutti i tipi
      </p>
      {description &&
      description !==
        "Se non selezioni tipi documento, il trigger considera tutti i tipi" ? (
        <p className="field-hint">{description}</p>
      ) : null}

      <div className="tag-list">
        {selected.length === 0 ? (
          <span className="tag-empty">Tutti i tipi documento</span>
        ) : (
          selected.map((item) => (
            <button
              key={item}
              type="button"
              className="tag-chip"
              disabled={disabled}
              onClick={() =>
                commitValue(selected.filter((entry) => entry !== item))
              }
              title="Rimuovi"
            >
              {item}
              <X size={12} />
            </button>
          ))
        )}
      </div>

      <div className="tag-input-row">
        <input
          disabled={disabled}
          value={draft}
          placeholder="Aggiungi tipo documento…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addDraft();
            }
          }}
        />
        <button type="button" disabled={disabled || !draft.trim()} onClick={addDraft}>
          Aggiungi
        </button>
      </div>

      {available.length > 0 ? (
        <div className="tag-suggestions">
          {available.map((item) => (
            <button
              key={item}
              type="button"
              disabled={disabled}
              onClick={() => commitValue([...selected, item])}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
