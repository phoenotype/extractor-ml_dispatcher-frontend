import { Link } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { useThemeContext } from "@/components/theme/ThemeProvider";
import type { Role } from "@/types/flow";
import type { ReactNode } from "react";

const ROLES: Role[] = ["viewer", "editor", "operator"];

interface AppShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function AppShell({
  children,
  title = "Extractor ML Dispatcher",
  subtitle = "Editor flussi",
}: AppShellProps) {
  const { role, setRole } = useRole();
  const { theme, toggleTheme } = useThemeContext();

  return (
    <div className="app">
      <header className="list-header">
        <Link to="/" className="brand" style={{ textDecoration: "none" }}>
          <span className="brand-logo" aria-hidden />
          <span className="brand-copy">
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </span>
        </Link>

        <div className="header-actions">
          <span className="environment">
            <i />
            Locale
          </span>

          <label className="sr-only" htmlFor="role-select">
            Ruolo
          </label>
          <select
            id="role-select"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            aria-label="Ruolo"
          >
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="icon-button theme-toggle"
            onClick={toggleTheme}
            aria-label={
              theme === "light" ? "Attiva tema scuro" : "Attiva tema chiaro"
            }
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <div className="user-chip" aria-label="Utente corrente">
            <span className="avatar">AG</span>
            <span>
              <b>Operatore</b>
              <small>{role}</small>
            </span>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
