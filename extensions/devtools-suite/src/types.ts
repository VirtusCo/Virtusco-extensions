// Copyright 2026 VirtusCo

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

export interface SuiteStatus {
  extensions: ExtensionInfo[];
  dependencies: DependencyCheck[];
  workspace: WorkspaceInfo | null;
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

// Messages from webview to extension host
export type WebviewMessage =
  | { type: 'requestStatus' }
  | { type: 'requestDependencies' }
  | { type: 'installExtension'; id: string }
  | { type: 'installAll' }
  | { type: 'openExtension'; openCommand: string }
  | { type: 'checkDependencies' }
  | { type: 'saveConfig'; config: SharedConfigData }
  | { type: 'loadConfig' }
  | { type: 'browseFile'; field: string }
  | { type: 'bootstrapWorkspace'; targetDir?: string }
  | { type: 'selectExistingWorkspace' }
  | { type: 'startSetupStep'; step: number }
  | { type: 'openExternalUrl'; url: string };

// Messages from extension host to webview
export type HostMessage =
  | { type: 'suiteStatus'; status: SuiteStatus }
  | { type: 'dependencies'; dependencies: DependencyCheck[] }
  | { type: 'config'; config: SharedConfigData }
  | { type: 'configSaved' }
  | { type: 'browsedFile'; field: string; path: string }
  | { type: 'alert'; alert: Alert }
  | { type: 'setupProgress'; step: number; complete: boolean }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string };
