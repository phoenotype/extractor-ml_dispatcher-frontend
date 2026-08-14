import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";

/**
 * Backend-for-frontend for Extractor ML Dispatcher.
 *
 * Browser → Lucy session headers → BFF → upstream auth adapter → dispatcher
 *
 * Never accept Google ID tokens, API keys, or static cloud credentials from the browser.
 *
 * DISPATCHER_AUTH_MODE:
 * - google_id_token (default): Cloud Run IAM via ADC / metadata / GOOGLE_ID_TOKEN
 * - bearer: server-only DISPATCHER_BEARER_TOKEN
 * - none: no Authorization header
 */

const BFF_PORT = Number(process.env.PORT || process.env.BFF_PORT || 8787);
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || "dist");
const DISPATCHER_API_URL = (process.env.DISPATCHER_API_URL || "")
  .trim()
  .replace(/\/$/, "");
const DISPATCHER_AUDIENCE = (
  process.env.DISPATCHER_AUDIENCE ||
  DISPATCHER_API_URL
)
  .trim()
  .replace(/\/$/, "");
const EXTRACTOR_ML_API_URL = (process.env.EXTRACTOR_ML_API_URL || "")
  .trim()
  .replace(/\/$/, "");
const VITE_ORIGIN = process.env.VITE_ORIGIN || "http://localhost:5173";
const PROXY_PREFIX = "/api/dispatcher";
const SKIP_LUCY_AUTH = process.env.BFF_SKIP_LUCY_AUTH === "true";
const DEFAULT_ROLE = normalizeRole(process.env.BFF_DEFAULT_ROLE) || "viewer";
const DISPATCHER_AUTH_MODE = normalizeAuthMode(process.env.DISPATCHER_AUTH_MODE);

/** @type {{ token: string, expiresAt: number } | null} */
let cachedIdToken = null;
/** @type {import("google-auth-library").GoogleAuth | null} */
let googleAuth = null;

const ROLE_RANK = { viewer: 1, editor: 2, operator: 3 };

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function normalizeAuthMode(value) {
  const mode = String(value || "google_id_token").trim().toLowerCase();
  if (mode === "bearer" || mode === "none" || mode === "google_id_token") {
    return mode;
  }
  console.warn(
    `[bff] unknown DISPATCHER_AUTH_MODE="${value}", falling back to google_id_token`,
  );
  return "google_id_token";
}

function assertBffConfig() {
  const errors = [];
  if (!DISPATCHER_API_URL) {
    errors.push("DISPATCHER_API_URL is required (no hardcoded Cloud Run fallback)");
  }
  if (!SKIP_LUCY_AUTH && !EXTRACTOR_ML_API_URL) {
    errors.push("EXTRACTOR_ML_API_URL is required unless BFF_SKIP_LUCY_AUTH=true");
  }
  if (DISPATCHER_AUTH_MODE === "google_id_token" && !DISPATCHER_AUDIENCE) {
    errors.push("DISPATCHER_AUDIENCE is required for google_id_token mode");
  }
  if (
    DISPATCHER_AUTH_MODE === "bearer" &&
    !process.env.DISPATCHER_BEARER_TOKEN?.trim()
  ) {
    errors.push("DISPATCHER_BEARER_TOKEN is required for bearer mode");
  }
  if (errors.length) {
    for (const message of errors) console.error(`[bff] config: ${message}`);
    process.exit(1);
  }
}

async function serveFrontend(req, res, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(res, 400, { detail: "Percorso non valido" });
    return;
  }

  const requested = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
  let filePath = path.resolve(STATIC_DIR, requested);
  if (!filePath.startsWith(`${STATIC_DIR}${path.sep}`) && filePath !== STATIC_DIR) {
    sendJson(res, 403, { detail: "Percorso non consentito" });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("not a file");
  } catch {
    if (path.extname(requested)) {
      sendJson(res, 404, { detail: "Not found" });
      return;
    }
    filePath = path.join(STATIC_DIR, "index.html");
  }

  try {
    const body = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "Cache-Control":
        extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    });
    if (req.method === "HEAD") res.end();
    else res.end(body);
  } catch {
    sendJson(res, 503, { detail: "Frontend non disponibile" });
  }
}


function normalizeRole(value) {
  if (value === "viewer" || value === "editor" || value === "operator") {
    return value;
  }
  return null;
}

function corsHeaders(origin) {
  const allowed =
    !origin ||
    origin === VITE_ORIGIN ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin || VITE_ORIGIN : VITE_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Accept, X-Requested-With, X-Endpoint-API-UserInfo, X-Endpoint-API-OTP, X-Dispatcher-Role",
    "Access-Control-Expose-Headers": "X-Dispatcher-Role",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function sendJson(res, status, body, origin, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...corsHeaders(origin),
    ...extraHeaders,
  });
  res.end(payload);
}

function rewriteDispatcherPath(pathname) {
  if (!pathname.startsWith(PROXY_PREFIX)) return null;
  const rest = pathname.slice(PROXY_PREFIX.length);
  return rest || "/";
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function requiredActionFor(method, path) {
  const normalized = path.replace(/\/+$/, "") || "/";
  if (method === "POST" && /\/runs$/.test(normalized)) {
    return "DISPATCHER_RUN";
  }
  if (method === "POST" && /\/simulations$/.test(normalized)) {
    return "DISPATCHER_SIMULATE";
  }
  if (method === "POST" && /\/validate$/.test(normalized)) {
    return "DISPATCHER_VALIDATE";
  }
  if (method === "POST" && normalized === "/flows") {
    return "DISPATCHER_CREATE";
  }
  if (method === "PUT" || method === "PATCH") {
    return "DISPATCHER_EDIT";
  }
  if (method === "DELETE") {
    return "DISPATCHER_DEACTIVATE";
  }
  return "DISPATCHER_VIEW";
}

function roleSatisfies(actual, required) {
  return (ROLE_RANK[actual] || 0) >= (ROLE_RANK[required] || 99);
}

function inferRoleFromPrograms(programs) {
  if (!Array.isArray(programs) || programs.length === 0) return DEFAULT_ROLE;
  const haystack = programs
    .flatMap((program) => {
      const grants = Array.isArray(program.company_grants)
        ? program.company_grants
        : [];
      const actions = Array.isArray(program.actions) ? program.actions : [];
      return [
        program.program_name,
        program.module_link,
        program.moduleLink,
        program.url,
        program.privilege?.priv_code,
        program.privilege?.priv_name,
        ...grants.map((g) => g.role_code),
        ...grants.map((g) => g.priv_code),
        ...actions.map((a) => a.action_code || a.priv_code || a.code),
      ];
    })
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    haystack.includes("operator") ||
    haystack.includes("dispatch_run") ||
    haystack.includes("dispatcher_run")
  ) {
    return "operator";
  }
  if (
    haystack.includes("editor") ||
    haystack.includes("dispatch_edit") ||
    haystack.includes("dispatcher_edit") ||
    haystack.includes("write")
  ) {
    return "editor";
  }
  return "viewer";
}

function dispatcherActionsFromPrograms(programs) {
  if (!Array.isArray(programs)) return new Set();
  return new Set(
    programs
      .filter(
        (program) =>
          String(program.module_link || program.moduleLink || "").toLowerCase() ===
          "dispatcher",
      )
      .flatMap((program) =>
        Array.isArray(program.actions) ? program.actions : [],
      )
      .map((action) => String(action.action_code || "").toUpperCase())
      .filter(Boolean),
  );
}

function devActionsForRole(role) {
  const actions = new Set([
    "DISPATCHER_VIEW",
    "DISPATCHER_VALIDATE",
    "DISPATCHER_SIMULATE",
  ]);
  if (roleSatisfies(role, "editor")) {
    actions.add("DISPATCHER_CREATE");
    actions.add("DISPATCHER_EDIT");
    actions.add("DISPATCHER_DEACTIVATE");
  }
  if (roleSatisfies(role, "operator")) actions.add("DISPATCHER_RUN");
  return actions;
}

async function validateLucySession(req) {
  if (SKIP_LUCY_AUTH) {
    const role = normalizeRole(req.headers["x-dispatcher-role"]) || DEFAULT_ROLE;
    return {
      role,
      user: { username: "dev" },
      actions: devActionsForRole(role),
    };
  }

  const userInfo = req.headers["x-endpoint-api-userinfo"];
  if (!userInfo || typeof userInfo !== "string") {
    const error = new Error("Sessione Lucy mancante (X-Endpoint-API-UserInfo)");
    error.status = 401;
    throw error;
  }

  const headers = {
    Accept: "application/json",
    "X-Endpoint-API-UserInfo": userInfo,
  };
  const otp = req.headers["x-endpoint-api-otp"];
  if (typeof otp === "string" && otp) {
    headers["X-Endpoint-API-OTP"] = otp;
  }

  let response;
  try {
    response = await fetch(`${EXTRACTOR_ML_API_URL}/auth/me`, {
      method: "GET",
      headers,
    });
  } catch (error) {
    const err = new Error("Impossibile validare la sessione Lucy");
    err.status = 502;
    err.cause = error;
    throw err;
  }

  if (response.status === 401 || response.status === 403) {
    const err = new Error("Sessione Lucy non valida o scaduta");
    err.status = response.status;
    throw err;
  }
  if (!response.ok) {
    const err = new Error("Validazione sessione Lucy fallita");
    err.status = 502;
    throw err;
  }

  const payload = await response.json().catch(() => ({}));
  const user = payload?.user ?? payload ?? {};
  const programs = Array.isArray(payload?.programs) ? payload.programs : [];
  const requested = normalizeRole(req.headers["x-dispatcher-role"]);
  const inferred = inferRoleFromPrograms(programs);
  // UX may request a lower role; never escalate above inferred privilege.
  const role =
    requested && roleSatisfies(inferred, requested) ? requested : inferred;

  return { role, user, programs, actions: dispatcherActionsFromPrograms(programs) };
}

async function fetchMetadataIdentityToken(audience) {
  const metadataUrl = new URL(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity",
  );
  metadataUrl.searchParams.set("audience", audience);
  metadataUrl.searchParams.set("format", "full");

  const response = await fetch(metadataUrl, {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!response.ok) {
    throw new Error(`Metadata identity failed (${response.status})`);
  }
  return (await response.text()).trim();
}

async function fetchAdcIdentityToken(audience) {
  if (!googleAuth) {
    const { GoogleAuth } = await import("google-auth-library");
    googleAuth = new GoogleAuth();
  }
  const client = await googleAuth.getIdTokenClient(audience);
  const headers = await client.getRequestHeaders();
  const authorization = headers.Authorization || headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("ADC non ha prodotto un ID token Bearer");
  }
  return authorization.slice("Bearer ".length);
}

function decodeJwtExp(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function getGoogleIdToken() {
  const now = Date.now();
  if (cachedIdToken && cachedIdToken.expiresAt > now + 60_000) {
    return cachedIdToken.token;
  }

  // Local override only (never expose as VITE_*). Prefer ADC / metadata in real envs.
  const fromEnv = process.env.GOOGLE_ID_TOKEN?.trim();
  if (fromEnv) {
    const exp = decodeJwtExp(fromEnv) || now + 45 * 60_000;
    cachedIdToken = { token: fromEnv, expiresAt: exp };
    return fromEnv;
  }

  let token;
  try {
    token = await fetchMetadataIdentityToken(DISPATCHER_AUDIENCE);
  } catch {
    token = await fetchAdcIdentityToken(DISPATCHER_AUDIENCE);
  }

  const exp = decodeJwtExp(token) || now + 45 * 60_000;
  cachedIdToken = { token, expiresAt: exp };
  return token;
}

/**
 * Upstream auth adapter — cloud-provider specifics stay behind this boundary.
 * @returns {Promise<string | null>} raw bearer token, or null when mode=none
 */
async function resolveUpstreamAccessToken() {
  if (DISPATCHER_AUTH_MODE === "none") return null;
  if (DISPATCHER_AUTH_MODE === "bearer") {
    const token = process.env.DISPATCHER_BEARER_TOKEN?.trim();
    if (!token) throw new Error("DISPATCHER_BEARER_TOKEN mancante");
    return token;
  }
  return getGoogleIdToken();
}

async function proxyToDispatcher(req, res, targetPath, origin, role) {
  if (!DISPATCHER_API_URL) {
    sendJson(
      res,
      500,
      { detail: "DISPATCHER_API_URL non configurata sul BFF." },
      origin,
    );
    return;
  }

  let accessToken;
  try {
    accessToken = await resolveUpstreamAccessToken();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upstream auth non disponibile";
    console.error(`[bff] upstream auth error: ${message}`);
    sendJson(
      res,
      503,
      {
        detail:
          DISPATCHER_AUTH_MODE === "google_id_token"
            ? "Impossibile ottenere un Google ID token. Configura ADC, metadata server o GOOGLE_ID_TOKEN (solo server)."
            : `Autenticazione upstream non disponibile (mode=${DISPATCHER_AUTH_MODE}).`,
      },
      origin,
    );
    return;
  }

  const upstreamUrl = new URL(targetPath, `${DISPATCHER_API_URL}/`);
  if (req.url) {
    const incoming = new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`,
    );
    upstreamUrl.search = incoming.search;
  }

  // Only BFF-owned auth toward upstream. Never forward browser Authorization / API keys.
  const headers = {
    Accept: req.headers.accept || "application/json",
    "Content-Type": req.headers["content-type"] || "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const method = req.method || "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await readRequestBody(req) : undefined;

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, { method, headers, body });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore di rete verso il dispatcher";
    console.error(
      `[bff] upstream error ${method} ${upstreamUrl.pathname}: ${message}`,
    );
    sendJson(res, 502, { detail: "Dispatcher non raggiungibile" }, origin);
    return;
  }

  const responseHeaders = {
    ...corsHeaders(origin),
    "X-Dispatcher-Role": role,
  };
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders["Content-Type"] = contentType;

  const buffer = Buffer.from(await upstream.arrayBuffer());
  responseHeaders["Content-Length"] = String(buffer.byteLength);

  console.info(
    `[bff] ${method} ${PROXY_PREFIX}${targetPath === "/" ? "" : targetPath} role=${role} auth=${DISPATCHER_AUTH_MODE} -> ${upstream.status}`,
  );

  res.writeHead(upstream.status, responseHeaders);
  res.end(buffer);
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const method = req.method || "GET";
  const requestUrl = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  );

  if (method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (
    requestUrl.pathname === "/healthz" ||
    requestUrl.pathname === "/api/healthz"
  ) {
    sendJson(
      res,
      200,
      {
        status: "ok",
        dispatcherConfigured: Boolean(DISPATCHER_API_URL),
        audience: DISPATCHER_AUDIENCE || null,
        lucyAuth: SKIP_LUCY_AUTH ? "skipped" : "required",
        authMode: DISPATCHER_AUTH_MODE,
        idTokenMode:
          DISPATCHER_AUTH_MODE === "google_id_token"
            ? process.env.GOOGLE_ID_TOKEN
              ? "env"
              : "adc-or-metadata"
            : DISPATCHER_AUTH_MODE,
        staticDir: STATIC_DIR,
      },
      origin,
    );
    return;
  }

  if (!requestUrl.pathname.startsWith(PROXY_PREFIX)) {
    if (method !== "GET" && method !== "HEAD") {
      sendJson(res, 405, { detail: "Method not allowed" }, origin);
      return;
    }
    await serveFrontend(req, res, requestUrl.pathname);
    return;
  }

  const rewritten = rewriteDispatcherPath(requestUrl.pathname);
  if (rewritten === null) {
    sendJson(res, 404, { detail: "Not found" }, origin);
    return;
  }

  let session;
  try {
    session = await validateLucySession(req);
  } catch (error) {
    const status = error?.status || 401;
    sendJson(res, status, { detail: error.message || "Non autenticato" }, origin);
    return;
  }

  const required = requiredActionFor(method, rewritten);
  if (!session.actions.has(required)) {
    sendJson(
      res,
      403,
      {
        detail: `Permesso insufficiente: richiesto ${required}`,
      },
      origin,
      { "X-Dispatcher-Role": session.role },
    );
    return;
  }

  await proxyToDispatcher(req, res, rewritten, origin, session.role);
});

assertBffConfig();

server.listen(BFF_PORT, "0.0.0.0", () => {
  console.info(`[bff] listening on http://0.0.0.0:${BFF_PORT}`);
  console.info(`[bff] proxy ${PROXY_PREFIX}/* -> ${DISPATCHER_API_URL}`);
  console.info(`[bff] auth mode: ${DISPATCHER_AUTH_MODE}`);
  if (DISPATCHER_AUTH_MODE === "google_id_token") {
    console.info(`[bff] audience: ${DISPATCHER_AUDIENCE}`);
    console.info(
      `[bff] id token: ${process.env.GOOGLE_ID_TOKEN ? "GOOGLE_ID_TOKEN env" : "ADC/metadata"}`,
    );
  }
  console.info(`[bff] lucy auth: ${SKIP_LUCY_AUTH ? "skipped" : EXTRACTOR_ML_API_URL + "/auth/me"}`);
  console.info(`[bff] static: ${STATIC_DIR}`);
});
