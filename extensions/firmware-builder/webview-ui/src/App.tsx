// Copyright 2026 VirtusCo
// Root App: canvas + palette + config panel

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  BackgroundVariant,
  Node,
  Edge,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { VirtusNode } from './components/VirtusNode';
import { NodePalette } from './panels/NodePalette';
import { ConfigPanel } from './panels/ConfigPanel';
import { useFlowStore } from './store/flowStore';
import { nodeDefRegistry } from './nodes/registry';

const nodeTypes = { virtusNode: VirtusNode };

const vscode = acquireVsCodeApi();

export default function App() {
  const {
    nodes, edges, setNodes, setEdges,
    onNodesChange, onEdgesChange,
    selectedNodeId, setSelectedNodeId,
    setBoard, setDynamicNodes,
  } = useFlowStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Handle edge connections
  const onConnect = useCallback((params: Connection) => {
    setEdges((eds: Edge[]) => addEdge({ ...params, animated: true }, eds));
  }, [setEdges]);

  // Validate connections — only allow same port type (signal↔signal, data↔data)
  const isValidConnection = useCallback((connection: Connection) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    const sourceType = (sourceNode.data as Record<string, unknown>).nodeType as string;
    const targetType = (targetNode.data as Record<string, unknown>).nodeType as string;
    const sourceDef = nodeDefRegistry[sourceType];
    const targetDef = nodeDefRegistry[targetType];
    if (!sourceDef || !targetDef) return true; // allow if unknown

    const sourcePort = sourceDef.outputs.find(p => p.id === connection.sourceHandle);
    const targetPort = targetDef.inputs.find(p => p.id === connection.targetHandle);
    if (!sourcePort || !targetPort) return true; // allow if port not found

    // Enforce type matching: signal↔signal, data↔data, power↔power
    return sourcePort.type === targetPort.type;
  }, [nodes]);

  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  // Drop node from palette
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const nodeType = event.dataTransfer.getData('application/virtus-node-type');
    if (!nodeType) return;

    const def = nodeDefRegistry[nodeType];
    if (!def) return;

    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!bounds) return;

    const position = {
      x: event.clientX - bounds.left - 80,
      y: event.clientY - bounds.top - 20,
    };

    const newNode: Node = {
      id: `${nodeType}_${Date.now()}`,
      type: 'virtusNode',
      position,
      data: {
        label: def.label,
        nodeType: nodeType,
        icon: def.icon,
        color: def.color,
        category: def.category,
        config: Object.fromEntries(
          def.configSchema.map(f => [f.key, f.default])
        ),
      },
    };

    setNodes((nds: Node[]) => [...nds, newNode]);
    setSelectedNodeId(newNode.id);
  }, [setNodes, setSelectedNodeId]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Generate code
  const handleGenerate = useCallback(() => {
    const graph = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: (n.data as Record<string, unknown>).nodeType as string,
        position: n.position,
        data: {
          label: (n.data as Record<string, unknown>).label as string,
          config: (n.data as Record<string, unknown>).config as Record<string, unknown>,
        },
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? '',
        targetHandle: e.targetHandle ?? '',
      })),
    };
    vscode.postMessage({ type: 'generateCode', payload: graph });
    setStatusMessage('Generating...');
  }, [nodes, edges]);

  // Save flow
  const handleSave = useCallback(() => {
    const graph = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: (n.data as Record<string, unknown>).nodeType as string,
        position: n.position,
        data: {
          label: (n.data as Record<string, unknown>).label as string,
          config: (n.data as Record<string, unknown>).config as Record<string, unknown>,
        },
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? '',
        targetHandle: e.targetHandle ?? '',
      })),
    };
    vscode.postMessage({ type: 'saveFlow', payload: graph });
    setStatusMessage('Saved');
  }, [nodes, edges]);

  // Listen for messages from extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case 'loadFlow': {
          const graph = msg.payload;
          if (graph.nodes?.length > 0) {
            const loadedNodes: Node[] = graph.nodes.map((n: Record<string, unknown>) => {
              const def = nodeDefRegistry[n.type as string];
              return {
                id: n.id,
                type: 'virtusNode',
                position: n.position,
                data: {
                  label: (n.data as Record<string, unknown>).label,
                  nodeType: n.type,
                  icon: def?.icon ?? 'cpu',
                  color: def?.color ?? '#666',
                  category: def?.category ?? 'peripheral',
                  config: (n.data as Record<string, unknown>).config,
                },
              };
            });
            setNodes(loadedNodes);
            setEdges(graph.edges ?? []);
            setStatusMessage(`Loaded ${loadedNodes.length} nodes`);
          }
          break;
        }
        case 'boardChanged':
          setBoard(msg.payload.boardId, msg.payload.supportedNodeTypes);
          setStatusMessage(`Board: ${msg.payload.boardId} (${msg.payload.supportedNodeTypes.length} node types)`);
          break;
        case 'dynamicNodes':
          setDynamicNodes(msg.payload.nodes, msg.payload.zephyrVersion);
          setStatusMessage(
            `Loaded ${msg.payload.nodes.length} Zephyr API nodes (v${msg.payload.zephyrVersion})`
          );
          break;
        case 'codegenStatus':
          setStatusMessage(
            msg.payload.status === 'ok'
              ? `Generated ${msg.payload.files?.length ?? 0} files`
              : `Error: ${msg.payload.message}`
          );
          break;
        case 'buildStatus':
        case 'flashStatus':
          setStatusMessage(msg.payload.message);
          break;
      }
    };
    window.addEventListener('message', handler);

    // Request saved flow on mount
    vscode.postMessage({ type: 'requestLoad', payload: null });

    return () => window.removeEventListener('message', handler);
  }, [setNodes, setEdges]);

  const selectedNode = selectedNodeId
    ? nodes.find(n => n.id === selectedNodeId)
    : null;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh' }}>
      {/* Left: Node Palette */}
      <NodePalette />

      {/* Center: Canvas */}
      <div ref={reactFlowWrapper} style={{ flex: 1, height: '100%' }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            defaultEdgeOptions={{ animated: true }}
            connectionLineStyle={{ stroke: '#4fc3f7', strokeWidth: 2 }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#333" />
            <Controls />
            <MiniMap
              nodeStrokeColor="#666"
              nodeColor={(n) => (n.data as Record<string, unknown>).color as string ?? '#444'}
              nodeBorderRadius={4}
            />

            {/* Toolbar */}
            <Panel position="top-right">
              <div style={{
                display: 'flex', gap: '6px', padding: '6px',
                background: 'var(--vscode-editor-background, #1e1e1e)',
                border: '1px solid var(--vscode-panel-border, #333)',
                borderRadius: '6px',
              }}>
                <ToolbarButton label="Generate" onClick={handleGenerate} primary />
                <ToolbarButton label="Save" onClick={handleSave} />
                <ToolbarButton label="Build" onClick={() => {
                  vscode.postMessage({
                    type: 'runBuild',
                    payload: { board: 'esp32_devkitc_wroom', pristine: false, extraArgs: '' },
                  });
                }} />
                <ToolbarButton label="Flash" onClick={() => {
                  vscode.postMessage({
                    type: 'flashDevice',
                    payload: { port: '/dev/ttyUSB0', runner: 'esptool', board: 'esp32' },
                  });
                }} />
              </div>
            </Panel>

            {/* Status bar */}
            {statusMessage && (
              <Panel position="bottom-center">
                <div style={{
                  padding: '4px 12px',
                  background: 'var(--vscode-statusBar-background, #007acc)',
                  color: 'var(--vscode-statusBar-foreground, #fff)',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}>
                  {statusMessage}
                </div>
              </Panel>
            )}
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {/* Right: Config Panel */}
      {selectedNode && (
        <ConfigPanel
          node={selectedNode}
          onConfigChange={(key, value) => {
            setNodes((nds: Node[]) =>
              nds.map(n => {
                if (n.id !== selectedNodeId) return n;
                return {
                  ...n,
                  data: {
                    ...n.data,
                    config: {
                      ...(n.data as Record<string, unknown>).config as Record<string, unknown>,
                      [key]: value,
                    },
                  },
                };
              })
            );
          }}
          onDelete={() => {
            setNodes((nds: Node[]) => nds.filter(n => n.id !== selectedNodeId));
            setSelectedNodeId(null);
          }}
        />
      )}
    </div>
  );
}

function ToolbarButton({ label, onClick, primary }: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        border: primary
          ? '1px solid var(--vscode-button-background, #0e639c)'
          : '1px solid var(--vscode-button-secondaryBackground, #3a3d41)',
        background: primary
          ? 'var(--vscode-button-background, #0e639c)'
          : 'var(--vscode-button-secondaryBackground, #3a3d41)',
        color: primary
          ? 'var(--vscode-button-foreground, #fff)'
          : 'var(--vscode-button-secondaryForeground, #ccc)',
        borderRadius: '4px',
      }}
    >
      {label}
    </button>
  );
}
