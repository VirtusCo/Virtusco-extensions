// Copyright 2026 VirtusCo
// Zustand store for simulation manager webview state

import { create } from 'zustand';

export interface LaunchProfile {
  id: string;
  label: string;
  description: string;
  color: string;
  steps: { name: string; cmd: string; delay_ms?: number }[];
}

export interface ProcessInfo {
  id: string;
  name: string;
  pid: number;
  status: 'running' | 'stopped' | 'error';
  startTime: number;
}

export interface BagFile {
  name: string;
  path: string;
  size_mb: number;
  duration_s: number;
  topics_count: number;
  annotations: string[];
}

export interface Nav2ParamGroup {
  group: string;
  label: string;
  params: Nav2Param[];
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

export interface URDFLink {
  name: string;
  visual: string;
  collision: string;
}

export interface URDFJoint {
  name: string;
  type: string;
  parent: string;
  child: string;
  origin: { xyz: string; rpy: string };
  axis: string;
  limits: { lower?: number; upper?: number; effort?: number; velocity?: number };
}

export interface Scenario {
  name: string;
  description: string;
  robot_start: { x: number; y: number; yaw: number };
  robot_goal: { x: number; y: number; yaw: number };
  obstacles: { id: string; type: string; position: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } }[];
  passengers: { id: string; name: string; position: { x: number; y: number }; behavior: string }[];
  events: { time_s: number; type: string; description: string }[];
  success_criteria: { reach_goal: boolean; no_collision: boolean; max_time_s: number };
}

export interface ScenarioResult {
  scenario_name: string;
  success: boolean;
  elapsed_s: number;
  collisions: number;
  reached_goal: boolean;
  errors: string[];
}

export interface WorldFile {
  name: string;
  path: string;
  active: boolean;
}

export type Page = 'launch' | 'urdf' | 'nav2' | 'bags' | 'scenarios' | 'worlds';

interface SimState {
  activePage: Page;
  profiles: LaunchProfile[];
  activeProfileId: string | null;
  processes: ProcessInfo[];
  bagFiles: BagFile[];
  recording: boolean;
  recordingElapsed: number;
  nav2Params: Record<string, unknown>;
  nav2Schema: Nav2ParamGroup[];
  urdfLinks: URDFLink[];
  urdfJoints: URDFJoint[];
  urdfWarnings: string[];
  scenarios: Scenario[];
  scenarioResult: ScenarioResult | null;
  worlds: WorldFile[];
  notification: { type: 'error' | 'info'; message: string } | null;

  setActivePage: (page: Page) => void;
  setProfiles: (profiles: LaunchProfile[], activeId: string | null) => void;
  setProcesses: (processes: ProcessInfo[]) => void;
  setBagFiles: (bags: BagFile[]) => void;
  setRecording: (recording: boolean, elapsed: number) => void;
  setNav2Params: (params: Record<string, unknown>, schema: Nav2ParamGroup[]) => void;
  setURDFData: (links: URDFLink[], joints: URDFJoint[], warnings: string[]) => void;
  setScenarios: (scenarios: Scenario[]) => void;
  setScenarioResult: (result: ScenarioResult) => void;
  setWorlds: (worlds: WorldFile[]) => void;
  setNotification: (notification: { type: 'error' | 'info'; message: string } | null) => void;
}

export const useSimStore = create<SimState>((set) => ({
  activePage: 'launch',
  profiles: [],
  activeProfileId: null,
  processes: [],
  bagFiles: [],
  recording: false,
  recordingElapsed: 0,
  nav2Params: {},
  nav2Schema: [],
  urdfLinks: [],
  urdfJoints: [],
  urdfWarnings: [],
  scenarios: [],
  scenarioResult: null,
  worlds: [],
  notification: null,

  setActivePage: (page) => set({ activePage: page }),
  setProfiles: (profiles, activeId) => set({ profiles, activeProfileId: activeId }),
  setProcesses: (processes) => set({ processes }),
  setBagFiles: (bags) => set({ bagFiles: bags }),
  setRecording: (recording, elapsed) => set({ recording, recordingElapsed: elapsed }),
  setNav2Params: (params, schema) => set({ nav2Params: params, nav2Schema: schema }),
  setURDFData: (links, joints, warnings) => set({ urdfLinks: links, urdfJoints: joints, urdfWarnings: warnings }),
  setScenarios: (scenarios) => set({ scenarios }),
  setScenarioResult: (result) => set({ scenarioResult: result }),
  setWorlds: (worlds) => set({ worlds }),
  setNotification: (notification) => set({ notification }),
}));
