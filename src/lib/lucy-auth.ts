/**
 * Lucy session helpers for browser → BFF calls.
 * Never stores or sends Google ID tokens / API keys.
 */

export const LUCY_SESSION_KEY = "extractorMl.auth.session";
export const DISPATCHER_OTP_KEY = "dispatcher.lucy.otp";

export interface LucyAuthUser {
  id_user?: string;
  username: string;
  full_name?: string;
  email?: string;
}

export interface LucyAuthSession {
  access_token: string;
  token_body?: string;
  expires_at: string;
  user: LucyAuthUser;
  programs?: unknown[];
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getLucySession(): LucyAuthSession | null {
  const session = readJson<LucyAuthSession>(LUCY_SESSION_KEY);
  if (!session?.access_token || !session.expires_at) return null;
  if (Date.parse(session.expires_at) <= Date.now()) {
    clearLucySession();
    return null;
  }
  return session;
}

export function getLucyUserInfoHeader(): string | null {
  const session = getLucySession();
  if (!session) return null;
  // Lucy APIs use access_token in X-Endpoint-API-UserInfo (same as lcdataextractor authFetch).
  return session.access_token;
}

export function getLucyOtpHeader(): string | null {
  if (typeof window === "undefined") return null;
  const otp = window.sessionStorage.getItem(DISPATCHER_OTP_KEY);
  return otp?.trim() || null;
}

export function setLucyOtp(otp: string | null) {
  if (typeof window === "undefined") return;
  if (!otp) window.sessionStorage.removeItem(DISPATCHER_OTP_KEY);
  else window.sessionStorage.setItem(DISPATCHER_OTP_KEY, otp);
}

export function clearLucySession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LUCY_SESSION_KEY);
}

export function saveLucySession(session: LucyAuthSession) {
  window.localStorage.setItem(LUCY_SESSION_KEY, JSON.stringify(session));
}

export function buildLucyAuthHeaders(
  initHeaders?: HeadersInit,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (initHeaders) {
    new Headers(initHeaders).forEach((value, key) => {
      headers[key] = value;
    });
  }

  const userInfo = getLucyUserInfoHeader();
  if (userInfo) {
    headers["X-Endpoint-API-UserInfo"] = userInfo;
  }
  const otp = getLucyOtpHeader();
  if (otp) {
    headers["X-Endpoint-API-OTP"] = otp;
  }

  // Never attach Google Authorization or X-API-Key from the browser.
  delete headers.Authorization;
  delete headers.authorization;
  delete headers["X-API-Key"];
  delete headers["x-api-key"];

  return headers;
}

export function userInitials(user?: LucyAuthUser | null): string {
  const source = user?.full_name || user?.username || "?";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
