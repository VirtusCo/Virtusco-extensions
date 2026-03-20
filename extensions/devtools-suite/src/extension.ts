// Copyright 2026 VirtusCo

import * as vscode from 'vscode';
import {
  checkAll as checkExtensions,
  installAll,
  install,
  openExtension,
} from './installer/ExtensionInstaller';
import {
  checkAll as checkDependencies,
} from './installer/DependencyChecker';
import {
  load as loadConfig,
  save as saveConfig,
} from './config/SharedConfig';
import {
  bootstrapWorkspace,
  detectWorkspace,
  selectExistingWorkspace,
} from './bootstrap/WorkspaceBootstrapper';
import * as EventBus from './bus/EventBus';
import { OverviewProvider } from './providers/OverviewProvider';
import { ExtensionsTreeProvider } from './providers/ExtensionsTreeProvider';
import { SuiteDashboardPanel } from './panel/SuiteDashboardPanel';
import { WebviewMessage, SuiteStatus } from './types';

let overviewProvider: OverviewProvider;
let extensionsTreeProvider: ExtensionsTreeProvider;

async function buildSuiteStatus(): Promise<SuiteStatus> {
  const extensions = checkExtensions();
  const dependencies = await checkDependencies();
  const workspace = detectWorkspace();

  return { extensions, dependencies, workspace };
}

function setupPanelHandlers(
  panel: SuiteDashboardPanel,
  context: vscode.ExtensionContext
): void {
  panel.onMessage(async (message: WebviewMessage) => {
    switch (message.type) {
      case 'requestStatus': {
        const status = await buildSuiteStatus();
        panel.sendSuiteStatus(status);
        break;
      }

      case 'requestDependencies': {
        const deps = await checkDependencies();
        panel.sendDependencies(deps);
        break;
      }

      case 'installExtension': {
        await install(message.id);
        const status = await buildSuiteStatus();
        panel.sendSuiteStatus(status);
        overviewProvider.refresh();
        extensionsTreeProvider.refresh();
        break;
      }

      case 'installAll': {
        await installAll();
        const status = await buildSuiteStatus();
        panel.sendSuiteStatus(status);
        overviewProvider.refresh();
        extensionsTreeProvider.refresh();
        break;
      }

      case 'openExtension': {
        await openExtension(message.openCommand);
        break;
      }

      case 'checkDependencies': {
        const deps = await checkDependencies();
        panel.sendDependencies(deps);
        break;
      }

      case 'saveConfig': {
        saveConfig(message.config);
        panel.postMessage({ type: 'configSaved' });
        vscode.window.showInformationMessage('VirtusCo configuration saved.');
        break;
      }

      case 'loadConfig': {
        const config = loadConfig();
        panel.postMessage({ type: 'config', config });
        break;
      }

      case 'browseFile': {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          title: `Select ${message.field}`,
        });
        if (uris && uris.length > 0) {
          panel.postMessage({
            type: 'browsedFile',
            field: message.field,
            path: uris[0].fsPath,
          });
        }
        break;
      }

      case 'bootstrapWorkspace': {
        await bootstrapWorkspace(message.targetDir);
        break;
      }

      case 'selectExistingWorkspace': {
        await selectExistingWorkspace();
        break;
      }

      case 'startSetupStep': {
        // Handle setup wizard step actions
        switch (message.step) {
          case 2: {
            const deps = await checkDependencies();
            panel.sendDependencies(deps);
            panel.postMessage({ type: 'setupProgress', step: 2, complete: true });
            break;
          }
          case 3: {
            await installAll();
            const status = await buildSuiteStatus();
            panel.sendSuiteStatus(status);
            panel.postMessage({ type: 'setupProgress', step: 3, complete: true });
            break;
          }
          case 4: {
            const config = loadConfig();
            panel.postMessage({ type: 'config', config });
            panel.postMessage({ type: 'setupProgress', step: 4, complete: true });
            break;
          }
          default:
            panel.postMessage({
              type: 'setupProgress',
              step: message.step,
              complete: true,
            });
        }
        break;
      }

      case 'openExternalUrl': {
        vscode.env.openExternal(vscode.Uri.parse(message.url));
        break;
      }
    }
  });
}

export function activate(context: vscode.ExtensionContext): void {
  // Register sidebar overview provider
  overviewProvider = new OverviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      OverviewProvider.viewType,
      overviewProvider
    )
  );

  // Register extensions tree provider
  extensionsTreeProvider = new ExtensionsTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      'virtusco-suite.extensions',
      extensionsTreeProvider
    )
  );
  extensionsTreeProvider.registerCommands(context);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('virtuscoSuite.openSuite', async () => {
      const panel = SuiteDashboardPanel.createOrShow(context.extensionUri);
      setupPanelHandlers(panel, context);

      // Send initial status
      const status = await buildSuiteStatus();
      panel.sendSuiteStatus(status);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtuscoSuite.installAll', async () => {
      await installAll();
      overviewProvider.refresh();
      extensionsTreeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtuscoSuite.checkDependencies', async () => {
      const deps = await checkDependencies();
      const found = deps.filter((d) => d.found).length;
      const total = deps.length;
      vscode.window.showInformationMessage(
        `Dependencies: ${found}/${total} found. Open Suite Dashboard for details.`
      );

      if (SuiteDashboardPanel.currentPanel) {
        SuiteDashboardPanel.currentPanel.sendDependencies(deps);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtuscoSuite.bootstrapWorkspace', async () => {
      await bootstrapWorkspace();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtuscoSuite.openExtension', async () => {
      const extensions = checkExtensions();
      const installed = extensions.filter((e) => e.installed);

      if (installed.length === 0) {
        vscode.window.showWarningMessage('No VirtusCo extensions installed.');
        return;
      }

      const pick = await vscode.window.showQuickPick(
        installed.map((e) => ({
          label: e.name,
          description: `v${e.version}`,
          detail: e.description,
          openCommand: e.openCommand,
        })),
        { placeHolder: 'Select extension to open' }
      );

      if (pick) {
        await openExtension(pick.openCommand);
      }
    })
  );

  // Set up event bus listeners
  EventBus.on('alert', (data) => {
    if (SuiteDashboardPanel.currentPanel) {
      SuiteDashboardPanel.currentPanel.postMessage({
        type: 'alert',
        alert: {
          id: Date.now().toString(),
          source: 'EventBus',
          message: String(data),
          level: 'info',
          timestamp: Date.now(),
        },
      });
    }
  }, context);

  // Log activation
  const workspace = detectWorkspace();
  const extensions = checkExtensions();
  const installedCount = extensions.filter((e) => e.installed).length;

  console.log(
    `VirtusCo DevTools Suite activated: ${installedCount}/7 extensions, ` +
    `workspace: ${workspace ? workspace.name : 'none'}`
  );
}

export function deactivate(): void {
  EventBus.dispose();
}
