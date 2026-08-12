export interface DispatcherClientConfig {
  apiBase: string;
  useMocks: boolean;
  defaultRole: "viewer" | "editor" | "operator";
}

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

function readRole(
  value: string | undefined,
): "viewer" | "editor" | "operator" {
  if (value === "viewer" || value === "editor" || value === "operator") {
    return value;
  }
  return "editor";
}

export function getDispatcherConfig(): DispatcherClientConfig {
  const apiBase = (
    import.meta.env.VITE_DISPATCHER_API_BASE || "/api/dispatcher"
  ).replace(/\/$/, "");

  return {
    apiBase,
    useMocks: readBool(import.meta.env.VITE_USE_DISPATCHER_MOCKS, false),
    defaultRole: readRole(import.meta.env.VITE_DEFAULT_ROLE),
  };
}
