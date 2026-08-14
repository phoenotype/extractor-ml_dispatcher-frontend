import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SimulationTraceView } from "@/features/simulation/SimulationTraceView";

describe("SimulationTraceView", () => {
  it("mostra l'esecuzione HTTP mascherata e mantiene gli skipped senza I/O", () => {
    const { container } = render(
      <SimulationTraceView
        documents={[
          {
            protocol: 3141,
            databaseWrites: 0,
            externalCallsAttempted: 1,
            externalCallsSucceeded: 1,
            trace: [
              {
                nodeId: "send_http",
                nodeType: "action.http_request",
                status: "executed",
                input: { protocol: 3141 },
                details: {
                  httpExecution: {
                    status: "completed",
                    request: { method: "POST", url: "https://masked/***" },
                    response: { statusCode: 200, body: "ok" },
                  },
                },
              },
              {
                nodeId: "not_reached",
                nodeType: "stop",
                status: "skipped",
                details: { reason: "Ramo non selezionato" },
              },
            ],
          },
        ]}
        index={0}
        onIndexChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Chiamata HTTP realmente eseguita")).toBeTruthy();
    expect(screen.getByText("HTTP eseguito")).toBeTruthy();
    expect(screen.getAllByText(/Ramo non selezionato/)).toHaveLength(1);
    expect(container.querySelector(".http-completed details[open]")).toBeTruthy();
    expect(container.querySelector(".is-skipped .trace-io")).toBeNull();
    expect(container.textContent).toContain("https://masked/***");
  });
});
