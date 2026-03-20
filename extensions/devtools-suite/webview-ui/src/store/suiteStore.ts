// Copyright 2026 VirtusCo

import { create } from 'zustand';

export interface ExtensionInfo {
  id: string;
  name: string;
  installed: boolean;
  version: string;
  description: string;
  openCommand: string;
}

export interface DependencyCheck {
  name: string;
  command: string;
  found: boolean;
  version: string;
  required_by: string[];
  install_url: string;
  windows_cmd?: string;
}

export interface WorkspaceInfo {
  name: string;
  branch: string;
  path: string;
}

export interface Alert {
  id: string;
  source: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  timestamp: number;
}

export interface SharedConfigData {
  rpi_host: string;
  rpi_username: string;
  rpi_ssh_key_path: string;
  zephyr_base: string;
  workspace_type: string;
}

export type ActivePage = 'dashboard' | 'installer' | 'config' | 'setup';

interface SuiteState {
  activePage: ActivePage;
  extensions: ExtensionInfo[];
  dependencies: DependencyCheck[];
  workspace: WorkspaceInfo | null;
  alerts: Alert[];
  config: SharedConfigData;
  setupStep: number;
  setupStepComplete: boolean[];
  setActivePage: (page: ActivePage) => void;
  setExtensions: (extensions: ExtensionInfo[]) => void;
  setDependencies: (dependencies: DependencyCheck[]) => void;
  setWorkspace: (workspace: WorkspaceInfo | null) => void;
  addAlert: (alert: Alert) => void;
  clearAlerts: () => void;
  setConfig: (config: SharedConfigData) => void;
  setSetupStep: (step: number) => void;
  setSetupStepComplete: (step: number, complete: boolean) => void;
}

const DEFAULT_EXTENSIONS: ExtensionInfo[] = [
  {
    id: 'VirtusCo.porter-devtools',
    name: 'Porter DevTools',
    installed: false,
    version: '',
    description: 'Firmware flashing, RPi deployment, and CI/CD packaging',
    openCommand: 'porterDevtools.openDashboard',
  },
  {
    id: 'VirtusCo.virtus-firmware-builder',
    name: 'Virtus Firmware Builder',
    installed: false,
    version: '',
    description: 'Visual node-based firmware development for ESP32/Zephyr',
    openCommand: 'virtusFirmware.openBuilder',
  },
  {
    id: 'VirtusCo.virtus-ai-studio',
    name: 'Virtus AI Studio',
    installed: false,
    version: '',
    description: 'AI model training, LoRA fine-tuning, and inference testing',
    openCommand: 'virtusAI.openStudio',
  },
  {
    id: 'VirtusCo.virtus-ros2-studio',
    name: 'Virtus ROS 2 Studio',
    installed: false,
    version: '',
    description: 'ROS 2 node graph, topic monitor, and launch management',
    openCommand: 'virtusROS2.openStudio',
  },
  {
    id: 'VirtusCo.virtus-hardware-dashboard',
    name: 'Virtus Hardware Dashboard',
    installed: false,
    version: '',
    description: 'Real-time hardware monitoring and diagnostics',
    openCommand: 'virtusHardware.openDashboard',
  },
  {
    id: 'VirtusCo.virtus-simulation-manager',
    name: 'Virtus Simulation Manager',
    installed: false,
    version: '',
    description: 'Gazebo simulation launch, scenario management, and replay',
    openCommand: 'virtusSimulation.openManager',
  },
  {
    id: 'VirtusCo.virtus-pcb-studio',
    name: 'Virtus PCB Studio',
    installed: false,
    version: '',
    description: 'PCB review, sync checking, BOM extraction, and visual schematic builder',
    openCommand: 'virtusPCB.openPCBStudio',
  },
];

const DEFAULT_CONFIG: SharedConfigData = {
  rpi_host: '',
  rpi_username: 'pi',
  rpi_ssh_key_path: '',
  zephyr_base: '',
  workspace_type: 'porter-ros',
};

export const useSuiteStore = create<SuiteState>((set) => ({
  activePage: 'dashboard',
  extensions: DEFAULT_EXTENSIONS,
  dependencies: [],
  workspace: null,
  alerts: [],
  config: { ...DEFAULT_CONFIG },
  setupStep: 1,
  setupStepComplete: [false, false, false, false, false],

  setActivePage: (page) => set({ activePage: page }),
  setExtensions: (extensions) => set({ extensions }),
  setDependencies: (dependencies) => set({ dependencies }),
  setWorkspace: (workspace) => set({ workspace }),
  addAlert: (alert) =>
    set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 50) })),
  clearAlerts: () => set({ alerts: [] }),
  setConfig: (config) => set({ config }),
  setSetupStep: (step) => set({ setupStep: step }),
  setSetupStepComplete: (step, complete) =>
    set((state) => {
      const arr = [...state.setupStepComplete];
      arr[step - 1] = complete;
      return { setupStepComplete: arr };
    }),
}));
