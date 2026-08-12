import http from "node:http";
import { URL } from "node:url";

const BFF_PORT = Number(process.env.BFF_PORT || 8787);
const DISPATCHER_API_URL = (
  process.env.DISPATCHER_API_URL ||
  process.env.VITE_DISPATCHER_API_URL ||
  ""
).replace(/\/$/, "");
const DISPATCHER_AUTH_HEADER = process.env.DISPATCHER_AUTH_HEADER || "";
const VITE_ORIGIN = process.env.VITE_ORIGIN || "http://localhost:5173";
const PROXY_PREFIX = "/api/dispatcher";

function corsHeaders(origin) {
  const allowed =
    !origin ||
    origin === VITE_ORIGIN ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin || VITE_ORIGIN : VITE_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Accept, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function sendJson(res, status, body, origin) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...corsHeaders(origin),
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

async function proxyToDispatcher(req, res, targetPath, origin) {
  if (!DISPATCHER_API_URL) {
    sendJson(
      res,
      500,
      {
        detail:
          "DISPATCHER_API_URL non configurata. Impostarla nel BFF o avviare con mock lato client.",
      },
      origin,
    );
    return;
  }

  const upstreamUrl = new URL(targetPath, `${DISPATCHER_API_URL}/`);
  if (req.url) {
    const incoming = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    upstreamUrl.search = incoming.search;
  }

  const headers = {
    Accept: req.headers.accept || "application/json",
    "Content-Type": req.headers["content-type"] || "application/json",
  };

  if (DISPATCHER_AUTH_HEADER) {
    headers.Authorization = DISPATCHER_AUTH_HEADER;
  }

  const method = req.method || "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await readRequestBody(req) : undefined;

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore di rete verso il dispatcher";
    console.error(`[bff] upstream error ${method} ${upstreamUrl.pathname}: ${message}`);
    sendJson(res, 502, { detail: "Dispatcher non raggiungibile" }, origin);
    return;
  }

  const responseHeaders = {
    ...corsHeaders(origin),
  };
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders["Content-Type"] = contentType;

  const buffer = Buffer.from(await upstream.arrayBuffer());
  responseHeaders["Content-Length"] = String(buffer.byteLength);

  console.info(
    `[bff] ${method} ${PROXY_PREFIX}${targetPath === "/" ? "" : targetPath} -> ${upstream.status}`,
  );

  res.writeHead(upstream.status, responseHeaders);
  res.end(buffer);
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const method = req.method || "GET";
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (requestUrl.pathname === "/healthz") {
    sendJson(
      res,
      200,
      {
        status: "ok",
        dispatcherConfigured: Boolean(DISPATCHER_API_URL),
        authConfigured: Boolean(DISPATCHER_AUTH_HEADER),
      },
      origin,
    );
    return;
  }

  const rewritten = rewriteDispatcherPath(requestUrl.pathname);
  if (rewritten === null) {
    sendJson(res, 404, { detail: "Not found" }, origin);
    return;
  }

  await proxyToDispatcher(req, res, rewritten, origin);
});

server.listen(BFF_PORT, () => {
  console.info(`[bff] listening on http://localhost:${BFF_PORT}`);
  console.info(`[bff] proxy ${PROXY_PREFIX}/* -> ${DISPATCHER_API_URL || "(unset)"}`);
  console.info(`[bff] CORS origin: ${VITE_ORIGIN}`);
  console.info(
    `[bff] auth header: ${DISPATCHER_AUTH_HEADER ? "configured" : "not set"}`,
  );
});
