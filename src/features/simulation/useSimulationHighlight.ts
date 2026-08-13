import { useMemo } from "react";
import type { FlowDefinition, SimulationDocument } from "@/types/flow";

export function useSimulationHighlight(
  flow: FlowDefinition,
  document: SimulationDocument | null,
) {
  return useMemo(() => {
    if (!document?.trace?.length) {
      return {
        tracedNodes: new Set<string>(),
        dimmedNodes: new Set<string>(),
        tracedEdges: new Set<string>(),
      };
    }

    const executedNodes = new Set(
      document.trace
        .filter((step) => !step.status || step.status === "executed")
        .map((step) => step.nodeId || step.node)
        .filter(Boolean) as string[],
    );
    const allTraceNodes = new Set(
      document.trace
        .map((step) => step.nodeId || step.node)
        .filter(Boolean) as string[],
    );

    // Prefer highlighting only executed nodes; skipped/unreached are dimmed.
    const tracedNodes =
      executedNodes.size > 0 ? executedNodes : allTraceNodes;
    const dimmedNodes = new Set(
      flow.nodes.map((node) => node.id).filter((id) => !tracedNodes.has(id)),
    );
    const tracedEdges = new Set<string>();
    const ordered = document.trace.filter(
      (step) => !step.status || step.status === "executed",
    );
    for (let i = 0; i < ordered.length - 1; i++) {
      const a = ordered[i];
      const b = ordered[i + 1];
      const source = a.nodeId || a.node;
      const target = b.nodeId || b.node;
      const edgeIndex = flow.edges.findIndex(
        (edge) => edge.source === source && edge.target === target,
      );
      if (edgeIndex >= 0) {
        tracedEdges.add(
          `${flow.edges[edgeIndex].source}-${flow.edges[edgeIndex].target}-${edgeIndex}`,
        );
      }
    }
    return { tracedNodes, dimmedNodes, tracedEdges };
  }, [document, flow]);
}
