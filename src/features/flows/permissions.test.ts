import { describe, expect, it } from "vitest";
import {
  canEditFlows,
  canRunFlows,
  canRunNow,
  isReadOnlyRole,
} from "./permissions";

describe("permissions", () => {
  it("viewer è sola lettura", () => {
    expect(isReadOnlyRole("viewer")).toBe(true);
    expect(canEditFlows("viewer")).toBe(false);
    expect(canRunFlows("viewer")).toBe(false);
  });

  it("editor può modificare ma non eseguire", () => {
    expect(canEditFlows("editor")).toBe(true);
    expect(canRunFlows("editor")).toBe(false);
  });

  it("operator può eseguire solo con condizioni", () => {
    expect(canRunFlows("operator")).toBe(true);
    expect(
      canRunNow({
        role: "operator",
        legacy: false,
        dirty: false,
        valid: true,
        hasRecentSimulation: true,
      }),
    ).toBe(true);
    expect(
      canRunNow({
        role: "operator",
        legacy: false,
        dirty: true,
        valid: true,
        hasRecentSimulation: true,
      }),
    ).toBe(false);
    expect(
      canRunNow({
        role: "operator",
        legacy: false,
        dirty: false,
        valid: true,
        hasRecentSimulation: false,
      }),
    ).toBe(false);
  });
});
