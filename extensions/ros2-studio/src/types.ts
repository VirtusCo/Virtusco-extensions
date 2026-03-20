// Copyright 2026 VirtusCo
// Shared type definitions for Virtus ROS 2 Studio

// ── ROS 2 Topic Definition ─────────────────────────────────────────

export interface TopicDef {
  name: string;
  type: string;
  category: 'sensor' | 'navigation' | 'control' | 'ai' | 'bridge' | 'diagnostics';
  hz_expected: number;
}

// ── Node Health ─────────────────────────────────────────────────────

export interface NodeHealth {
  name: string;
  package: string;
  status: 'alive' | 'dead' | 'degraded';
  last_seen: number;
  pub_count: number;
  sub_count: number;
}

// ── FSM ─────────────────────────────────────────────────────────────

export interface FSMState {
  state: string;
  trigger: string;
  timestamp: number;
}

// ── ESP32 Bridge Frame ──────────────────────────────────────────────

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

// ── Launch Builder ──────────────────────────────────────────────────

export interface LaunchNodeConfig {
  pkg: string;
  executable: string;
  name: string;
  params: Record<string, string | number | boolean>;
  remappings: Record<string, string>;
}

// ── ROS 2 Connection Status ─────────────────────────────────────────

export interface ROS2Status {
  connected: boolean;
  version: string;
  rosbridgeRunning: boolean;
}

// ── Discovered Topic (runtime) ──────────────────────────────────────

export interface DiscoveredTopic {
  name: string;
  type: string;
  hz: number;
  status: 'ok' | 'silent' | 'missing';
}

// ── Node Graph Edge ─────────────────────────────────────────────────

export interface GraphEdge {
  source: string;
  target: string;
  topic: string;
}

// ── Node Graph Data ─────────────────────────────────────────────────

export interface NodeGraphData {
  nodes: NodeHealth[];
  edges: GraphEdge[];
}

// ── Messages: Webview → Extension Host ──────────────────────────────

export type WebviewMessage =
  | { type: 'subscribeTopic'; topic: string }
  | { type: 'unsubscribeTopic'; topic: string }
  | { type: 'runCommand'; cmd: string }
  | { type: 'getNodeGraph' }
  | { type: 'saveLaunch'; nodes: LaunchNodeConfig[] }
  | { type: 'connectBridge'; port: string; baud: number }
  | { type: 'disconnectBridge' }
  | { type: 'generateLaunch'; nodes: LaunchNodeConfig[] }
  | { type: 'refreshGraph' }
  | { type: 'openStudio' }
  | { type: 'connectRos2' }
  | { type: 'setActivePage'; page: string }
  | { type: 'importWorkspace' }
  | { type: 'generatePackage'; packageName: string; language: 'cpp' | 'python'; description: string; nodes: unknown[] };

// ── Messages: Extension Host → Webview ──────────────────────────────

export type HostMessage =
  | { type: 'topicMessage'; topic: string; data: unknown }
  | { type: 'topicHz'; topic: string; hz: number }
  | { type: 'nodeGraph'; graph: NodeGraphData }
  | { type: 'fsmState'; state: FSMState }
  | { type: 'bridgeFrame'; frame: DecodedFrame }
  | { type: 'ros2Status'; status: ROS2Status }
  | { type: 'nodeAlert'; node: string; status: 'alive' | 'dead' | 'degraded' }
  | { type: 'launchSaved'; path: string }
  | { type: 'launchGenerated'; code: string }
  | { type: 'commandOutput'; cmd: string; output: string; exitCode: number }
  | { type: 'importedGraph'; packages: unknown[]; launchFiles: unknown[]; topicGraph: unknown[] }
  | { type: 'importError'; error: string }
  | { type: 'packageGenerated'; files: string[] };
