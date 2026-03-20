// Copyright 2026 VirtusCo
// Virtus Firmware Builder — Extension entry point

import * as vscode from 'vscode';
import { FirmwareBuilderPanel } from './panel/FirmwareBuilderPanel';
import { generateAll } from './codegen/index';
import { runWestBuild, runWestFlash, openSerialMonitor, runWestClean, runMenuconfig } from './flash/westRunner';
import { BoardTreeProvider } from './providers/boardTreeProvider';
import { ActionsTreeProvider } from './providers/actionsTreeProvider';
import { ProjectWebviewProvider } from './providers/projectWebviewProvider';
import { createProject, openProject, selectBoard } from './project/projectManager';
import { scanZephyrAPIs, generateDynamicNodes } from './project/zephyrScanner';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Virtus Firmware Builder');
  outputChannel.appendLine('Virtus Firmware Builder activated');

  // ── Sidebar Providers ────────────────────────────────────────────

  const projectProvider = new ProjectWebviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ProjectWebviewProvider.viewType,
      projectProvider
    )
  );

  const boardProvider = new BoardTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('virtus.boardView', boardProvider)
  );

  const actionsProvider = new ActionsTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('virtus.actionsView', actionsProvider)
  );

  // ── Commands ─────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus.openBuilder', async () => {
      const panel = FirmwareBuilderPanel.createOrShow(context, outputChannel);

      // Auto-scan Zephyr APIs if ZEPHYR_BASE is available
      const zephyrBase = getZephyrBase();
      if (zephyrBase) {
        try {
          const api = await scanZephyrAPIs(zephyrBase);
          const dynamicNodes = generateDynamicNodes(api);
          panel.sendDynamicNodes(dynamicNodes, api.zephyrVersion);
          outputChannel.appendLine(
            `[scan] Zephyr ${api.zephyrVersion}: ${api.subsystems.length} subsystems, ${api.totalFunctions} functions → ${dynamicNodes.length} nodes`
          );
        } catch (err) {
          outputChannel.appendLine(`[scan] Error scanning Zephyr APIs: ${err}`);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus.createProject', () => createProject())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus.openProject', () => openProject())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus.selectBoard', async () => {
      const boardId = await selectBoard();
      if (boardId) {
        boardProvider.refresh();
        actionsProvider.refresh();
        // Notify the canvas webview about board change
        FirmwareBuilderPanel.currentPanel?.notifyBoardChanged(boardId);
        vscode.window.showInformationMessage(`Board set to: ${boardId}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus.refreshBoard', () => {
      boardProvider.refresh();
      actionsProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus.generateCode', async () => {
      const panel = FirmwareBuilderPanel.currentPanel;
      if (panel) {
        panel.requestGenerate();
      } else {
        vscode.window.showWarningMessage(
          'Open the Firmware Builder canvas first (Virtus: Open Canvas)'
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus.buildFirmware', async () => {
      const board = vscode.workspace.getConfiguration('virtus').get('selectedBoard', 'esp32_devkitc_wroom');
      await runWestBuild({
        board: String(board),
        pristine: false,
        extraArgs: '',
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus.flashFirmware', async () => {
      const port = vscode.workspace.getConfiguration('virtus').get('flashPort', '/dev/ttyUSB0');
      await runWestFlash({
        port: String(port),
        runner: 'esptool',
        board: 'esp32',
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus.openSerialMonitor', () => {
      const port = vscode.workspace.getConfiguration('virtus').get('flashPort', '/dev/ttyUSB0');
      const baud = vscode.workspace.getConfiguration('virtus').get('monitorBaud', 115200);
      openSerialMonitor({ port: String(port), baud: Number(baud) });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus.runMenuconfig', () => runMenuconfig())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus.cleanBuild', () => runWestClean())
  );

  context.subscriptions.push(outputChannel);
}

function getZephyrBase(): string | undefined {
  const fromConfig = vscode.workspace.getConfiguration('virtus').get<string>('zephyrBase', '');
  if (fromConfig) return fromConfig;
  if (process.env.ZEPHYR_BASE) return process.env.ZEPHYR_BASE;
  return undefined;
}

export function deactivate(): void {
  FirmwareBuilderPanel.currentPanel?.dispose();
}

export { generateAll };
