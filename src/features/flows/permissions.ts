import type { Role } from "@/types/flow";

export function canEditFlows(role: Role): boolean {
  return role === "editor" || role === "operator";
}

export function canRunFlows(role: Role): boolean {
  return role === "operator";
}

export function canValidate(role: Role): boolean {
  return role === "viewer" || role === "editor" || role === "operator";
}

export function canSimulate(role: Role): boolean {
  return role === "viewer" || role === "editor" || role === "operator";
}

export function canActivate(role: Role): boolean {
  return canEditFlows(role);
}

export function isReadOnlyRole(role: Role): boolean {
  return role === "viewer";
}

export function canRunNow(options: {
  role: Role;
  legacy: boolean;
  dirty: boolean;
  valid: boolean;
  hasRecentSimulation: boolean;
}): boolean {
  return runDisabledReason(options) === null;
}

export function runDisabledReason(options: {
  role: Role;
  legacy: boolean;
  dirty: boolean;
  valid: boolean;
  hasRecentSimulation: boolean;
}): string | null {
  if (!canRunFlows(options.role)) return "Disponibile solo con ruolo operator";
  if (options.legacy) return "I flussi legacy sono disponibili in sola lettura";
  if (options.dirty) return "Salva le modifiche prima di eseguire";
  if (!options.valid) return "Valida il flusso prima di eseguire";
  if (!options.hasRecentSimulation) {
    return "Esegui una simulazione valida negli ultimi 30 minuti";
  }
  return null;
}
