// Copyright 2026 VirtusCo
// Zustand store for ROS 2 Studio webview state

import { create } from 'zustand';

// ── Types (mirrored from extension host) ────────────────────────────

export interface ROS2Status {
  connected: boolean;
  version: string;
  rosbridgeRunning: boolean;
}

export interface NodeHealth {
  name: string;
  package: string;
  status: 'alive' | 'dead' | 'degraded';
  last_seen: number;
  pub_count: number;
  sub_count: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  topic: string;
}

export interface NodeGraphData {
  nodes: NodeHealth[];
  edges: GraphEdge[];
}

export interface FSMState {
  state: string;
  trigger: string;
  timestamp: number;
}

export interface DecodedField {
  name: string;
  value: number | string;
  unit: string;
}

export interface DecodedFrame {
  raw_hex: string;
  msg_type: number;
  msg_name: string;
  fields: DecodedField[];
  crc_valid: boolean;
}

export interface TopicData {
  name: string;
  type: string;
  hz: number;
  status: 'ok' | 'silent' | 'missing';
  lastMessage?: unknown;
}

export type PageId = 'topics' | 'graph' | 'fsm' | 'bridge' | 'launch' | 'commands';

// ── Store ───────────────────────────────────────────────────────────

interface ROS2StoreState {
  activePage: PageId;
  ros2Status: ROS2Status;
  topics: Map<string, TopicData>;
  nodeGraph: NodeGraphData;
  fsmState: string;
  fsmHistory: FSMState[];
  bridgeFrames: DecodedFrame[];
  commandOutput: { cmd: string; output: string; exitCode: number }[];
  launchCode: string;

  setActivePage: (page: PageId) => void;
  setRos2Status: (status: ROS2Status) => void;
  updateTopic: (name: string, data: Partial<TopicData>) => void;
  setTopics: (topics: TopicData[]) => void;
  setNodeGraph: (graph: NodeGraphData) => void;
  pushFsmState: (state: FSMState) => void;
  pushBridgeFrame: (frame: DecodedFrame) => void;
  clearBridgeFrames: () => void;
  setCommandOutput: (cmd: string, output: string, exitCode: number) => void;
  setLaunchCode: (code: string) => void;
}

export const useRos2Store = create<ROS2StoreState>((set) => ({
  activePage: 'topics',
  ros2Status: { connected: false, version: '', rosbridgeRunning: false },
  topics: new Map(),
  nodeGraph: { nodes: [], edges: [] },
  fsmState: 'IDLE',
  fsmHistory: [],
  bridgeFrames: [],
  commandOutput: [],
  launchCode: '',

  setActivePage: (page) => set({ activePage: page }),

  setRos2Status: (status) => set({ ros2Status: status }),

  updateTopic: (name, data) =>
    set((state) => {
      const newTopics = new Map(state.topics);
      const existing = newTopics.get(name);
      if (existing) {
        newTopics.set(name, { ...existing, ...data });
      } else {
        newTopics.set(name, {
          name,
          type: '',
          hz: 0,
          status: 'ok',
          ...data,
        });
      }
      return { topics: newTopics };
    }),

  setTopics: (topics) =>
    set(() => {
      const map = new Map<string, TopicData>();
      for (const t of topics) {
        map.set(t.name, t);
      }
      return { topics: map };
    }),

  setNodeGraph: (graph) => set({ nodeGraph: graph }),

  pushFsmState: (fsmStateEntry) =>
    set((state) => {
      const newHistory = [...state.fsmHistory, fsmStateEntry];
      if (newHistory.length > 20) {
        newHistory.shift();
      }
      return { fsmState: fsmStateEntry.state, fsmHistory: newHistory };
    }),

  pushBridgeFrame: (frame) =>
    set((state) => {
      const newFrames = [...state.bridgeFrames, frame];
      if (newFrames.length > 200) {
        newFrames.shift();
      }
      return { bridgeFrames: newFrames };
    }),

  clearBridgeFrames: () => set({ bridgeFrames: [] }),

  setCommandOutput: (cmd, output, exitCode) =>
    set((state) => ({
      commandOutput: [...state.commandOutput, { cmd, output, exitCode }],
    })),

  setLaunchCode: (code) => set({ launchCode: code }),
}));
