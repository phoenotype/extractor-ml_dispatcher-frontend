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
  return (
    canRunFlows(options.role) &&
    !options.legacy &&
    !options.dirty &&
    options.valid &&
    options.hasRecentSimulation
  );
}
