import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ExternalLink } from "lucide-react";
import {
  isRelativeHttpPath,
  looksLikeAbsoluteUrl,
  pathLooksSensitive,
  sanitizeHttpRequestConfig,
} from "@/features/connections/http-config";
import { useConnectionsQuery } from "@/features/connections/useConnectionsQuery";
import { JsonConfigField } from "@/features/flows/JsonConfigField";
import { HTTP_METHODS } from "@/types/connection";

interface HttpRequestConfigFormProps {
  config: Record<string, unknown>;
  disabled?: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}

export function HttpRequestConfigForm({
  config,
  disabled,
  onChange,
}: HttpRequestConfigFormProps) {
  const connectionsQuery = useConnectionsQuery();
  const connections = useMemo(
    () => connectionsQuery.data?.data ?? [],
    [connectionsQuery.data?.data],
  );

  const selected = useMemo(
    () =>
      connections.find(
        (item) => item.connectionName === String(config.connectionRef || ""),
      ),
    [connections, config.connectionRef],
  );

  const allowedMethods = selected?.allowedMethods?.length
    ? selected.allowedMethods.map((method) => method.toUpperCase())
    : [...HTTP_METHODS];

  const path = String(config.path ?? "");
  const pathWarning = path
    ? looksLikeAbsoluteUrl(path)
      ? "Il path non può essere un URL assoluto (http/https)."
      : !isRelativeHttpPath(path)
        ? "Il path deve iniziare con /."
        : pathLooksSensitive(path)
          ? "Attenzione: il path sembra contenere segreti (/key/, token, api_key…). Usa una connessione e variabili d'ambiente."
          : null
    : null;

  const patchConfig = (patch: Record<string, unknown>) => {
    onChange(sanitizeHttpRequestConfig({ ...config, ...patch }));
  };

  return (
    <div className="http-request-config">
      <label>
        <span className="field-label-row">
          <span>Connessione</span>
          <Link
            className="connection-manage-link"
            to="/connections"
            target="_blank"
            rel="noreferrer"
          >
            Gestisci connessioni <ExternalLink size={12} />
          </Link>
        </span>
        <select
          disabled={disabled || connectionsQuery.isLoading}
          value={String(config.connectionRef ?? "")}
          onChange={(event) => {
            const connectionRef = event.target.value;
            const next = connections.find(
              (item) => item.connectionName === connectionRef,
            );
            const method = String(config.method || "POST").toUpperCase();
            const nextMethod =
              next &&
              next.allowedMethods.length &&
              !next.allowedMethods.map((m) => m.toUpperCase()).includes(method)
                ? next.allowedMethods[0]?.toUpperCase()
                : method;
            patchConfig({
              connectionRef,
              method: nextMethod,
            });
          }}
        >
          <option value="">Seleziona una connessione…</option>
          {connections.map((item) => (
            <option key={item.connectionName} value={item.connectionName}>
              {item.connectionName}
              {item.isActive ? "" : " (inattiva)"}
            </option>
          ))}
        </select>
        <small className="field-hint">
          Seleziona una connessione autorizzata. Gli URL e i segreti si
          configurano nella pagina Connessioni HTTP.
        </small>
        {!connectionsQuery.isLoading && connections.length === 0 ? (
          <span className="connection-empty-callout" role="status">
            <AlertCircle size={16} />
            <span>
              <b>Nessuna connessione configurata.</b>
              <small>Creane una prima di salvare questo nodo.</small>
            </span>
            <Link to="/connections" target="_blank" rel="noreferrer">
              Configura ora <ExternalLink size={12} />
            </Link>
          </span>
        ) : null}
        {selected && !selected.isActive ? (
          <small className="field-error">
            La connessione selezionata non è attiva.
          </small>
        ) : null}
        {connectionsQuery.isError ? (
          <small className="field-error">
            Impossibile caricare le connessioni.
          </small>
        ) : null}
      </label>

      <label>
        Metodo
        <select
          disabled={disabled}
          value={String(config.method ?? allowedMethods[0] ?? "POST")}
          onChange={(event) => patchConfig({ method: event.target.value })}
        >
          {allowedMethods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>

      <label>
        Percorso relativo
        <input
          disabled={disabled}
          value={path}
          placeholder="/"
          onChange={(event) => patchConfig({ path: event.target.value })}
        />
        {pathWarning ? (
          <small className="field-error">{pathWarning}</small>
        ) : (
          <small className="field-hint">
            Deve iniziare con `/` e non può contenere `http://` o `https://`.
          </small>
        )}
      </label>

      <JsonConfigField
        label="Headers"
        value={config.headers}
        disabled={disabled}
        requireObject
        onChange={(headers) => patchConfig({ headers })}
      />

      <JsonConfigField
        label="Body"
        value={config.body}
        disabled={disabled}
        onChange={(body) => patchConfig({ body })}
      />

      <SuccessStatusCodesField
        value={config.successStatusCodes}
        disabled={disabled}
        onChange={(successStatusCodes) => patchConfig({ successStatusCodes })}
      />

      <label>
        Timeout (secondi)
        <input
          type="number"
          min={1}
          max={120}
          disabled={disabled}
          value={
            typeof config.timeoutSeconds === "number"
              ? config.timeoutSeconds
              : ""
          }
          placeholder="Opzionale · 1–120"
          onChange={(event) => {
            const raw = event.target.value.trim();
            if (!raw) {
              patchConfig({ timeoutSeconds: undefined });
              return;
            }
            const next = Number(raw);
            patchConfig({
              timeoutSeconds: Number.isFinite(next) ? next : undefined,
            });
          }}
        />
        <small className="field-hint">
          Lascia vuoto per omettere il campo (niente `0` automatico).
        </small>
      </label>

      {selected ? (
        <p className="field-hint connection-summary">
          Base:{" "}
          {selected.baseUrlEnv
            ? `env ${selected.baseUrlEnv}`
            : selected.baseUrl || "—"}{" "}
          · auth {selected.authType} · timeout connessione{" "}
          {selected.timeoutSeconds}s
        </p>
      ) : null}
    </div>
  );
}

function SuccessStatusCodesField({
  value,
  disabled,
  onChange,
}: {
  value: unknown;
  disabled?: boolean;
  onChange: (value: number[]) => void;
}) {
  const codes = Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number")
    : [200];
  const [draft, setDraft] = useState("");

  return (
    <fieldset className="dynamic-checks">
      <legend>Status di successo</legend>
      <div className="tag-list">
        {codes.map((code) => (
          <button
            key={code}
            type="button"
            className="tag-chip"
            disabled={disabled}
            onClick={() => onChange(codes.filter((item) => item !== code))}
          >
            {code}
          </button>
        ))}
      </div>
      <div className="tag-input-row">
        <input
          disabled={disabled}
          value={draft}
          placeholder="es. 200"
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const next = Number(draft);
            if (next >= 100 && next <= 599 && !codes.includes(next)) {
              onChange([...codes, next]);
              setDraft("");
            }
          }}
        />
        <button
          type="button"
          disabled={disabled || !draft}
          onClick={() => {
            const next = Number(draft);
            if (next >= 100 && next <= 599 && !codes.includes(next)) {
              onChange([...codes, next]);
              setDraft("");
            }
          }}
        >
          Aggiungi
        </button>
      </div>
      <small className="field-hint">Codici HTTP tra 100 e 599.</small>
    </fieldset>
  );
}
