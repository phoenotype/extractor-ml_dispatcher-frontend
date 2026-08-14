export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "unknown";

function codeFromStatus(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "validation";
    default:
      return "unknown";
  }
}

function messageFromStatus(status: number, fallback?: string): string {
  if (fallback) return fallback;
  switch (status) {
    case 401:
      return "Autenticazione richiesta";
    case 403:
      return "Operazione non consentita";
    case 404:
      return "Risorsa non trovata";
    case 409:
      return "Conflitto di versione o stato";
    case 422:
      return "Definizione non valida";
    default:
      return "Il backend ha restituito un errore";
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(status: number, message?: string, details?: unknown) {
    super(messageFromStatus(status, message));
    this.name = "ApiError";
    this.status = status;
    this.code = codeFromStatus(status);
    this.details = details;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConflict() {
    return this.status === 409;
  }

  get isValidation() {
    return this.status === 422;
  }
}

export function flowStatusErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Operazione non riuscita";
  if (error.status === 404) return "Flusso non trovato";
  if (error.status === 409) {
    return "Il flusso è stato modificato da un altro utente. Ricarica e riprova";
  }
  if (error.status === 422) {
    const details = Array.isArray(error.details) ? error.details : [];
    const messages = details
      .map((detail) =>
        detail && typeof detail === "object" && "msg" in detail
          ? String((detail as { msg: unknown }).msg)
          : "",
      )
      .filter(Boolean);
    return messages.length > 0 ? messages.join(" · ") : error.message;
  }
  return error.message;
}

function extractDetailMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
    const first = detail[0] as { msg?: string };
    if (typeof first.msg === "string") return first.msg;
  }
  const message = (body as { message?: unknown }).message;
  if (typeof message === "string") return message;
  return undefined;
}

export async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function assertOk(response: Response): Promise<unknown> {
  const body = await parseJsonSafe(response);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractDetailMessage(body),
      typeof body === "object" && body !== null
        ? (body as { detail?: unknown }).detail ?? body
        : body,
    );
  }
  return body;
}
