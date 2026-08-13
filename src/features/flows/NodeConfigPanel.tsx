import { useMemo, useState } from "react";
import { Copy, Pause, Settings2, Trash2, X } from "lucide-react";
import {
  findDocumentField,
  operatorsForDocumentField,
} from "@/features/flows/catalog-fields";
import { FieldPathPicker } from "@/features/flows/FieldPathPicker";
import {
  catalogNode,
  ensureTriggerConfigSchema,
  nodeVisual,
  parseCatalogValue,
  sanitizeDocumentTypes,
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
  const definition = ensureTriggerConfigSchema(catalogNode(catalog, node.type));
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
          onConfigPatch={(patch) => onUpdate({}, patch)}
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
      /document.?type/i.test(
        fieldKey + (field.description || "") + (field.label || ""),
      ))
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
  onConfigPatch,
}: {
  fieldKey: string;
  field: CatalogConfigField;
  value: unknown;
  config: Record<string, unknown>;
  catalog: Catalog;
  disabled?: boolean;
  onChange: (value: unknown) => void;
  onConfigPatch: (patch: Record<string, unknown>) => void;
}) {
  if (field.requiredExceptFor?.includes(String(config.operator))) return null;

  if (field.source === "documentFields") {
    const operatorValues = catalog.nodeTypes
      .find((item) => item.type === "condition")
      ?.configSchema.operator?.values;

    return (
      <FieldPathPicker
        label={field.label || "Campo"}
        value={value}
        fields={catalog.documentFields}
        disabled={disabled}
        onChange={(path) => {
          const docField = findDocumentField(catalog.documentFields, path);
          const allowed = operatorsForDocumentField(
            docField,
            operatorValues || [
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
          );
          const patch: Record<string, unknown> = { field: path };
          if (docField?.dataType === "array") {
            patch.operator = allowed[0] || "exists";
            patch.value = undefined;
          } else if (
            allowed.length > 0 &&
            !allowed.includes(String(config.operator ?? ""))
          ) {
            patch.operator = allowed[0];
          }
          onConfigPatch(patch);
        }}
      />
    );
  }

  if (isExportStatusesField(fieldKey, field) && field.type === "array") {
    const selected = Array.isArray(value) ? value.map(Number) : [];
    return (
      <fieldset className="dynamic-checks export-statuses-field">
        <legend>Stati di esportazione</legend>
        <p className="field-hint">Seleziona almeno uno stato iniziale.</p>
        <div className="status-chip-list">
          {catalog.exportStatuses.map((status) => {
            const checked = selected.includes(status.value);
            return (
              <label
                key={status.value}
                className={`status-chip ${checked ? "selected" : ""}`}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={checked}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, status.value]
                        : selected.filter((item) => item !== status.value),
                    )
                  }
                />
                <span>
                  {status.value} — {status.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (isExportStatusesField(fieldKey, field)) {
    return (
      <label>
        {field.label || "Stato di esportazione"}
        <select
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          <option value="">Seleziona uno stato…</option>
          {catalog.exportStatuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.value} — {status.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (isDocumentTypesField(fieldKey, field)) {
    return (
      <DocumentTypesField
        value={value}
        disabled={disabled}
        suggestions={
          field.values?.map(String) || [
            "Invoice",
            "Commercial Invoice",
            "Delivery Note",
            "Proof of Delivery",
            "Receipt",
          ]
        }
        onChange={onChange}
      />
    );
  }

  const label =
    field.label ||
    fieldKey.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());

  if (field.type === "enum" && fieldKey === "operator") {
    const docField = findDocumentField(
      catalog.documentFields,
      String(config.field ?? ""),
    );
    const options = operatorsForDocumentField(docField, field.values || []);
    return (
      <label>
        {label}
        <select
          disabled={disabled}
          value={
            options.includes(String(value ?? ""))
              ? String(value ?? "")
              : options[0] || ""
          }
          onChange={(event) => {
            const next = parseCatalogValue(event.target.value, field);
            if (next === "exists") {
              onConfigPatch({ operator: next, value: undefined });
            } else {
              onChange(next);
            }
          }}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {docField?.dataType === "array" ? (
          <small className="field-hint">
            Per le collezioni è disponibile solo la verifica di presenza del
            percorso (`exists`).
          </small>
        ) : null}
      </label>
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
  value,
  disabled,
  suggestions,
  onChange,
}: {
  value: unknown;
  disabled?: boolean;
  suggestions: string[];
  onChange: (value: unknown) => void;
}) {
  const selected = useMemo(
    () => sanitizeDocumentTypes(value) || [],
    [value],
  );
  const [draft, setDraft] = useState("");

  const commitValue = (next: string[]) => {
    onChange(sanitizeDocumentTypes(next));
  };

  const addDraft = () => {
    const next = draft.trim();
    if (!next) return;
    commitValue([...selected, next]);
    setDraft("");
  };

  const available = suggestions.filter(
    (item) =>
      !selected.some((entry) => entry.toLowerCase() === item.toLowerCase()),
  );

  return (
    <fieldset className="dynamic-checks document-types-field">
      <legend>Tipi documento ammessi</legend>
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
        <button
          type="button"
          disabled={disabled || !draft.trim()}
          onClick={addDraft}
        >
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

      <p className="field-hint">
        Se non selezioni alcun tipo, il trigger considera tutti i tipi
        documento.
      </p>
    </fieldset>
  );
}
