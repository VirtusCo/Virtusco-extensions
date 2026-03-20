// Copyright 2026 VirtusCo

import * as vscode from 'vscode';
import { ExtensionInfo } from '../types';

interface ExtensionDef {
  id: string;
  name: string;
  description: string;
  openCommand: string;
}

const SUITE_EXTENSIONS: ExtensionDef[] = [
  {
    id: 'VirtusCo.porter-devtools',
    name: 'Porter DevTools',
    description: 'Firmware flashing, RPi deployment, and CI/CD packaging',
    openCommand: 'porterRobot.refreshDevices',
  },
  {
    id: 'VirtusCo.virtus-firmware-builder',
    name: 'Virtus Firmware Builder',
    description: 'Visual node-based firmware development for ESP32/Zephyr',
    openCommand: 'virtus.openBuilder',
  },
  {
    id: 'VirtusCo.virtus-ai-studio',
    name: 'Virtus AI Studio',
    description: 'AI model training, LoRA fine-tuning, and inference testing',
    openCommand: 'virtus-ai.openStudio',
  },
  {
    id: 'VirtusCo.virtus-ros2-studio',
    name: 'Virtus ROS 2 Studio',
    description: 'ROS 2 node graph, topic monitor, and launch management',
    openCommand: 'virtus-ros2.openStudio',
  },
  {
    id: 'VirtusCo.virtus-hardware-dashboard',
    name: 'Virtus Hardware Dashboard',
    description: 'Real-time hardware monitoring and diagnostics',
    openCommand: 'virtus-hw.openDashboard',
  },
  {
    id: 'VirtusCo.virtus-simulation-manager',
    name: 'Virtus Simulation Manager',
    description: 'Gazebo simulation launch, scenario management, and replay',
    openCommand: 'virtusSim.openSimManager',
  },
  {
    id: 'VirtusCo.virtus-pcb-studio',
    name: 'Virtus PCB Studio',
    description: 'PCB review, sync checking, BOM extraction, and visual schematic builder',
    openCommand: 'virtusPCB.openPCBStudio',
  },
];

export function getExtensionDefs(): ExtensionDef[] {
  return SUITE_EXTENSIONS;
}

export function checkAll(): ExtensionInfo[] {
  return SUITE_EXTENSIONS.map((ext) => {
    const installed = vscode.extensions.getExtension(ext.id);
    return {
      id: ext.id,
      name: ext.name,
      installed: !!installed,
      version: installed?.packageJSON?.version || '',
      description: ext.description,
      openCommand: ext.openCommand,
    };
  });
}

export async function install(id: string): Promise<void> {
  try {
    await vscode.commands.executeCommand(
      'workbench.extensions.installExtension',
      id
    );
    vscode.window.showInformationMessage(`Installed extension: ${id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to install ${id}: ${message}`);
  }
}

export async function installAll(): Promise<void> {
  const statuses = checkAll();
  const missing = statuses.filter((s) => !s.installed);

  if (missing.length === 0) {
    vscode.window.showInformationMessage('All VirtusCo extensions are already installed.');
    return;
  }

  vscode.window.showInformationMessage(
    `Installing ${missing.length} missing extension(s)...`
  );

  for (const ext of missing) {
    await install(ext.id);
  }
}

export async function openExtension(openCommand: string): Promise<void> {
  try {
    await vscode.commands.executeCommand(openCommand);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to open extension: ${message}`);
  }
}
