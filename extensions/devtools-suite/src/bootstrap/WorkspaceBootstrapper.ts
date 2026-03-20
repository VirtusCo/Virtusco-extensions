// Copyright 2026 VirtusCo

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { WorkspaceInfo } from '../types';

const REPO_URL = 'https://github.com/austin207/Porter-ROS.git';
const EXTENSION_DIRS = [
  'porter-vscode-extension',
  'virtus-firmware-builder',
  'virtus-ai-studio',
  'virtus-ros2-studio',
  'virtus-hardware-dashboard',
  'virtus-simulation-manager',
  'virtus-pcb-studio',
  'virtusco-devtools-suite',
];

export async function bootstrapWorkspace(targetDir?: string): Promise<void> {
  let dir = targetDir;

  if (!dir) {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: 'Select folder to clone Porter-ROS into',
    });

    if (!uris || uris.length === 0) {
      return;
    }
    dir = uris[0].fsPath;
  }

  const terminal = vscode.window.createTerminal({
    name: 'VirtusCo Bootstrap',
    cwd: dir,
  });
  terminal.show();

  // Clone the repository
  terminal.sendText(`git clone ${REPO_URL}`);
  terminal.sendText('cd Porter-ROS');

  // Install npm dependencies for each extension directory
  for (const extDir of EXTENSION_DIRS) {
    terminal.sendText(`echo "--- Installing dependencies for ${extDir} ---"`);
    terminal.sendText(`cd ${extDir} && npm install && cd ..`);
  }

  // Create default virtusco.json
  const defaultConfig = {
    rpi_host: '',
    rpi_username: 'pi',
    rpi_ssh_key_path: '',
    zephyr_base: '',
    workspace_type: 'porter-ros',
  };

  terminal.sendText(
    `echo '${JSON.stringify(defaultConfig, null, 2)}' > virtusco.json`
  );

  terminal.sendText('echo "--- Bootstrap complete ---"');

  vscode.window.showInformationMessage(
    'Bootstrap started. Follow the terminal output for progress.'
  );
}

export function detectWorkspace(): WorkspaceInfo | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;

  // Check if this is a Porter-ROS repo by looking for key markers
  const markers = ['porter_robot', 'CLAUDE.md'];
  const isPorterROS = markers.some((m) =>
    fs.existsSync(path.join(rootPath, m))
  );

  if (!isPorterROS) {
    return null;
  }

  // Get current branch
  let branch = 'unknown';
  try {
    const { execSync } = require('child_process');
    branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: rootPath,
      encoding: 'utf-8',
    }).trim();
  } catch {
    // Not a git repo or git not available
  }

  return {
    name: path.basename(rootPath),
    branch,
    path: rootPath,
  };
}

function runCommand(command: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, timeout: 30000 }, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export async function selectExistingWorkspace(): Promise<void> {
  const uris = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    title: 'Select existing Porter-ROS workspace',
  });

  if (!uris || uris.length === 0) {
    return;
  }

  const selectedPath = uris[0].fsPath;
  const porterRobotDir = path.join(selectedPath, 'porter_robot');

  if (!fs.existsSync(porterRobotDir)) {
    vscode.window.showWarningMessage(
      'Selected folder does not appear to be a Porter-ROS workspace (missing porter_robot/).'
    );
    return;
  }

  await vscode.commands.executeCommand('vscode.openFolder', uris[0]);
}
