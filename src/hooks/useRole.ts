import { useCallback, useState } from "react";
import type { Role } from "@/types/flow";
import { getDispatcherConfig } from "@/services/api/config";

const STORAGE_KEY = "dispatcher.role";

function isRole(value: string | null | undefined): value is Role {
  return value === "viewer" || value === "editor" || value === "operator";
}

function readInitialRole(): Role {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isRole(stored)) return stored;
  }
  return getDispatcherConfig().defaultRole;
}

export function useRole() {
  const [role, setRoleState] = useState<Role>(readInitialRole);

  const setRole = useCallback((next: Role) => {
    setRoleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return { role, setRole };
}
