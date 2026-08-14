import { useEffect, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import {
  clearLucySession,
  getLucySession,
  saveLucySession,
  type LucyAuthSession,
} from "@/lib/lucy-auth";

const EXTRACTOR_ML_API_URL = (
  import.meta.env.VITE_EXTRACTOR_ML_API_URL || ""
).replace(/\/$/, "");

interface LoginScreenProps {
  onAuthenticated: (session: LucyAuthSession) => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    EXTRACTOR_ML_API_URL
      ? null
      : "Configura VITE_EXTRACTOR_ML_API_URL (nessun URL Cloud Run hardcoded nel browser).",
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!EXTRACTOR_ML_API_URL) {
      setError(
        "Configura VITE_EXTRACTOR_ML_API_URL (nessun URL Cloud Run hardcoded nel browser).",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${EXTRACTOR_ML_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          language: "it",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body.detail === "string" ? body.detail : "Login non riuscito",
        );
      }

      const session: LucyAuthSession = {
        access_token: body.access_token,
        token_body: body.token_body,
        expires_at:
          body.expires_at ||
          new Date(Date.now() + (body.expires_in || 3600) * 1000).toISOString(),
        user: body.user || { username },
        programs: [],
      };
      saveLucySession(session);
      onAuthenticated(session);
    } catch (err) {
      clearLucySession();
      setError(err instanceof Error ? err.message : "Login non riuscito");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand" style={{ marginBottom: 18 }}>
          <span className="brand-logo" aria-hidden style={{ background: "#247079" }} />
          <span className="brand-copy">
            <strong style={{ color: "#2b2b2b" }}>Extractor ML</strong>
            <small style={{ color: "#6c6c6c" }}>Dispatcher</small>
          </span>
        </div>
        <h1>Accedi con Lucy</h1>
        <p>
          Il browser autentica solo verso Lucy tramite{" "}
          <code>VITE_EXTRACTOR_ML_API_URL</code>. L&apos;autenticazione verso il
          dispatcher resta sul BFF (
          <code>DISPATCHER_AUTH_MODE</code>).
        </p>
        <label>
          Username
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <div className="login-error">{error}</div> : null}
        <button
          className="primary"
          type="submit"
          disabled={busy || !EXTRACTOR_ML_API_URL}
        >
          {busy ? <Loader2 className="spin" size={16} /> : <LogIn size={16} />}
          Accedi
        </button>
      </form>
    </main>
  );
}

export function useLucyAuth() {
  const [session, setSession] = useState<LucyAuthSession | null>(() =>
    getLucySession(),
  );

  useEffect(() => {
    setSession(getLucySession());
  }, []);

  return {
    session,
    setSession,
    logout: () => {
      clearLucySession();
      setSession(null);
    },
  };
}
