// Copyright 2026 VirtusCo
// Shared type definitions for Virtus Firmware Builder

// ── Flow Graph Schema ────────────────────────────────────────────────

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, unknown>;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

// ── Node Definition Schema ───────────────────────────────────────────

export type NodeCategory = 'peripheral' | 'rtos' | 'pipeline' | 'composite';
export type PortType = 'signal' | 'data' | 'power';
export type ConfigFieldType = 'text' | 'number' | 'select' | 'boolean' | 'pin';

export interface PortDef {
  id: string;
  label: string;
  type: PortType;
}

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  default: unknown;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
}

export interface NodeCodegenDef {
  dtsFragment?: (cfg: Record<string, unknown>) => string;
  confFlags?: (cfg: Record<string, unknown>) => string[];
  headerCode?: (cfg: Record<string, unknown>) => string;
  initCode?: (cfg: Record<string, unknown>) => string;
  loopCode?: (cfg: Record<string, unknown>) => string;
}

export interface VirtusNodeDef {
  type: string;
  category: NodeCategory;
  label: string;
  icon: string;
  color: string;
  inputs: PortDef[];
  outputs: PortDef[];
  configSchema: ConfigField[];
  codegen: NodeCodegenDef;
}

// ── Message Protocol ─────────────────────────────────────────────────

export interface FlashConfig {
  port: string;
  runner: string;
  board: string;
  buildDir?: string;
}

export interface BuildConfig {
  board: string;
  pristine: boolean;
  extraArgs: string;
}

export interface MonitorConfig {
  port: string;
  baud: number;
}

export type WebviewMessage =
  | { type: 'saveFlow'; payload: FlowGraph }
  | { type: 'generateCode'; payload: FlowGraph }
  | { type: 'flashDevice'; payload: FlashConfig }
  | { type: 'runBuild'; payload: BuildConfig }
  | { type: 'openMonitor'; payload: MonitorConfig }
  | { type: 'requestLoad'; payload: null };

export type HostMessage =
  | { type: 'loadFlow'; payload: FlowGraph }
  | { type: 'boardChanged'; payload: { boardId: string; supportedNodeTypes: string[] } }
  | { type: 'buildStatus'; payload: { status: 'ok' | 'error'; message: string } }
  | { type: 'flashStatus'; payload: { status: 'ok' | 'error'; message: string } }
  | { type: 'monitorData'; payload: { line: string } }
  | { type: 'codegenStatus'; payload: { status: 'ok' | 'error'; message: string; files?: string[] } };
