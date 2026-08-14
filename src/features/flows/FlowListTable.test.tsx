import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlowListTable } from "@/features/flows/FlowListTable";
import type { FlowListItem } from "@/types/flow";

const item: FlowListItem = {
  flowName: "ultimo_flusso",
  isActive: false,
  format: "visual_v1",
  editable: true,
  updatedAt: "2026-08-14T16:33:00Z",
};

describe("FlowListTable", () => {
  it("apre verso l'alto il menu azioni dell'ultima riga", () => {
    const { container } = render(
      <FlowListTable
        items={[item]}
        canEdit
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onToggleActive={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Azioni" }));

    expect(container.querySelector(".flow-table")).toBeTruthy();
    expect(container.querySelector(".table-row.menu-open")).toBeTruthy();
    expect(container.querySelector(".row-menu.row-menu-up")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Attiva/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
