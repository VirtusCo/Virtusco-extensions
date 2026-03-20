// Copyright 2026 VirtusCo

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SharedConfigData } from '../types';

const CONFIG_FILENAME = 'virtusco.json';

const DEFAULT_CONFIG: SharedConfigData = {
  rpi_host: '',
  rpi_username: 'pi',
  rpi_ssh_key_path: '',
  zephyr_base: '',
  workspace_type: 'porter-ros',
};

function getConfigPath(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }
  return path.join(workspaceFolders[0].uri.fsPath, CONFIG_FILENAME);
}

export function load(): SharedConfigData {
  const configPath = getConfigPath();
  if (!configPath) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (err) {
    console.error('Failed to load virtusco.json:', err);
  }

  return { ...DEFAULT_CONFIG };
}

export function save(config: SharedConfigData): void {
  const configPath = getConfigPath();
  if (!configPath) {
    vscode.window.showWarningMessage('No workspace open. Cannot save configuration.');
    return;
  }

  try {
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(configPath, content, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to save config: ${message}`);
  }
}

export function get<K extends keyof SharedConfigData>(key: K): SharedConfigData[K] {
  const config = load();
  return config[key];
}

export function set<K extends keyof SharedConfigData>(key: K, value: SharedConfigData[K]): void {
  const config = load();
  config[key] = value;
  save(config);
}
