import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, Moon, Sun } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { useThemeContext } from "@/components/theme/ThemeProvider";
import { getLucySession, userInitials } from "@/lib/lucy-auth";
import { clearLucySession } from "@/lib/lucy-auth";
import type { Role } from "@/types/flow";
import type { ReactNode } from "react";

const ROLES: Role[] = ["viewer", "editor", "operator"];
const ENVIRONMENT_LABEL =
  import.meta.env.VITE_ENVIRONMENT_LABEL ||
  (import.meta.env.DEV ? "Locale" : "Produzione");

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
  const session = getLucySession();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const displayName =
    session?.user.full_name || session?.user.username || "Operatore";

  useEffect(() => {
    const closeProfile = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", closeProfile);
    return () => document.removeEventListener("mousedown", closeProfile);
  }, []);

  return (
    <div className="app">
      <header className="list-header">
        <Link
          to="/"
          className="brand header-logo-link"
          aria-label="Lucy - torna ai flussi"
        >
          <span className="brand-logo" aria-hidden />
        </Link>

        <div className="header-product" aria-label={`${title}, ${subtitle}`}>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </div>

        <div className="header-actions">
          <span className="environment">
            <i />
            {ENVIRONMENT_LABEL}
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

          <div className="profile-menu" ref={profileRef}>
            <button
              type="button"
              className="user-chip"
              aria-label="Apri menu profilo"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span className="avatar">{userInitials(session?.user)}</span>
              <span>
                <b>{displayName}</b>
                <small>
                  {role} <ChevronDown size={12} aria-hidden />
                </small>
              </span>
            </button>
            {profileOpen ? (
              <div className="profile-dropdown">
                <div>
                  <b>{displayName}</b>
                  <small>{session?.user.username || role}</small>
                </div>
                {session ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearLucySession();
                      window.location.reload();
                    }}
                  >
                    <LogOut size={16} /> Esci
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
