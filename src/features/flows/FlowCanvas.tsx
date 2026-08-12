import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FlowNodeCard } from "@/components/flow/FlowNodeCard";
import { nodeVisual, type FlowNodeData } from "@/features/flows/flow-utils";

const nodeTypes = { flowNode: FlowNodeCard };

interface FlowCanvasProps {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  readOnly?: boolean;
  onNodesChange: (changes: NodeChange<Node<FlowNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onSelect: (nodeId: string | null) => void;
}

export function FlowCanvas({
  nodes,
  edges,
  readOnly,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelect,
}: FlowCanvasProps) {
  return (
    <div className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onSelect(node.id)}
        onSelectionChange={(params: OnSelectionChangeParams) => {
          onSelect(params.nodes[0]?.id ?? null);
        }}
        fitView
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        multiSelectionKeyCode="Shift"
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#dbe1e9" gap={22} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const color = nodeVisual(
              (node.data as FlowNodeData).catalogDefinition,
            ).color;
            if (color === "violet") return "#247079";
            if (color === "amber") return "#d49a31";
            if (color === "blue") return "#3d83cd";
            return "#718093";
          }}
        />
      </ReactFlow>
    </div>
  );
}
