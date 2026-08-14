export type HttpAuthType = "none" | "bearer_env" | "api_key_env" | "basic_env";

export interface HttpConnection {
  connectionName: string;
  baseUrl?: string;
  baseUrlEnv?: string;
  authType: HttpAuthType;
  authConfig: Record<string, string>;
  defaultHeaders: Record<string, string>;
  allowedMethods: string[];
  allowedPathPrefixes: string[];
  timeoutSeconds: number;
  isActive: boolean;
}

export type HttpConnectionUpsert = Omit<HttpConnection, "connectionName"> & {
  connectionName?: string;
};

export const HTTP_AUTH_TYPES: HttpAuthType[] = [
  "none",
  "bearer_env",
  "api_key_env",
  "basic_env",
];

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
] as const;
