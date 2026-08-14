import type { HttpConnection, HttpAuthType } from "@/types/connection";

const SENSITIVE_URL_RE =
  /\/key\/|([?&]|^)(token|api[_-]?key|password|secret|access_token)=/i;

export function looksLikeAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function isRelativeHttpPath(value: string): boolean {
  const path = value.trim();
  return path.startsWith("/") && !looksLikeAbsoluteUrl(path);
}

export function pathLooksSensitive(value: string): boolean {
  return SENSITIVE_URL_RE.test(value);
}

export function isValidStatusCode(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
  );
}

export function isValidTimeoutSeconds(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 120
  );
}

export function sanitizeHttpRequestConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "timeoutSeconds" && (value === 0 || value === "0")) continue;
    if (key === "headers" && value === "") continue;
    next[key] = value;
  }
  return next;
}

export function validateHttpRequestConfig(
  config: Record<string, unknown>,
  connections: HttpConnection[],
): string[] {
  const issues: string[] = [];
  const connectionRef = String(config.connectionRef || "").trim();
  const path = String(config.path || "").trim();
  const method = String(config.method || "").trim().toUpperCase();

  if (!connectionRef) {
    issues.push("connectionRef è obbligatorio");
  } else if (looksLikeAbsoluteUrl(connectionRef)) {
    issues.push("connectionRef non può essere un URL: seleziona una connessione");
  } else {
    const connection = connections.find(
      (item) => item.connectionName === connectionRef,
    );
    if (!connection) {
      issues.push(`Connessione non trovata: ${connectionRef}`);
    } else {
      if (!connection.isActive) {
        issues.push(`La connessione ${connectionRef} non è attiva`);
      }
      if (
        method &&
        connection.allowedMethods.length &&
        !connection.allowedMethods.map((m) => m.toUpperCase()).includes(method)
      ) {
        issues.push(
          `Metodo ${method} non consentito dalla connessione ${connectionRef}`,
        );
      }
    }
  }

  if (!path) {
    issues.push("path è obbligatorio");
  } else if (!isRelativeHttpPath(path)) {
    issues.push("path deve essere relativo e iniziare con / (niente http/https)");
  }

  if (config.headers !== undefined) {
    if (
      !config.headers ||
      typeof config.headers !== "object" ||
      Array.isArray(config.headers)
    ) {
      issues.push("headers deve essere un oggetto JSON");
    }
  }

  if (config.body !== undefined && typeof config.body === "string") {
    issues.push("body deve essere JSON valido, non una stringa grezza");
  }

  if (Array.isArray(config.successStatusCodes)) {
    if (!config.successStatusCodes.every(isValidStatusCode)) {
      issues.push("successStatusCodes deve contenere solo codici tra 100 e 599");
    }
  } else if (config.successStatusCodes !== undefined) {
    issues.push("successStatusCodes deve essere un array di numeri");
  }

  if (!isValidTimeoutSeconds(config.timeoutSeconds)) {
    issues.push("timeoutSeconds deve essere omesso oppure compreso tra 1 e 120");
  }

  const blob = JSON.stringify(config);
  if (
    /"(password|token|apiKey|api_key|authorization)"\s*:\s*"[^"]+"/i.test(blob)
  ) {
    issues.push(
      "Non inserire segreti nel JSON del flusso: usa connectionRef e variabili d'ambiente",
    );
  }

  return issues;
}

export function validateConnectionDraft(
  draft: Partial<HttpConnection>,
): string[] {
  const issues: string[] = [];
  const name = String(draft.connectionName || "").trim();
  if (!name) issues.push("connectionName è obbligatorio");

  const hasUrl = Boolean(String(draft.baseUrl || "").trim());
  const hasEnv = Boolean(String(draft.baseUrlEnv || "").trim());
  if (hasUrl === hasEnv) {
    issues.push("Valorizza esattamente uno tra baseUrl e baseUrlEnv");
  }
  if (hasUrl && looksLikeAbsoluteUrl(String(draft.baseUrl)) === false) {
    issues.push("baseUrl deve essere un URL assoluto https:// o http://");
  }
  if (hasUrl && pathLooksSensitive(String(draft.baseUrl))) {
    issues.push(
      "baseUrl sembra contenere segreti: preferisci baseUrlEnv",
    );
  }

  const authType = (draft.authType || "none") as HttpAuthType;
  const authConfig = draft.authConfig || {};
  if (authType === "bearer_env" && !authConfig.tokenEnv?.trim()) {
    issues.push("authConfig.tokenEnv è obbligatorio per bearer_env");
  }
  if (authType === "api_key_env") {
    if (!authConfig.headerName?.trim()) {
      issues.push("authConfig.headerName è obbligatorio per api_key_env");
    }
    if (!authConfig.valueEnv?.trim()) {
      issues.push("authConfig.valueEnv è obbligatorio per api_key_env");
    }
  }
  if (authType === "basic_env") {
    if (!authConfig.usernameEnv?.trim()) {
      issues.push("authConfig.usernameEnv è obbligatorio per basic_env");
    }
    if (!authConfig.passwordEnv?.trim()) {
      issues.push("authConfig.passwordEnv è obbligatorio per basic_env");
    }
  }

  for (const [key, value] of Object.entries(authConfig)) {
    if (/token|password|secret|key/i.test(key) && /[=:]/.test(value)) {
      issues.push(
        `authConfig.${key} deve contenere solo il nome della variabile d'ambiente`,
      );
    }
  }

  if (!Array.isArray(draft.allowedMethods) || draft.allowedMethods.length === 0) {
    issues.push("Seleziona almeno un metodo consentito");
  }
  if (
    !Array.isArray(draft.allowedPathPrefixes) ||
    draft.allowedPathPrefixes.length === 0
  ) {
    issues.push("Indica almeno un prefisso di percorso consentito");
  }
  const timeout = draft.timeoutSeconds;
  if (
    typeof timeout !== "number" ||
    !Number.isInteger(timeout) ||
    timeout < 1 ||
    timeout > 120
  ) {
    issues.push("timeoutSeconds deve essere compreso tra 1 e 120");
  }

  return issues;
}

export function normalizeConnection(draft: HttpConnection): HttpConnection {
  const hasEnv = Boolean(draft.baseUrlEnv?.trim());
  return {
    connectionName: draft.connectionName.trim(),
    ...(hasEnv
      ? { baseUrlEnv: draft.baseUrlEnv!.trim() }
      : { baseUrl: draft.baseUrl!.trim() }),
    authType: draft.authType,
    authConfig: Object.fromEntries(
      Object.entries(draft.authConfig || {})
        .map(([key, value]) => [key, String(value).trim()])
        .filter(([, value]) => value),
    ),
    defaultHeaders: draft.defaultHeaders || {},
    allowedMethods: (draft.allowedMethods || []).map((m) => m.toUpperCase()),
    allowedPathPrefixes: (draft.allowedPathPrefixes || []).map((p) =>
      p.startsWith("/") ? p : `/${p}`,
    ),
    timeoutSeconds: draft.timeoutSeconds,
    isActive: Boolean(draft.isActive),
  };
}
