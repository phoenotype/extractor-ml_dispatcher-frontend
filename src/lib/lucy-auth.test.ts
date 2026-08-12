import { describe, expect, it, beforeEach } from "vitest";
import { buildLucyAuthHeaders, LUCY_SESSION_KEY } from "@/lib/lucy-auth";

describe("buildLucyAuthHeaders", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("attaches Lucy UserInfo and strips Google Authorization / API keys", () => {
    localStorage.setItem(
      LUCY_SESSION_KEY,
      JSON.stringify({
        access_token: "lucy-session-token",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        user: { username: "demo" },
      }),
    );

    const headers = buildLucyAuthHeaders({
      Authorization: "Bearer should-not-leak",
      "X-API-Key": "secret",
      Accept: "application/json",
    });

    expect(headers["X-Endpoint-API-UserInfo"]).toBe("lucy-session-token");
    expect(headers.Authorization).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
    expect(headers["X-API-Key"]).toBeUndefined();
    expect(headers["x-api-key"]).toBeUndefined();
    expect(headers.Accept || headers.accept).toBe("application/json");
  });
});
