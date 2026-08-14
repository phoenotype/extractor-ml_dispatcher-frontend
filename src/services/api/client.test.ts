import { describe, expect, it } from "vitest";
import { ApiError, flowStatusErrorMessage } from "@/services/api/client";

describe("flowStatusErrorMessage", () => {
  it("traduce 404 e 409 con messaggi dedicati", () => {
    expect(flowStatusErrorMessage(new ApiError(404))).toBe(
      "Flusso non trovato",
    );
    expect(flowStatusErrorMessage(new ApiError(409))).toBe(
      "Il flusso è stato modificato da un altro utente. Ricarica e riprova",
    );
  });

  it("mostra tutti i problemi di validazione restituiti con 422", () => {
    const error = new ApiError(422, undefined, [
      { msg: "Trigger mancante" },
      { msg: "Connessione non valida" },
    ]);

    expect(flowStatusErrorMessage(error)).toBe(
      "Trigger mancante · Connessione non valida",
    );
    expect(flowStatusErrorMessage(error)).not.toMatch(/non raggiungibile/i);
  });
});
