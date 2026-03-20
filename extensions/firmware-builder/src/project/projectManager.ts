// Copyright 2026 VirtusCo
// Project creation and management for Zephyr projects
//
// Zephyr requires a "west workspace" — a directory initialized with `west init`
// that contains the Zephyr source tree. Application projects live inside or
// reference this workspace. This module handles:
//   1. Detecting existing workspaces
//   2. Initializing new workspaces (west init + west update)
//   3. Creating application projects within workspaces

import * as vscode from 'vscode';
import * as path from 'path';
import { getBoardById } from './boardDatabase';

// ── Templates ────────────────────────────────────────────────────────

const MAIN_C_TEMPLATE = `/*
 * Virtus Firmware — {{PROJECT_NAME}}
 * Board: {{BOARD_NAME}}
 *
 * This file is yours to edit. virtus_generated.c/h are managed by the builder.
 */

#include <zephyr/kernel.h>

/* Uncomment after generating code from the Firmware Builder canvas */
/* #include "virtus_generated.h" */

int main(void) {
    printk("Virtus firmware starting on {{BOARD_NAME}}\\n");

    /* Call virtus_init() after code generation */
    /* virtus_init(); */

    while (1) {
        k_sleep(K_MSEC(1000));
    }
    return 0;
}
`;

const CMAKELISTS_TEMPLATE = `# Virtus Firmware Project — {{PROJECT_NAME}}
cmake_minimum_required(VERSION 3.20.0)
find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})

project({{PROJECT_NAME}})

target_sources(app PRIVATE
    src/main.c
    # Uncomment after generating code:
    # src/virtus_generated.c
)
`;

const PRJ_CONF_TEMPLATE = `# Virtus Firmware Project — {{BOARD_NAME}}
# Additional CONFIG_* flags will be added by the Firmware Builder

CONFIG_LOG=y
CONFIG_PRINTK=y
`;

// ── Workspace Detection ──────────────────────────────────────────────

interface WorkspaceInfo {
  /** Path to the west workspace root (contains .west/) */
  workspaceRoot: string;
  /** Path to ZEPHYR_BASE (zephyr/ inside workspace) */
  zephyrBase: string;
  /** Whether west is available on PATH */
  westAvailable: boolean;
}

async function detectWorkspace(): Promise<WorkspaceInfo | null> {
  // Check ZEPHYR_BASE env var
  const envBase = process.env.ZEPHYR_BASE;
  if (envBase) {
    const wsRoot = path.dirname(envBase);
    return { workspaceRoot: wsRoot, zephyrBase: envBase, westAvailable: true };
  }

  // Check common locations
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const candidates = [
    path.join(home, 'zephyrproject'),
    path.join(home, 'zephyr-workspace'),
    path.join(home, 'west-workspace'),
  ];

  for (const candidate of candidates) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(path.join(candidate, '.west')));
      const zBase = path.join(candidate, 'zephyr');
      return { workspaceRoot: candidate, zephyrBase: zBase, westAvailable: true };
    } catch {
      // Not found, try next
    }
  }

  // Check VS Code setting
  const configBase = vscode.workspace.getConfiguration('virtus').get<string>('zephyrBase', '');
  if (configBase) {
    const wsRoot = path.dirname(configBase);
    return { workspaceRoot: wsRoot, zephyrBase: configBase, westAvailable: true };
  }

  return null;
}

// ── Workspace Initialization ─────────────────────────────────────────

async function initWorkspace(targetDir: string): Promise<boolean> {
  const parentDir = path.dirname(targetDir);
  const terminal = vscode.window.createTerminal({
    name: 'Virtus: Zephyr Setup',
    cwd: parentDir,
  });
  terminal.show();

  // Show progress
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Setting up Zephyr workspace...',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Initializing west workspace (this downloads ~2 GB)...' });

      // Chain all commands so they run sequentially
      // west init creates the directory and clones the manifest repo
      const isWin = process.platform === 'win32';
      const sep = isWin ? ' && ' : ' && ';
      const cdCmd = isWin ? `cd /d "${targetDir}"` : `cd "${targetDir}"`;
      const reqPath = path.join(targetDir, 'zephyr', 'scripts', 'requirements.txt');

      const fullCmd = [
        `west init -m https://github.com/zephyrproject-rtos/zephyr --mr v4.0.0 "${targetDir}"`,
        cdCmd,
        'west update',
        `pip install -r "${reqPath}"`,
        'west zephyr-export',
        'echo "=== Zephyr workspace ready! You can now create a project. ==="',
      ].join(sep);

      terminal.sendText(fullCmd);

      await vscode.window.showInformationMessage(
        'Zephyr workspace setup started in terminal. Wait for it to complete, then create your project.',
        'OK'
      );

      return true;
    }
  );
}

// ── Project Creation ─────────────────────────────────────────────────

export async function createProject(): Promise<void> {
  // 1. Check for existing workspace
  let workspace = await detectWorkspace();

  if (!workspace) {
    const choice = await vscode.window.showWarningMessage(
      'No Zephyr workspace found. West needs a workspace (west init + west update) before you can build firmware.\n\n'
      + 'This downloads ~2 GB of Zephyr source + modules (one-time setup).',
      { modal: true },
      'Initialize Workspace Now',
      'I Have One — Let Me Browse',
      'Cancel'
    );

    if (choice === 'Initialize Workspace Now') {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      const defaultDir = path.join(home, 'zephyrproject');

      const wsUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Workspace Location',
        defaultUri: vscode.Uri.file(path.dirname(defaultDir)),
      });
      if (!wsUri || wsUri.length === 0) return;

      const wsPath = path.join(wsUri[0].fsPath, 'zephyrproject');
      await initWorkspace(wsPath);
      return; // User needs to wait for setup, then retry

    } else if (choice === 'I Have One — Let Me Browse') {
      const wsUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Zephyr Workspace (contains .west/)',
      });
      if (!wsUri || wsUri.length === 0) return;

      // Verify it has .west/
      try {
        await vscode.workspace.fs.stat(
          vscode.Uri.joinPath(wsUri[0], '.west')
        );
      } catch {
        vscode.window.showErrorMessage(
          'Selected folder does not contain .west/ — not a valid west workspace.'
        );
        return;
      }

      const zBase = path.join(wsUri[0].fsPath, 'zephyr');
      workspace = {
        workspaceRoot: wsUri[0].fsPath,
        zephyrBase: zBase,
        westAvailable: true,
      };

      // Save for future use
      const config = vscode.workspace.getConfiguration('virtus');
      await config.update('zephyrBase', zBase, vscode.ConfigurationTarget.Global);
    } else {
      return;
    }
  }

  // 2. Ask for project name
  const projectName = await vscode.window.showInputBox({
    prompt: 'Project name',
    placeHolder: 'my-firmware',
    validateInput: (val) => {
      if (!val) return 'Name is required';
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(val)) return 'Use alphanumeric, hyphens, underscores';
      return null;
    },
  });
  if (!projectName) return;

  // 3. Ask where to create the project
  const locationChoice = await vscode.window.showQuickPick([
    {
      label: 'Inside Zephyr workspace',
      description: workspace.workspaceRoot,
      detail: 'Recommended — west build works automatically',
      location: 'inside',
    },
    {
      label: 'Custom location (standalone)',
      description: 'Choose a folder',
      detail: 'You\'ll need to set ZEPHYR_BASE manually or use -DZEPHYR_BASE',
      location: 'custom',
    },
  ], { placeHolder: 'Where to create the project?' });
  if (!locationChoice) return;

  let parentDir: string;
  if (locationChoice.location === 'inside') {
    parentDir = workspace.workspaceRoot;
  } else {
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Parent Folder',
    });
    if (!folderUri || folderUri.length === 0) return;
    parentDir = folderUri[0].fsPath;
  }

  // 4. Ask for board
  const boardId = await selectBoard();
  if (!boardId) return;

  const board = getBoardById(boardId);
  const boardName = board?.name ?? boardId;
  const westBoard = board?.westBoard ?? boardId;

  // 5. Create project directory structure
  const projectRoot = vscode.Uri.file(path.join(parentDir, projectName));

  try {
    await vscode.workspace.fs.createDirectory(projectRoot);
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(projectRoot, 'src'));
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(projectRoot, 'boards'));

    // Write template files
    const mainC = MAIN_C_TEMPLATE
      .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
      .replace(/\{\{BOARD_NAME\}\}/g, boardName);

    const cmake = CMAKELISTS_TEMPLATE
      .replace(/\{\{PROJECT_NAME\}\}/g, projectName);

    const prjConf = PRJ_CONF_TEMPLATE
      .replace(/\{\{BOARD_NAME\}\}/g, boardName);

    await writeFile(projectRoot, 'src/main.c', mainC);
    await writeFile(projectRoot, 'CMakeLists.txt', cmake);
    await writeFile(projectRoot, 'prj.conf', prjConf);

    // Save settings
    const config = vscode.workspace.getConfiguration('virtus');
    await config.update('selectedBoard', boardId, vscode.ConfigurationTarget.Global);
    if (!process.env.ZEPHYR_BASE) {
      await config.update('zephyrBase', workspace.zephyrBase, vscode.ConfigurationTarget.Global);
    }

    // 6. Open the new project
    const openChoice = await vscode.window.showInformationMessage(
      `Project "${projectName}" created for ${boardName}.\n`
      + `Build with: west build -b ${westBoard}`,
      'Open in Current Window',
      'Open in New Window'
    );

    if (openChoice === 'Open in Current Window') {
      await vscode.commands.executeCommand('vscode.openFolder', projectRoot, false);
    } else if (openChoice === 'Open in New Window') {
      await vscode.commands.executeCommand('vscode.openFolder', projectRoot, true);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to create project: ${msg}`);
  }
}

// ── Open Project ─────────────────────────────────────────────────────

export async function openProject(): Promise<void> {
  const folderUri = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Open Zephyr Project',
  });
  if (!folderUri || folderUri.length === 0) return;

  // Check if it looks like a Zephyr project
  try {
    await vscode.workspace.fs.stat(
      vscode.Uri.joinPath(folderUri[0], 'CMakeLists.txt')
    );
  } catch {
    const proceed = await vscode.window.showWarningMessage(
      'No CMakeLists.txt found. This may not be a Zephyr project. Open anyway?',
      'Open', 'Cancel'
    );
    if (proceed !== 'Open') return;
  }

  await vscode.commands.executeCommand('vscode.openFolder', folderUri[0], false);
}

// ── Board Selection ──────────────────────────────────────────────────

export async function selectBoard(): Promise<string | undefined> {
  const { boardList } = await import('./boardDatabase');

  const items = boardList.map(b => ({
    label: b.name,
    description: `${b.vendor} · ${b.arch}`,
    detail: `${b.cpu} | ${b.flash} Flash | ${b.ram} | west -b ${b.westBoard}`,
    boardId: b.id,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select target board',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (selected) {
    const config = vscode.workspace.getConfiguration('virtus');
    await config.update('selectedBoard', selected.boardId, vscode.ConfigurationTarget.Global);
    return selected.boardId;
  }
  return undefined;
}

// ── Helpers ──────────────────────────────────────────────────────────

async function writeFile(root: vscode.Uri, relativePath: string, content: string): Promise<void> {
  const uri = vscode.Uri.joinPath(root, relativePath);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
}
