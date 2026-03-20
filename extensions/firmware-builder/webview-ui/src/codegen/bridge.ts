// Copyright 2026 VirtusCo
// Serializes graph state and sends to extension host via postMessage

import { Node, Edge } from '@xyflow/react';

interface FlowGraphPayload {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: {
      label: string;
      config: Record<string, unknown>;
    };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
  }>;
}

export function serializeGraph(nodes: Node[], edges: Edge[]): FlowGraphPayload {
  return {
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
}
