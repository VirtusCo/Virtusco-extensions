// Copyright 2026 VirtusCo
// Zustand store for flow graph state

import { create } from 'zustand';
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { VirtusNodeDefUI } from '../nodes/registry';

interface DynamicNodeFromHost {
  type: string;
  category: string;
  label: string;
  icon: string;
  color: string;
  subsystem: string;
  functionName: string;
  returnType: string;
  params: { type: string; name: string }[];
  brief: string;
  confFlags: string[];
  headerFile: string;
}

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  boardId: string;
  supportedNodeTypes: string[];
  dynamicNodeDefs: VirtusNodeDefUI[];
  zephyrVersion: string;
  setNodes: (updater: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (updater: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  setSelectedNodeId: (id: string | null) => void;
  setBoard: (boardId: string, supportedNodeTypes: string[]) => void;
  setDynamicNodes: (nodes: DynamicNodeFromHost[], zephyrVersion: string) => void;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  boardId: 'esp32_devkitc_wroom',
  supportedNodeTypes: [],
  dynamicNodeDefs: [],
  zephyrVersion: '',

  setNodes: (updater) => {
    if (typeof updater === 'function') {
      set({ nodes: updater(get().nodes) });
    } else {
      set({ nodes: updater });
    }
  },

  setEdges: (updater) => {
    if (typeof updater === 'function') {
      set({ edges: updater(get().edges) });
    } else {
      set({ edges: updater });
    }
  },

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  setBoard: (boardId, supportedNodeTypes) =>
    set({ boardId, supportedNodeTypes }),

  setDynamicNodes: (hostNodes, zephyrVersion) => {
    // Convert host-side dynamic nodes to webview VirtusNodeDefUI format
    const defs: VirtusNodeDefUI[] = hostNodes.map(n => ({
      type: n.type,
      category: (n.category === 'rtos' ? 'rtos' : 'peripheral') as VirtusNodeDefUI['category'],
      label: n.label,
      icon: n.icon,
      color: n.color,
      inputs: n.params
        .filter(p => p.name && p.type.includes('*'))
        .slice(0, 3)
        .map((p, i) => ({
          id: `param_${i}`,
          label: p.name || `in${i}`,
          type: 'data' as const,
        })),
      outputs: n.returnType !== 'void' ? [{ id: 'return', label: 'Result', type: 'data' as const }] : [],
      configSchema: n.params
        .filter(p => p.name && !p.type.includes('device'))
        .map(p => ({
          key: p.name,
          label: p.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          type: (p.type.includes('int') || p.type.includes('size') || p.type.includes('uint')
            ? 'number' : 'text') as 'number' | 'text',
          default: p.type.includes('int') ? 0 : '',
        })),
      // Extra metadata for display
      _subsystem: n.subsystem,
      _functionName: n.functionName,
      _brief: n.brief,
      _headerFile: n.headerFile,
      _confFlags: n.confFlags,
    } as VirtusNodeDefUI & Record<string, unknown>));

    set({ dynamicNodeDefs: defs, zephyrVersion });
  },
}));
