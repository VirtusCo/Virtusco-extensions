// Copyright 2026 VirtusCo
// West build/flash/monitor terminal integration
//
// Key insight: `west build` only works when:
//   1. You're inside a west workspace (has .west/ directory), OR
//   2. ZEPHYR_BASE is set and west can find the workspace
//
// This module ensures ZEPHYR_BASE is set from extension settings
// and runs commands from the correct working directory.

import * as vscode from 'vscode';
import * as path from 'path';
import { BuildConfig, FlashConfig, MonitorConfig } from '../types';

const terminals = new Map<string, vscode.Terminal>();

function getZephyrEnv(): Record<string, string> {
  const config = vscode.workspace.getConfiguration('virtus');
  const zephyrBase = config.get<string>('zephyrBase', '');
  const env: Record<string, string> = {};

  if (zephyrBase) {
    env['ZEPHYR_BASE'] = zephyrBase;
  }

  return env;
}

function getOrCreateTerminal(name: string): vscode.Terminal {
  const existing = terminals.get(name);
  if (existing) {
    const idx = vscode.window.terminals.indexOf(existing);
    if (idx >= 0) return existing;
    terminals.delete(name);
  }

  const env = getZephyrEnv();
  const term = vscode.window.createTerminal({
    name,
    env: Object.keys(env).length > 0 ? env : undefined,
  });
  terminals.set(name, term);

  const disposable = vscode.window.onDidCloseTerminal((t) => {
    if (t === term) {
      terminals.delete(name);
      disposable.dispose();
    }
  });

  return term;
}

function getWorkspaceDir(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function runWestBuild(cfg: BuildConfig): Promise<void> {
  const cwd = getWorkspaceDir();
  if (!cwd) {
    vscode.window.showErrorMessage('No workspace folder open. Open a Zephyr project first.');
    return;
  }

  // Verify west workspace is reachable
  const zephyrBase = vscode.workspace.getConfiguration('virtus').get<string>('zephyrBase', '');
  if (!zephyrBase && !process.env.ZEPHYR_BASE) {
    const choice = await vscode.window.showErrorMessage(
      'ZEPHYR_BASE is not set. West cannot find the Zephyr source tree.\n\n'
      + 'Set it in Settings → Virtus: Zephyr Base, or run "Virtus: Create New Project" to set up a workspace.',
      'Open Settings',
      'Cancel'
    );
    if (choice === 'Open Settings') {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'virtus.zephyrBase');
    }
    return;
  }

  const parts = ['west build'];
  parts.push(`-b ${cfg.board}`);
  if (cfg.pristine) parts.push('--pristine always');
  if (cfg.extraArgs) parts.push(cfg.extraArgs);
  const cmd = parts.join(' ');

  const term = getOrCreateTerminal('Virtus: Build');
  term.show();

  // Set ZEPHYR_BASE inline if configured
  if (zephyrBase) {
    const isWin = process.platform === 'win32';
    if (isWin) {
      term.sendText(`set "ZEPHYR_BASE=${zephyrBase}" && cd /d "${cwd}" && ${cmd}`);
    } else {
      term.sendText(`export ZEPHYR_BASE="${zephyrBase}" && cd "${cwd}" && ${cmd}`);
    }
  } else {
    term.sendText(`cd "${cwd}" && ${cmd}`);
  }
}

export async function runWestFlash(cfg: FlashConfig): Promise<void> {
  const cwd = getWorkspaceDir();
  if (!cwd) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const parts = ['west flash'];
  parts.push(`--runner ${cfg.runner}`);
  if (cfg.port) parts.push(`--esp-device ${cfg.port}`);
  if (cfg.buildDir) parts.push(`--build-dir ${cfg.buildDir}`);
  const cmd = parts.join(' ');

  const term = getOrCreateTerminal('Virtus: Flash');
  term.show();
  term.sendText(`cd "${cwd}" && ${cmd}`);
}

export function openSerialMonitor(cfg: MonitorConfig): void {
  const cmd = `python -m serial.tools.miniterm ${cfg.port} ${cfg.baud}`;
  const term = getOrCreateTerminal('Virtus: Serial Monitor');
  term.show();
  term.sendText(cmd);
}

export async function runWestClean(): Promise<void> {
  const cwd = getWorkspaceDir();
  if (!cwd) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    'This will delete the build directory and rebuild from scratch.',
    'Clean Build', 'Cancel'
  );
  if (confirm !== 'Clean Build') return;

  const term = getOrCreateTerminal('Virtus: Build');
  term.show();

  const isWin = process.platform === 'win32';
  const rmCmd = isWin ? `rmdir /s /q "${path.join(cwd, 'build')}"` : `rm -rf "${path.join(cwd, 'build')}"`;
  term.sendText(rmCmd);
}

export async function runMenuconfig(): Promise<void> {
  const cwd = getWorkspaceDir();
  if (!cwd) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const zephyrBase = vscode.workspace.getConfiguration('virtus').get<string>('zephyrBase', '');
  const term = getOrCreateTerminal('Virtus: Menuconfig');
  term.show();

  if (zephyrBase) {
    const isWin = process.platform === 'win32';
    if (isWin) {
      term.sendText(`set "ZEPHYR_BASE=${zephyrBase}" && cd /d "${cwd}" && west build -t menuconfig`);
    } else {
      term.sendText(`export ZEPHYR_BASE="${zephyrBase}" && cd "${cwd}" && west build -t menuconfig`);
    }
  } else {
    term.sendText(`cd "${cwd}" && west build -t menuconfig`);
  }
}
