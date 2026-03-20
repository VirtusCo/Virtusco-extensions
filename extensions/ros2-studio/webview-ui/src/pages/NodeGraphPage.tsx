// Copyright 2026 VirtusCo
// Node graph page — React Flow visualization of ROS 2 node connections

import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRos2Store, NodeHealth } from '../store/ros2Store';
import { vscode } from '../vscodeApi';

// Package color mapping
const PACKAGE_COLORS: Record<string, string> = {
  ydlidar_driver: '#2196f3',
  porter_lidar_processor: '#00bcd4',
  porter_orchestrator: '#9c27b0',
  porter_esp32_bridge: '#ff9800',
  porter_ai_assistant: '#4caf50',
  nav2: '#9e9e9e',
  unknown: '#666666',
};

// Required nodes checklist
const REQUIRED_NODES = [
  '/ydlidar_driver',
  '/porter_lidar_processor',
  '/porter_orchestrator',
  '/esp32_motor_bridge',
  '/esp32_sensor_bridge',
  '/porter_ai_assistant',
];

/**
 * Simple topological layer layout for dagre-like positioning.
 */
function layoutNodes(nodeHealths: NodeHealth[], edges: { source: string; target: string; topic: string }[]): {
  flowNodes: Node[];
  flowEdges: Edge[];
} {
  // Build adjacency for layers
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const n of nodeHealths) {
    inDegree.set(n.name, 0);
    adjList.set(n.name, []);
  }

  for (const e of edges) {
    const current = inDegree.get(e.target) ?? 0;
    inDegree.set(e.target, current + 1);
    const neighbors = adjList.get(e.source) ?? [];
    neighbors.push(e.target);
    adjList.set(e.source, neighbors);
  }

  // Assign layers via BFS (Kahn's algorithm)
  const layers = new Map<string, number>();
  const queue: string[] = [];

  for (const [node, deg] of inDegree) {
    if (deg === 0) {
      queue.push(node);
      layers.set(node, 0);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current) ?? 0;
    const neighbors = adjList.get(current) ?? [];

    for (const neighbor of neighbors) {
      const newLayer = currentLayer + 1;
      const existingLayer = layers.get(neighbor);
      if (existingLayer === undefined || newLayer > existingLayer) {
        layers.set(neighbor, newLayer);
      }

      const deg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, deg);
      if (deg <= 0) {
        queue.push(neighbor);
      }
    }
  }

  // Ensure all nodes have a layer
  for (const n of nodeHealths) {
    if (!layers.has(n.name)) {
      layers.set(n.name, 0);
    }
  }

  // Group by layer
  const layerGroups = new Map<number, NodeHealth[]>();
  for (const n of nodeHealths) {
    const layer = layers.get(n.name) ?? 0;
    if (!layerGroups.has(layer)) {
      layerGroups.set(layer, []);
    }
    layerGroups.get(layer)!.push(n);
  }

  // Position nodes
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 60;
  const LAYER_GAP_X = 300;
  const NODE_GAP_Y = 80;

  const flowNodes: Node[] = [];

  for (const [layer, nodesInLayer] of layerGroups) {
    const totalHeight = nodesInLayer.length * NODE_GAP_Y;
    const startY = -totalHeight / 2;

    for (let i = 0; i < nodesInLayer.length; i++) {
      const n = nodesInLayer[i];
      const color = PACKAGE_COLORS[n.package] ?? PACKAGE_COLORS.unknown;
      const isDead = n.status === 'dead';

      flowNodes.push({
        id: n.name,
        position: { x: layer * LAYER_GAP_X, y: startY + i * NODE_GAP_Y },
        data: {
          label: n.name.replace(/^\//, ''),
        },
        style: {
          background: isDead ? '#b71c1c' : color,
          color: '#fff',
          border: isDead ? '2px solid #f44336' : `1px solid ${color}`,
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '11px',
          fontWeight: 600,
          width: NODE_WIDTH,
          textAlign: 'center' as const,
          opacity: isDead ? 0.7 : 1,
        },
      });
    }
  }

  // Build edges
  const flowEdges: Edge[] = edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.topic,
    animated: true,
    style: { stroke: '#666' },
    labelStyle: { fontSize: '9px', fill: '#aaa' },
  }));

  return { flowNodes, flowEdges };
}

export function NodeGraphPage(): React.ReactElement {
  const nodeGraph = useRos2Store((s) => s.nodeGraph);

  const { flowNodes, flowEdges } = useMemo(
    () => layoutNodes(nodeGraph.nodes, nodeGraph.edges),
    [nodeGraph]
  );

  const handleRefresh = useCallback(() => {
    vscode.postMessage({ type: 'refreshGraph' });
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px',
        borderBottom: '1px solid var(--vscode-panel-border, #333)',
        flexShrink: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Node Graph</h2>
        <button
          onClick={handleRefresh}
          style={{
            padding: '4px 12px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Required Nodes Checklist */}
      <div style={{
        display: 'flex',
        gap: '12px',
        padding: '8px 12px',
        borderBottom: '1px solid var(--vscode-panel-border, #333)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {REQUIRED_NODES.map((name) => {
          const node = nodeGraph.nodes.find((n) => n.name === name);
          const isAlive = node?.status === 'alive';
          return (
            <span key={name} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: isAlive ? '#4caf50' : '#f44336',
            }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isAlive ? '#4caf50' : '#f44336',
              }} />
              {name.replace(/^\//, '')}
            </span>
          );
        })}
      </div>

      {/* Graph */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {flowNodes.length > 0 ? (
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            fitView
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            minZoom={0.3}
            maxZoom={2}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--vscode-descriptionForeground)',
          }}>
            No nodes detected. Click Refresh to scan.
          </div>
        )}
      </div>
    </div>
  );
}
