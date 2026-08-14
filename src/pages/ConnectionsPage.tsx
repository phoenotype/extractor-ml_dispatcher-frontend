import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Database,
  Plus,
  RefreshCw,
  Shield,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import {
  normalizeConnection,
  pathLooksSensitive,
  validateConnectionDraft,
} from "@/features/connections/http-config";
import { useConnectionMutations } from "@/features/connections/useConnectionMutations";
import { useConnectionsQuery } from "@/features/connections/useConnectionsQuery";
import { canEditFlows } from "@/features/flows/permissions";
import { useRole } from "@/hooks/useRole";
import { ApiError } from "@/services/api/client";
import { getDispatcherConfig } from "@/services/api/config";
import {
  HTTP_AUTH_TYPES,
  HTTP_METHODS,
  type HttpAuthType,
  type HttpConnection,
} from "@/types/connection";

const emptyDraft = (): HttpConnection => ({
  connectionName: "",
  baseUrl: "",
  authType: "none",
  authConfig: {},
  defaultHeaders: {},
  allowedMethods: ["POST"],
  allowedPathPrefixes: ["/"],
  timeoutSeconds: 20,
  isActive: true,
});

export function ConnectionsPage() {
  const { role } = useRole();
  const canEdit = canEditFlows(role);
  const { useMocks } = getDispatcherConfig();
  const connectionsQuery = useConnectionsQuery();
  const { upsertConnection } = useConnectionMutations();

  const [draft, setDraft] = useState<HttpConnection | null>(null);
  const [nameLocked, setNameLocked] = useState(false);
  const [urlMode, setUrlMode] = useState<"baseUrl" | "baseUrlEnv">("baseUrl");
  const [headersDraft, setHeadersDraft] = useState("{}");
  const [prefixesDraft, setPrefixesDraft] = useState("/");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const items = connectionsQuery.data?.data ?? [];

  const errorMessage = useMemo(() => {
    const error = connectionsQuery.error;
    if (!error) return null;
    if (error instanceof ApiError) return error.message;
    return "Errore di rete: impossibile raggiungere il dispatcher.";
  }, [connectionsQuery.error]);

  const openCreate = () => {
    setDraft(emptyDraft());
    setNameLocked(false);
    setUrlMode("baseUrl");
    setHeadersDraft("{}");
    setPrefixesDraft("/");
    setFormError(null);
  };

  const openEdit = (item: HttpConnection) => {
    setDraft(structuredClone(item));
    setNameLocked(true);
    setUrlMode(item.baseUrlEnv ? "baseUrlEnv" : "baseUrl");
    setHeadersDraft(JSON.stringify(item.defaultHeaders || {}, null, 2));
    setPrefixesDraft((item.allowedPathPrefixes || ["/"]).join("\n"));
    setFormError(null);
  };

  const save = async () => {
    if (!draft) return;
    let defaultHeaders: Record<string, string> = {};
    try {
      const parsed = JSON.parse(headersDraft || "{}") as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setFormError("defaultHeaders deve essere un oggetto JSON");
        return;
      }
      defaultHeaders = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
          key,
          String(value),
        ]),
      );
    } catch {
      setFormError("defaultHeaders: JSON non valido");
      return;
    }

    const next: HttpConnection = {
      ...draft,
      connectionName: draft.connectionName.trim(),
      baseUrl: urlMode === "baseUrl" ? draft.baseUrl : undefined,
      baseUrlEnv: urlMode === "baseUrlEnv" ? draft.baseUrlEnv : undefined,
      defaultHeaders,
      allowedPathPrefixes: prefixesDraft
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
      authConfig: buildAuthConfig(draft.authType, draft.authConfig),
    };

    if (urlMode === "baseUrl" && next.baseUrl && pathLooksSensitive(next.baseUrl)) {
      setFormError(
        "L'URL sembra contenere segreti (/key/, token, api_key…). Usa baseUrlEnv.",
      );
      return;
    }

    const issues = validateConnectionDraft(next);
    if (issues.length) {
      setFormError(issues[0] || "Configurazione non valida");
      return;
    }

    try {
      const saved = await upsertConnection.mutateAsync(normalizeConnection(next));
      if (urlMode === "baseUrl" && !saved.baseUrl) {
        setFormError(
          "Il backend non ha salvato l'URL esplicito. La connessione non è stata aggiornata.",
        );
        return;
      }
      setNotice("Connessione salvata");
      setDraft(null);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Salvataggio non riuscito",
      );
    }
  };

  return (
    <AppShell subtitle="Connessioni HTTP">
      <nav className="app-tabs" aria-label="Sezioni">
        <Link to="/">Dispatcher</Link>
        <Link to="/connections" className="active" aria-current="page">
          Connessioni HTTP
        </Link>
      </nav>

      <section className="list-content">
        <div className="hero-row">
          <div>
            <p className="eyebrow">INTEGRAZIONI ESTERNE</p>
            <h1>Connessioni HTTP</h1>
            <p>
              Definisci base URL, autenticazione e metodi consentiti. I segreti
              restano nelle variabili d&apos;ambiente del backend.
            </p>
          </div>
          <Button variant="primary" disabled={!canEdit} onClick={openCreate}>
            <Plus size={17} /> Nuova connessione
          </Button>
        </div>

        {useMocks || connectionsQuery.data?.source === "mock" ? (
          <div className="mock-banner" role="status">
            <Database size={16} />
            <span>Modalità mock attiva</span>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="error-banner">
            <AlertTriangle size={16} />
            <span>{errorMessage}</span>
            <Button onClick={() => void connectionsQuery.refetch()}>
              <RefreshCw size={14} /> Riprova
            </Button>
          </div>
        ) : null}

        {!errorMessage && items.length === 0 && !connectionsQuery.isLoading ? (
          <EmptyState
            icon={Shield}
            title="Nessuna connessione"
            description="Crea una connessione HTTP per usarla nei nodi action.http_request."
          />
        ) : null}

        {!errorMessage && items.length > 0 ? (
          <div className="connections-table">
            <div className="table-head connections-head">
              <span>Nome</span>
              <span>Base</span>
              <span>Auth</span>
              <span>Metodi</span>
              <span>Stato</span>
              <span />
            </div>
            {items.map((item) => (
              <div key={item.connectionName} className="table-row connections-row">
                <span>
                  <b>{item.connectionName}</b>
                  <small>
                    timeout {item.timeoutSeconds}s · prefissi{" "}
                    {(item.allowedPathPrefixes || []).join(", ") || "/"}
                  </small>
                </span>
                <span>
                  {item.baseUrlEnv ? (
                    <code title="Nome variabile d'ambiente">{item.baseUrlEnv}</code>
                  ) : (
                    <code>{item.baseUrl}</code>
                  )}
                </span>
                <span>{item.authType}</span>
                <span>{(item.allowedMethods || []).join(", ")}</span>
                <span>
                  <em className={`status-pill ${item.isActive ? "on" : "off"}`}>
                    {item.isActive ? "Attiva" : "Inattiva"}
                  </em>
                </span>
                <span>
                  <Button
                    disabled={!canEdit}
                    onClick={() => openEdit(item)}
                  >
                    Modifica
                  </Button>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {draft ? (
          <div className="connection-editor card-panel">
            <h2>
              {draft.connectionName ? "Modifica connessione" : "Nuova connessione"}
            </h2>
            <div className="connection-grid">
              <label>
                Nome
                <input
                  disabled={!canEdit || nameLocked}
                  value={draft.connectionName}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      connectionName: event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, "_"),
                    })
                  }
                  placeholder="ifttt_dispatcher"
                />
              </label>

              <label>
                Stato
                <select
                  disabled={!canEdit}
                  value={draft.isActive ? "true" : "false"}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      isActive: event.target.value === "true",
                    })
                  }
                >
                  <option value="true">Attiva</option>
                  <option value="false">Inattiva</option>
                </select>
              </label>

              <fieldset className="url-mode">
                <legend>Base URL</legend>
                <div className="tag-input-row">
                  <Button
                    disabled={!canEdit}
                    variant={urlMode === "baseUrlEnv" ? "primary" : "secondary"}
                    onClick={() => setUrlMode("baseUrlEnv")}
                  >
                    Variabile d&apos;ambiente
                  </Button>
                  <Button
                    disabled={!canEdit}
                    variant={urlMode === "baseUrl" ? "primary" : "secondary"}
                    onClick={() => setUrlMode("baseUrl")}
                  >
                    URL esplicito
                  </Button>
                </div>
                {urlMode === "baseUrlEnv" ? (
                  <label>
                    Nome variabile
                    <input
                      disabled={!canEdit}
                      value={draft.baseUrlEnv || ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          baseUrlEnv: event.target.value.trim().toUpperCase(),
                          baseUrl: undefined,
                        })
                      }
                      placeholder="IFTTT_WEBHOOK_BASE_URL"
                    />
                    <small className="field-hint">
                      Mostra solo il nome: il valore non viene richiesto né
                      visualizzato.
                    </small>
                  </label>
                ) : (
                  <label>
                    URL
                    <input
                      disabled={!canEdit}
                      value={draft.baseUrl || ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          baseUrl: event.target.value.trim(),
                          baseUrlEnv: undefined,
                        })
                      }
                      placeholder="https://api.example.com"
                    />
                  </label>
                )}
              </fieldset>

              <label>
                Autenticazione
                <select
                  disabled={!canEdit}
                  value={draft.authType}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      authType: event.target.value as HttpAuthType,
                      authConfig: {},
                    })
                  }
                >
                  {HTTP_AUTH_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <AuthConfigFields
                authType={draft.authType}
                authConfig={draft.authConfig}
                disabled={!canEdit}
                onChange={(authConfig) => setDraft({ ...draft, authConfig })}
              />

              <fieldset className="dynamic-checks">
                <legend>Metodi consentiti</legend>
                <div className="status-chip-list">
                  {HTTP_METHODS.map((method) => {
                    const checked = draft.allowedMethods.includes(method);
                    return (
                      <label
                        key={method}
                        className={`status-chip ${checked ? "selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={checked}
                          onChange={(event) => {
                            const allowedMethods = event.target.checked
                              ? [...draft.allowedMethods, method]
                              : draft.allowedMethods.filter((item) => item !== method);
                            setDraft({ ...draft, allowedMethods });
                          }}
                        />
                        {method}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label>
                Prefissi percorso (uno per riga)
                <textarea
                  disabled={!canEdit}
                  rows={3}
                  value={prefixesDraft}
                  onChange={(event) => setPrefixesDraft(event.target.value)}
                />
              </label>

              <label>
                Timeout (secondi)
                <input
                  type="number"
                  min={1}
                  max={120}
                  disabled={!canEdit}
                  value={draft.timeoutSeconds}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      timeoutSeconds: Number(event.target.value) || 1,
                    })
                  }
                />
              </label>

              <label>
                Header predefiniti (JSON)
                <textarea
                  disabled={!canEdit}
                  rows={4}
                  value={headersDraft}
                  onChange={(event) => setHeadersDraft(event.target.value)}
                />
              </label>
            </div>

            {formError ? (
              <div className="error-banner">
                <AlertTriangle size={16} />
                <span>{formError}</span>
              </div>
            ) : null}

            <div className="modal-actions">
              <Button onClick={() => setDraft(null)}>Annulla</Button>
              <Button
                variant="primary"
                disabled={!canEdit || upsertConnection.isPending}
                onClick={() => void save()}
              >
                Salva connessione
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {notice ? (
        <Toast message={notice} onClose={() => setNotice(null)} />
      ) : null}
    </AppShell>
  );
}

function AuthConfigFields({
  authType,
  authConfig,
  disabled,
  onChange,
}: {
  authType: HttpAuthType;
  authConfig: Record<string, string>;
  disabled?: boolean;
  onChange: (value: Record<string, string>) => void;
}) {
  if (authType === "none") {
    return (
      <p className="field-hint">Nessuna autenticazione aggiuntiva.</p>
    );
  }

  if (authType === "bearer_env") {
    return (
      <label>
        tokenEnv
        <input
          disabled={disabled}
          value={authConfig.tokenEnv || ""}
          onChange={(event) =>
            onChange({ tokenEnv: event.target.value.trim().toUpperCase() })
          }
          placeholder="EXTERNAL_API_TOKEN"
        />
        <small className="field-hint">
          Solo il nome della variabile d&apos;ambiente, mai il token.
        </small>
      </label>
    );
  }

  if (authType === "api_key_env") {
    return (
      <>
        <label>
          headerName
          <input
            disabled={disabled}
            value={authConfig.headerName || ""}
            onChange={(event) =>
              onChange({
                ...authConfig,
                headerName: event.target.value.trim(),
              })
            }
            placeholder="X-API-Key"
          />
        </label>
        <label>
          valueEnv
          <input
            disabled={disabled}
            value={authConfig.valueEnv || ""}
            onChange={(event) =>
              onChange({
                ...authConfig,
                valueEnv: event.target.value.trim().toUpperCase(),
              })
            }
            placeholder="EXTERNAL_API_KEY"
          />
        </label>
      </>
    );
  }

  return (
    <>
      <label>
        usernameEnv
        <input
          disabled={disabled}
          value={authConfig.usernameEnv || ""}
          onChange={(event) =>
            onChange({
              ...authConfig,
              usernameEnv: event.target.value.trim().toUpperCase(),
            })
          }
          placeholder="EXTERNAL_API_USERNAME"
        />
      </label>
      <label>
        passwordEnv
        <input
          disabled={disabled}
          value={authConfig.passwordEnv || ""}
          onChange={(event) =>
            onChange({
              ...authConfig,
              passwordEnv: event.target.value.trim().toUpperCase(),
            })
          }
          placeholder="EXTERNAL_API_PASSWORD"
        />
      </label>
    </>
  );
}

function buildAuthConfig(
  authType: HttpAuthType,
  authConfig: Record<string, string>,
): Record<string, string> {
  if (authType === "bearer_env") {
    return { tokenEnv: authConfig.tokenEnv || "" };
  }
  if (authType === "api_key_env") {
    return {
      headerName: authConfig.headerName || "",
      valueEnv: authConfig.valueEnv || "",
    };
  }
  if (authType === "basic_env") {
    return {
      usernameEnv: authConfig.usernameEnv || "",
      passwordEnv: authConfig.passwordEnv || "",
    };
  }
  return {};
}
