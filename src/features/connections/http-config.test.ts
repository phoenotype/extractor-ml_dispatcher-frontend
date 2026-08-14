import { describe, expect, it } from "vitest";
import {
  isRelativeHttpPath,
  looksLikeAbsoluteUrl,
  pathLooksSensitive,
  sanitizeHttpRequestConfig,
  validateHttpRequestConfig,
} from "@/features/connections/http-config";
import { ApiError } from "@/services/api/client";
import { normalizeConnections, toValidationResult } from "@/services/api/dispatcher";
import { mockConnections } from "@/services/api/mocks";
import type { HttpConnection } from "@/types/connection";

const connections: HttpConnection[] = mockConnections;

describe("connections API (mock)", () => {
  it("carica l'elenco delle connessioni", async () => {
    // Force mock path via createDispatcherApi only works if env is set;
    // use normalize + mock data contract instead, and live mockApi via list.
    const listed = normalizeConnections({ items: mockConnections });
    expect(listed.map((item) => item.connectionName)).toContain(
      "ifttt_dispatcher",
    );
    expect(listed.find((item) => item.connectionName === "ifttt_dispatcher")?.baseUrlEnv).toBe(
      "IFTTT_WEBHOOK_BASE_URL",
    );
    expect(
      listed.every(
        (item) =>
          Boolean(item.baseUrl) !== Boolean(item.baseUrlEnv) ||
          Boolean(item.baseUrl) ||
          Boolean(item.baseUrlEnv),
      ),
    ).toBe(true);
  });
});

describe("connectionRef e path HTTP", () => {
  it("accetta connectionRef da menu e rifiuta URL assoluti nel path", () => {
    const ok = validateHttpRequestConfig(
      {
        connectionRef: "ifttt_dispatcher",
        method: "POST",
        path: "/",
        successStatusCodes: [200],
      },
      connections,
    );
    expect(ok).toEqual([]);

    const badRef = validateHttpRequestConfig(
      {
        connectionRef: "https://evil.example/hook",
        method: "POST",
        path: "/",
        successStatusCodes: [200],
      },
      connections,
    );
    expect(badRef.some((msg) => /connectionRef/i.test(msg))).toBe(true);

    const badPath = validateHttpRequestConfig(
      {
        connectionRef: "ifttt_dispatcher",
        method: "POST",
        path: "https://api.example.com/hook",
        successStatusCodes: [200],
      },
      connections,
    );
    expect(badPath.some((msg) => /path/i.test(msg))).toBe(true);
    expect(looksLikeAbsoluteUrl("https://api.example.com/hook")).toBe(true);
    expect(isRelativeHttpPath("/webhooks/ifttt")).toBe(true);
  });

  it("omite i campi opzionali vuoti", () => {
    expect(
      sanitizeHttpRequestConfig({
        connectionRef: "ifttt_dispatcher",
        method: "POST",
        path: "/",
        headers: "",
        timeoutSeconds: 0,
        body: undefined,
        successStatusCodes: [200],
      }),
    ).toEqual({
      connectionRef: "ifttt_dispatcher",
      method: "POST",
      path: "/",
      successStatusCodes: [200],
    });
  });

  it("richiede headers come oggetto JSON", () => {
    const issues = validateHttpRequestConfig(
      {
        connectionRef: "ifttt_dispatcher",
        method: "POST",
        path: "/",
        headers: "not-an-object",
        successStatusCodes: [200],
      },
      connections,
    );
    expect(issues.some((msg) => /headers/i.test(msg))).toBe(true);
  });

  it("accetta timeout valido e rifiuta fuori range", () => {
    expect(
      validateHttpRequestConfig(
        {
          connectionRef: "ifttt_dispatcher",
          method: "POST",
          path: "/",
          timeoutSeconds: 20,
          successStatusCodes: [200],
        },
        connections,
      ),
    ).toEqual([]);
    expect(
      validateHttpRequestConfig(
        {
          connectionRef: "ifttt_dispatcher",
          method: "POST",
          path: "/",
          timeoutSeconds: 0,
          successStatusCodes: [200],
        },
        connections,
      ).some((msg) => /timeoutSeconds/i.test(msg)),
    ).toBe(true);
  });

  it("impedisce di salvare segreti direttamente nel flusso", () => {
    const issues = validateHttpRequestConfig(
      {
        connectionRef: "ifttt_dispatcher",
        method: "POST",
        path: "/",
        headers: { Authorization: "Bearer super-secret" },
        successStatusCodes: [200],
      },
      connections,
    );
    expect(issues.some((msg) => /segreti/i.test(msg))).toBe(true);
  });

  it("segnala URL sensibili nel path", () => {
    expect(pathLooksSensitive("/hooks/key/abc123")).toBe(true);
    expect(pathLooksSensitive("/ok?token=xyz")).toBe(true);
    expect(pathLooksSensitive("/webhooks/ifttt")).toBe(false);
  });
});

describe("errori 422", () => {
  it("toValidationResult espone il messaggio senza trattarlo come rete", () => {
    const error = new ApiError(422, "Node send_ifttt_webhook: path non valido", [
      { msg: "Node send_ifttt_webhook: path non valido", nodeId: "send_ifttt_webhook" },
    ]);
    const result = toValidationResult(error);
    expect(result?.valid).toBe(false);
    expect(result?.issues?.[0]?.message).toContain("path non valido");
    expect(result?.issues?.[0]?.nodeId).toBe("send_ifttt_webhook");
    expect(error.isValidation).toBe(true);
    expect(error.message).not.toMatch(/non raggiungibile/i);
  });
});

describe("mock validate http_request", () => {
  it("rifiuta connectionRef sconosciuto rispetto alle connessioni caricate", () => {
    const issues = validateHttpRequestConfig(
      {
        connectionRef: "missing_conn",
        method: "POST",
        path: "/",
        successStatusCodes: [200],
      },
      connections,
    );
    expect(issues.some((msg) => msg.includes("Connessione non trovata"))).toBe(
      true,
    );
  });
});
