import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  filterDocumentFields,
  findDocumentField,
  groupDocumentFields,
  isCollectionArrayField,
  normalizeManualFieldPath,
} from "@/features/flows/catalog-fields";
import type { CatalogDocumentField } from "@/types/catalog";

interface FieldPathPickerProps {
  label?: string;
  value: unknown;
  fields: CatalogDocumentField[];
  nodeOutputPaths?: string[];
  disabled?: boolean;
  onChange: (path: string) => void;
}

export function FieldPathPicker({
  label = "Campo",
  value,
  fields,
  nodeOutputPaths = [],
  disabled,
  onChange,
}: FieldPathPickerProps) {
  const selectedPath = String(value ?? "");
  const selected = findDocumentField(fields, selectedPath);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");

  const filtered = useMemo(
    () => filterDocumentFields(fields, query),
    [fields, query],
  );
  const sections = useMemo(
    () => groupDocumentFields(filtered),
    [filtered],
  );

  const commitManual = () => {
    const path = normalizeManualFieldPath(manual);
    if (!path) return;
    onChange(path);
    setManual("");
    setQuery("");
  };

  const showCollectionHint =
    isCollectionArrayField(selected) ||
    selected?.dataType === "array" ||
    ["batch_fields", "table_fields", "comments", "attachments"].includes(
      selectedPath,
    );

  return (
    <fieldset className="field-path-picker">
      <legend>{label}</legend>

      <div className="field-path-selected">
        <small>Percorso JSON salvato</small>
        <code>{selectedPath || "—"}</code>
        {selected ? (
          <span>
            {selected.label} · {selected.dataType}
          </span>
        ) : selectedPath ? (
          <span className="manual-path">Percorso manuale (non in catalogo)</span>
        ) : (
          <span>Seleziona un campo dal catalogo o inserisci un percorso</span>
        )}
      </div>

      <label className="field-path-search">
        <Search size={15} />
        <input
          disabled={disabled}
          value={query}
          placeholder="Cerca per etichetta o percorso…"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="field-path-sections">
        {sections.length === 0 ? (
          <p className="field-hint">Nessun campo trovato nel catalogo.</p>
        ) : (
          sections.map((section) => (
            <div key={section.id} className="field-path-section">
              <b>{section.label}</b>
              <div className="field-path-options">
                {section.fields.map((field) => {
                  const active = field.path === selectedPath;
                  return (
                    <button
                      key={field.path}
                      type="button"
                      disabled={disabled}
                      className={`field-path-option ${active ? "selected" : ""}`}
                      onClick={() => onChange(field.path)}
                    >
                      <strong>{field.label}</strong>
                      <code>{field.path}</code>
                      <em>{field.dataType}</em>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {nodeOutputPaths.length ? (
        <div className="field-path-section node-output-paths">
          <b>Output nodi precedenti</b>
          <div className="field-path-options">
            {nodeOutputPaths.map((path) => (
              <button
                key={path}
                type="button"
                disabled={disabled}
                className={`field-path-option ${path === selectedPath ? "selected" : ""}`}
                onClick={() => onChange(path)}
              >
                <strong>{path.split(".")[1]}</strong>
                <code>{path}</code>
                <em>output</em>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="field-path-manual">
        <small>Percorso personalizzato</small>
        <div className="tag-input-row">
          <input
            disabled={disabled}
            value={manual}
            placeholder="es. metadata.custom_flag o nodes.python_1.output.result"
            onChange={(event) => setManual(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitManual();
              }
            }}
          />
          <button
            type="button"
            disabled={disabled || !normalizeManualFieldPath(manual)}
            onClick={commitManual}
          >
            Usa percorso
          </button>
        </div>
      </div>

      {showCollectionHint ? (
        <p className="field-hint">
          Il backend espone questa sezione al motore; i filtri su elementi
          specifici saranno disponibili con gli operatori per collezioni.
        </p>
      ) : null}
    </fieldset>
  );
}
