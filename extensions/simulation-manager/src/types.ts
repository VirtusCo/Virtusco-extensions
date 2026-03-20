// Copyright 2026 VirtusCo
// Shared type definitions for Virtus Simulation Manager

export interface LaunchStep {
  name: string;
  cmd: string;
  delay_ms?: number;
}

export interface LaunchProfile {
  id: string;
  label: string;
  description: string;
  color: string;
  steps: LaunchStep[];
}

export interface ProcessInfo {
  id: string;
  name: string;
  pid: number;
  status: 'running' | 'stopped' | 'error';
  startTime: number;
}

export interface URDFLink {
  name: string;
  visual: string;
  collision: string;
}

export interface URDFJoint {
  name: string;
  type: 'fixed' | 'revolute' | 'continuous' | 'prismatic' | 'floating' | 'planar';
  parent: string;
  child: string;
  origin: { xyz: string; rpy: string };
  axis: string;
  limits: { lower?: number; upper?: number; effort?: number; velocity?: number };
}

export interface Nav2Param {
  key: string;
  label: string;
  type: 'float' | 'int' | 'bool' | 'string';
  default: number | string | boolean;
  min?: number;
  max?: number;
  description: string;
}

export interface Nav2ParamGroup {
  group: string;
  label: string;
  params: Nav2Param[];
}

export interface BagFile {
  name: string;
  path: string;
  size_mb: number;
  duration_s: number;
  topics_count: number;
  annotations: string[];
}

export interface Scenario {
  name: string;
  description: string;
  robot_start: { x: number; y: number; yaw: number };
  robot_goal: { x: number; y: number; yaw: number };
  obstacles: ScenarioObstacle[];
  passengers: ScenarioPassenger[];
  events: ScenarioEvent[];
  success_criteria: SuccessCriteria;
}

export interface ScenarioObstacle {
  id: string;
  type: 'box' | 'cylinder' | 'sphere';
  position: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
}

export interface ScenarioPassenger {
  id: string;
  name: string;
  position: { x: number; y: number };
  behavior: 'static' | 'walking' | 'waiting';
}

export interface ScenarioEvent {
  time_s: number;
  type: string;
  description: string;
}

export interface SuccessCriteria {
  reach_goal: boolean;
  no_collision: boolean;
  max_time_s: number;
}

export interface ScenarioResult {
  scenario_name: string;
  success: boolean;
  elapsed_s: number;
  collisions: number;
  reached_goal: boolean;
  errors: string[];
}

export interface BagPreset {
  id: string;
  label: string;
  topics: string[];
}

export interface WorldFile {
  name: string;
  path: string;
  active: boolean;
}

// ── Message Protocol ─────────────────────────────────────────────

export type WebviewMessage =
  | { type: 'launchProfile'; profileId: string }
  | { type: 'stopAll' }
  | { type: 'stopProcess'; processId: string }
  | { type: 'recordBag'; preset: string; name: string }
  | { type: 'stopRecording' }
  | { type: 'playBag'; path: string; rate: number }
  | { type: 'stopPlayback' }
  | { type: 'deleteBag'; path: string }
  | { type: 'loadNav2Params'; path: string }
  | { type: 'saveNav2Params'; path: string; params: Record<string, unknown> }
  | { type: 'resetNav2Defaults' }
  | { type: 'browseFile'; purpose: string }
  | { type: 'parseURDF'; path: string }
  | { type: 'loadScenarios' }
  | { type: 'runScenario'; scenario: Scenario }
  | { type: 'saveScenario'; scenario: Scenario }
  | { type: 'scanWorlds' }
  | { type: 'switchWorld'; worldPath: string }
  | { type: 'requestStatus' };

export type HostMessage =
  | { type: 'processStatus'; processes: ProcessInfo[] }
  | { type: 'profilesData'; profiles: LaunchProfile[]; activeProfileId: string | null }
  | { type: 'bagList'; bags: BagFile[] }
  | { type: 'recordingStatus'; recording: boolean; elapsed_s: number }
  | { type: 'nav2Params'; params: Record<string, unknown>; schema: Nav2ParamGroup[] }
  | { type: 'urdfData'; links: URDFLink[]; joints: URDFJoint[]; warnings: string[] }
  | { type: 'scenarioList'; scenarios: Scenario[] }
  | { type: 'scenarioResult'; result: ScenarioResult }
  | { type: 'worldList'; worlds: WorldFile[] }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string };
