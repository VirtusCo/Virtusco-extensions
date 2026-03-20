// Copyright 2026 VirtusCo
// Virtus ROS 2 Studio — Extension entry point

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ROS2Bridge } from './ros2/ROS2Bridge';
import { NodeGraphReader } from './ros2/NodeGraphReader';
import { FSMTracker } from './fsm/FSMTracker';
import { FrameDecoder } from './esp32/FrameDecoder';
import { LaunchGenerator } from './launch/LaunchGenerator';
import { ProjectManager } from './project/ProjectManager';
import { WorkspaceScanner } from './importer/WorkspaceScanner';
import { ROS2CodeGenerator } from './codegen/ROS2CodeGenerator';
import { StatusViewProvider } from './providers/StatusViewProvider';
import { NodesTreeProvider } from './providers/NodesTreeProvider';
import { TopicsTreeProvider } from './providers/TopicsTreeProvider';
import { ROS2StudioPanel } from './panel/ROS2StudioPanel';
import { VIRTUS_TOPICS, findTopicDef } from './ros2/TopicRegistry';
import { ros2Cmd, execAsync, spawnOpts } from './platform/PlatformUtils';
import {
  WebviewMessage,
  DiscoveredTopic,
  LaunchNodeConfig,
} from './types';

let bridge: ROS2Bridge;
let graphReader: NodeGraphReader;
let fsmTracker: FSMTracker;
let frameDecoder: FrameDecoder;
let launchGenerator: LaunchGenerator;
let statusProvider: StatusViewProvider;
let nodesProvider: NodesTreeProvider;
let topicsProvider: TopicsTreeProvider;
let projectManager: ProjectManager;
let workspaceScanner: WorkspaceScanner;
let codeGenerator: ROS2CodeGenerator;
let pollInterval: ReturnType<typeof setInterval> | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Virtus ROS 2 Studio');
  outputChannel.appendLine('Virtus ROS 2 Studio activated');

  // ── Core Services ──────────────────────────────────────────────

  bridge = new ROS2Bridge(outputChannel);
  graphReader = new NodeGraphReader(bridge);
  fsmTracker = new FSMTracker();
  frameDecoder = new FrameDecoder();
  launchGenerator = new LaunchGenerator();
  projectManager = new ProjectManager();
  workspaceScanner = new WorkspaceScanner();
  codeGenerator = new ROS2CodeGenerator();

  // ── Sidebar Providers ─────────────────────────────────────────

  statusProvider = new StatusViewProvider(context.extensionUri);
  nodesProvider = new NodesTreeProvider();
  topicsProvider = new TopicsTreeProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      StatusViewProvider.viewType,
      statusProvider
    )
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('virtus-ros2.nodes', nodesProvider)
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('virtus-ros2.topics', topicsProvider)
  );

  // ── Check ROS 2 on activation ─────────────────────────────────

  bridge.checkRos2Available().then((status) => {
    statusProvider.updateStatus(status);
    outputChannel.appendLine(
      status.connected
        ? `[extension] ROS 2 detected: ${status.version}`
        : '[extension] ROS 2 not available'
    );

    if (status.connected) {
      refreshAll(outputChannel);
    }
  });

  // ── Commands ──────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ros2.openStudio', () => {
      const panel = ROS2StudioPanel.createOrShow(context, outputChannel);
      setupPanelMessageHandler(panel, outputChannel);

      // Send current status
      panel.sendRos2Status(bridge.status);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ros2.refreshGraph', async () => {
      await refreshAll(outputChannel);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ros2.connectRos2', async () => {
      const status = await bridge.checkRos2Available();
      statusProvider.updateStatus(status);

      if (status.connected) {
        vscode.window.showInformationMessage(
          `ROS 2 connected: ${status.version}`
        );
        await refreshAll(outputChannel);
      } else {
        vscode.window.showWarningMessage(
          'ROS 2 not available. Ensure ROS 2 is installed and sourced.'
        );
      }

      if (ROS2StudioPanel.currentPanel) {
        ROS2StudioPanel.currentPanel.sendRos2Status(status);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ros2.runCommand', async () => {
      const cmd = await vscode.window.showInputBox({
        title: 'Run ROS 2 Command',
        prompt: 'Enter a ROS 2 CLI command (e.g., ros2 topic list)',
        placeHolder: 'ros2 topic list',
      });

      if (cmd) {
        executeRos2Command(cmd, outputChannel);
      }
    })
  );

  // ── Project Commands ─────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ros2.createWorkspace', () => projectManager.createWorkspace())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ros2.createPackage', () => projectManager.createPackage())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ros2.openProject', () => projectManager.openProject())
  );

  // ── Import / CodeGen Commands ─────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ros2.importWorkspace', async () => {
      const folder = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select ROS 2 Workspace',
      });
      if (folder && folder[0]) {
        await handleImportWorkspace(folder[0].fsPath, outputChannel);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ros2.generatePackage', () => {
      if (ROS2StudioPanel.currentPanel) {
        // Trigger via panel message — the webview will show the generate dialog
        vscode.window.showInformationMessage('Use the Generate Package button in the Launch Builder canvas.');
      }
    })
  );

  // ── Polling ───────────────────────────────────────────────────

  pollInterval = setInterval(async () => {
    if (bridge.status.connected) {
      await refreshAll(outputChannel);
    }
  }, 5000);

  // ── Cleanup ───────────────────────────────────────────────────

  context.subscriptions.push(outputChannel);
  context.subscriptions.push(new vscode.Disposable(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  }));
}

export function deactivate(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = undefined;
  }
}

// ── Refresh All Data ──────────────────────────────────────────────────

async function refreshAll(outputChannel: vscode.OutputChannel): Promise<void> {
  try {
    // Get node graph
    const graph = await graphReader.buildGraph();
    nodesProvider.updateNodes(graph.nodes);

    if (ROS2StudioPanel.currentPanel) {
      ROS2StudioPanel.currentPanel.sendNodeGraph(graph);
    }

    // Get topic list and build discovered topics
    const topicList = await bridge.getTopicList();
    const discovered: DiscoveredTopic[] = topicList.map((t) => {
      const def = findTopicDef(t.name);
      return {
        name: t.name,
        type: t.type,
        hz: 0, // Hz is measured on-demand to avoid flooding
        status: 'ok' as const,
      };
    });

    // Mark missing Virtus topics
    const discoveredNames = new Set(discovered.map((d) => d.name));
    for (const vt of VIRTUS_TOPICS) {
      if (!discoveredNames.has(vt.name)) {
        discovered.push({
          name: vt.name,
          type: vt.type,
          hz: 0,
          status: 'missing',
        });
      }
    }

    topicsProvider.updateTopics(discovered);
  } catch (err) {
    outputChannel.appendLine(
      `[extension] Refresh failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ── Panel Message Handler ─────────────────────────────────────────────

function setupPanelMessageHandler(
  panel: ROS2StudioPanel,
  outputChannel: vscode.OutputChannel
): void {
  panel.onMessage((message: WebviewMessage) => {
    switch (message.type) {
      case 'subscribeTopic':
        handleSubscribeTopic(message.topic, panel, outputChannel);
        break;

      case 'unsubscribeTopic':
        outputChannel.appendLine(`[panel] Unsubscribed: ${message.topic}`);
        break;

      case 'runCommand':
        executeRos2Command(message.cmd, outputChannel);
        break;

      case 'getNodeGraph':
      case 'refreshGraph':
        refreshAll(outputChannel);
        break;

      case 'generateLaunch':
        handleGenerateLaunch(message.nodes, panel, outputChannel);
        break;

      case 'saveLaunch':
        handleSaveLaunch(message.nodes, panel, outputChannel);
        break;

      case 'importWorkspace':
        handleImportWorkspaceFromPanel(panel, outputChannel);
        break;

      case 'generatePackage':
        handleGeneratePackage(message, panel, outputChannel);
        break;

      case 'connectRos2':
        vscode.commands.executeCommand('virtus-ros2.connectRos2');
        break;

      case 'connectBridge':
        outputChannel.appendLine(`[panel] Bridge connect: ${message.port} @ ${message.baud}`);
        break;

      case 'disconnectBridge':
        outputChannel.appendLine('[panel] Bridge disconnect');
        break;

      case 'openStudio':
        // Already open
        break;

      case 'setActivePage':
        outputChannel.appendLine(`[panel] Navigate to: ${message.page}`);
        break;
    }
  });
}

// ── Message Handlers ────────────────────────────────────────────────

async function handleSubscribeTopic(
  topic: string,
  panel: ROS2StudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    const data = await bridge.echoTopicOnce(topic);
    if (data) {
      panel.sendTopicMessage(topic, data);
    }
  } catch (err) {
    outputChannel.appendLine(
      `[topic] Subscribe failed for ${topic}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function handleGenerateLaunch(
  nodes: LaunchNodeConfig[],
  panel: ROS2StudioPanel,
  outputChannel: vscode.OutputChannel
): void {
  try {
    const code = launchGenerator.generateLaunchPy(nodes);
    panel.sendLaunchGenerated(code);
    outputChannel.appendLine(`[launch] Generated launch file with ${nodes.length} nodes`);
  } catch (err) {
    outputChannel.appendLine(
      `[launch] Generate failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function handleSaveLaunch(
  nodes: LaunchNodeConfig[],
  panel: ROS2StudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    const code = launchGenerator.generateLaunchPy(nodes);

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('porter_launch.py'),
      filters: { 'Python Launch': ['py'] },
    });

    if (uri) {
      fs.writeFileSync(uri.fsPath, code, 'utf-8');
      panel.sendLaunchSaved(uri.fsPath);
      vscode.window.showInformationMessage(`Launch file saved: ${uri.fsPath}`);
      outputChannel.appendLine(`[launch] Saved: ${uri.fsPath}`);
    }
  } catch (err) {
    outputChannel.appendLine(
      `[launch] Save failed: ${err instanceof Error ? err.message : String(err)}`
    );
    vscode.window.showErrorMessage(
      `Failed to save launch file: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ── Import / CodeGen Handlers ─────────────────────────────────────────

async function handleImportWorkspace(
  workspacePath: string,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    outputChannel.appendLine(`[import] Scanning workspace: ${workspacePath}`);
    const result = await workspaceScanner.scanWorkspace(workspacePath);
    outputChannel.appendLine(
      `[import] Found ${result.packages.length} packages, ${result.launchFiles.length} launch files, ${result.topicGraph.length} topic connections`
    );

    if (ROS2StudioPanel.currentPanel) {
      ROS2StudioPanel.currentPanel.sendMessage({
        type: 'importedGraph',
        packages: result.packages,
        launchFiles: result.launchFiles,
        topicGraph: result.topicGraph,
      } as any);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[import] Failed: ${message}`);
    if (ROS2StudioPanel.currentPanel) {
      ROS2StudioPanel.currentPanel.sendMessage({
        type: 'importError',
        error: message,
      } as any);
    }
  }
}

async function handleImportWorkspaceFromPanel(
  panel: ROS2StudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const folder = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Select ROS 2 Workspace',
  });
  if (folder && folder[0]) {
    await handleImportWorkspace(folder[0].fsPath, outputChannel);
  } else {
    panel.sendMessage({
      type: 'importError',
      error: 'No workspace folder selected',
    } as any);
  }
}

async function handleGeneratePackage(
  message: WebviewMessage,
  panel: ROS2StudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    const msg = message as any;
    outputChannel.appendLine(
      `[codegen] Generating ${msg.language} package: ${msg.packageName}`
    );

    // Build CanvasNodeConfig array from the webview message
    const canvasNodes = (msg.nodes || []).map((n: any) => ({
      name: n.name || 'unnamed_node',
      publishers: (n.outputs || []).map((o: any) => ({
        topic: o.topic,
        msgType: o.msgType,
        hz: 0,
      })),
      subscribers: (n.inputs || []).map((i: any) => ({
        topic: i.topic,
        msgType: i.msgType,
        callback: '',
      })),
      services: [],
      actions: [],
      timers: [],
      parameters: Object.entries(n.params || {}).map(([key, value]) => ({
        name: key,
        type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'float') : 'string',
        default: String(value),
      })),
      lifecycle: false,
    }));

    const generated = codeGenerator.generatePackage({
      name: msg.packageName,
      description: msg.description || `${msg.packageName} ROS 2 package`,
      language: msg.language,
      nodes: canvasNodes,
      dependencies: [],
    });

    // Ask user where to save
    const targetFolder = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Select Output Directory (e.g. workspace/src)',
    });

    if (!targetFolder || !targetFolder[0]) {
      outputChannel.appendLine('[codegen] Cancelled — no output directory selected');
      return;
    }

    const basePath = path.join(targetFolder[0].fsPath, msg.packageName);
    const writtenFiles: string[] = [];

    for (const file of generated.files) {
      const fullPath = path.join(basePath, file.path);
      const dir = path.dirname(fullPath);

      // Create directory if needed
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, file.content, 'utf-8');
      writtenFiles.push(file.path);
    }

    outputChannel.appendLine(
      `[codegen] Generated ${writtenFiles.length} files in ${basePath}`
    );

    panel.sendMessage({
      type: 'packageGenerated',
      files: writtenFiles,
    } as any);

    vscode.window.showInformationMessage(
      `Package '${msg.packageName}' generated with ${writtenFiles.length} files at ${basePath}`
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[codegen] Failed: ${errMsg}`);
    vscode.window.showErrorMessage(`Package generation failed: ${errMsg}`);
  }
}

function executeRos2Command(
  cmd: string,
  outputChannel: vscode.OutputChannel
): void {
  const fullCmd = ros2Cmd(cmd);
  outputChannel.appendLine(`[cmd] Executing: ${fullCmd}`);

  execAsync(fullCmd, { ...spawnOpts(), timeout: 30000 })
    .then((output) => {
      outputChannel.appendLine(`[cmd] Output:\n${output}`);
      if (ROS2StudioPanel.currentPanel) {
        ROS2StudioPanel.currentPanel.sendCommandOutput(cmd, output, 0);
      }
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`[cmd] Error: ${message}`);
      if (ROS2StudioPanel.currentPanel) {
        ROS2StudioPanel.currentPanel.sendCommandOutput(cmd, message, 1);
      }
    });
}
