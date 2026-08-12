import { buildLucyAuthHeaders, getLucyUserInfoHeader } from "@/lib/lucy-auth";
import { getDispatcherConfig } from "./config";

export async function dispatcherFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { apiBase, useMocks } = getDispatcherConfig();

  if (!useMocks && !getLucyUserInfoHeader()) {
    // Let the BFF return 401 too, but fail fast with a clear client signal.
    throw new Error("Sessione Lucy assente: effettua il login");
  }

  const headers = buildLucyAuthHeaders({
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(init?.headers || {}),
  });

  // Role hint for BFF (never escalates above Lucy-inferred privileges).
  const role =
    typeof window !== "undefined"
      ? window.localStorage.getItem("dispatcher.role")
      : null;
  if (role === "viewer" || role === "editor" || role === "operator") {
    headers["X-Dispatcher-Role"] = role;
  }

  return fetch(`${apiBase}${path}`, {
    ...init,
    headers,
  });
}
