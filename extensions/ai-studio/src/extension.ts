// Copyright 2026 VirtusCo
// Virtus AI Studio — Extension entry point

import * as vscode from 'vscode';
import { PythonBridge } from './python/PythonBridge';
import { GpuProbe } from './hardware/GpuProbe';
import { RPiConnector } from './hardware/RPiConnector';
import { HailoProbe } from './hardware/HailoProbe';
import { HardwareTreeProvider } from './providers/HardwareTreeProvider';
import { JobsTreeProvider } from './providers/JobsTreeProvider';
import { DashboardViewProvider } from './providers/DashboardViewProvider';
import { AIStudioPanel } from './panel/AIStudioPanel';
import { VisionDatasetManager } from './dataset/VisionDatasetManager';
import { LLMDatasetBuilder } from './dataset/LLMDatasetBuilder';
import {
  SSHConfig,
  WebviewMessage,
  TrainingMetric,
  RunRecord,
  TrainingConfig,
  ExportConfig,
  DeployConfig,
  InferenceRequest,
  LLMPair,
} from './types';

let bridge: PythonBridge;
let gpuProbe: GpuProbe;
let rpiConnector: RPiConnector;
let hailoProbe: HailoProbe;
let dashboardProvider: DashboardViewProvider;
let hardwareProvider: HardwareTreeProvider;
let jobsProvider: JobsTreeProvider;
let visionDatasetManager: VisionDatasetManager;
let llmDatasetBuilder: LLMDatasetBuilder;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Virtus AI Studio');
  outputChannel.appendLine('Virtus AI Studio activated');

  // ── Core Services ──────────────────────────────────────────────

  bridge = new PythonBridge(outputChannel);
  gpuProbe = new GpuProbe(outputChannel);
  rpiConnector = new RPiConnector();
  hailoProbe = new HailoProbe(rpiConnector);
  visionDatasetManager = new VisionDatasetManager();
  llmDatasetBuilder = new LLMDatasetBuilder();

  // Start GPU polling immediately — it calls nvidia-smi directly, no Python needed
  gpuProbe.startPolling();
  outputChannel.appendLine('[extension] GPU polling started (direct nvidia-smi)');

  // Start the Python backend (non-blocking, not required for basic GPU monitoring)
  bridge.start().then(() => {
    outputChannel.appendLine('[extension] Python backend started');
  }).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[extension] Python backend not started (GPU monitoring still works): ${message}`);
    // Don't show warning for backend — GPU probing works without it
  });

  // ── Sidebar Providers ─────────────────────────────────────────

  dashboardProvider = new DashboardViewProvider(context.extensionUri);
  hardwareProvider = new HardwareTreeProvider();
  jobsProvider = new JobsTreeProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DashboardViewProvider.viewType,
      dashboardProvider
    )
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('virtus-ai.hardware', hardwareProvider)
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('virtus-ai.jobs', jobsProvider)
  );

  // ── GPU Updates → Sidebar + Panel ─────────────────────────────

  context.subscriptions.push(
    gpuProbe.onUpdate((state) => {
      hardwareProvider.updateGpu(state);
      dashboardProvider.updateGpu(state);
      dashboardProvider.updateRecommendation(gpuProbe.recommendFineTuneMethod(state));

      if (AIStudioPanel.currentPanel) {
        AIStudioPanel.currentPanel.sendGpuUpdate(state);
      }
    })
  );

  // ── Commands ──────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ai.openStudio', () => {
      const panel = AIStudioPanel.createOrShow(context, outputChannel);
      setupPanelMessageHandler(panel, outputChannel);

      // Send current state immediately if available
      const gpuState = gpuProbe.getLastState();
      if (gpuState) {
        panel.sendGpuUpdate(gpuState);
        panel.sendVramRecommendation(gpuProbe.recommendFineTuneMethod(gpuState));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ai.probeGpu', async () => {
      try {
        const state = await gpuProbe.probe();
        if (state) {
          hardwareProvider.updateGpu(state);
          if (AIStudioPanel.currentPanel) {
            AIStudioPanel.currentPanel.sendGpuUpdate(state);
            AIStudioPanel.currentPanel.sendVramRecommendation(
              gpuProbe.recommendFineTuneMethod(state)
            );
          }
          vscode.window.showInformationMessage(
            `GPU: ${state.name} — ${state.vram_free_mb} MB free VRAM`
          );
        } else {
          vscode.window.showWarningMessage('No NVIDIA GPU detected (nvidia-smi not found or failed)');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`GPU probe failed: ${message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ai.connectRpi', async () => {
      const config = await promptForSSHConfig();
      if (!config) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Connecting to Raspberry Pi...',
            cancellable: false,
          },
          async () => {
            await rpiConnector.connect(config);

            const testResult = await rpiConnector.testConnection();
            if (testResult.success) {
              hardwareProvider.updateRpi(true, testResult.rpiInfo);
              vscode.window.showInformationMessage(
                `Connected to RPi: ${testResult.rpiInfo?.hostname ?? config.host}`
              );

              // Probe Hailo after successful connection
              const hailoState = await hailoProbe.probe();
              hardwareProvider.updateHailo(hailoState);

              if (AIStudioPanel.currentPanel) {
                AIStudioPanel.currentPanel.sendHailoUpdate(hailoState);
              }
            } else {
              vscode.window.showWarningMessage(
                `RPi connection test failed: ${testResult.message}`
              );
            }
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`RPi connection failed: ${message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-ai.refreshHardware', async () => {
      // Refresh GPU (direct nvidia-smi, no backend needed)
      const state = await gpuProbe.probe();
      if (state) {
        hardwareProvider.updateGpu(state);
      }

      // Refresh RPi/Hailo
      if (rpiConnector.isConnected()) {
        const testResult = await rpiConnector.testConnection();
        hardwareProvider.updateRpi(testResult.success, testResult.rpiInfo);

        const hailoState = await hailoProbe.probe();
        hardwareProvider.updateHailo(hailoState);
      }

      hardwareProvider.refresh();
      jobsProvider.refresh();
    })
  );

  // ── Cleanup ───────────────────────────────────────────────────

  context.subscriptions.push(outputChannel);
  context.subscriptions.push(new vscode.Disposable(() => {
    gpuProbe.stopPolling();
  }));
}

export function deactivate(): void {
  gpuProbe?.stopPolling();
  bridge?.stop().catch(() => { /* best-effort shutdown */ });
  rpiConnector?.disconnect().catch(() => { /* best-effort disconnect */ });
}

// ── Panel Message Handler ─────────────────────────────────────────

function setupPanelMessageHandler(
  panel: AIStudioPanel,
  outputChannel: vscode.OutputChannel
): void {
  panel.onMessage((message: WebviewMessage) => {
    switch (message.type) {
      case 'probeGpu':
        vscode.commands.executeCommand('virtus-ai.probeGpu');
        break;

      case 'connectRpi':
        handleConnectRpi(message.config, panel, outputChannel);
        break;

      case 'startTraining':
        handleStartTraining(message.config, panel, outputChannel);
        break;

      case 'cancelTraining':
        handleCancelTraining(message.run_id, outputChannel);
        break;

      case 'startExport':
        handleStartExport(message.config, panel, outputChannel);
        break;

      case 'deployModel':
        handleDeployModel(message.config, panel, outputChannel);
        break;

      case 'runInference':
        handleRunInference(message.request, panel, outputChannel);
        break;

      case 'getRunHistory':
        handleGetRunHistory(panel, outputChannel);
        break;

      case 'navigateTo':
        outputChannel.appendLine(`[panel] Navigate to: ${message.view}`);
        break;

      case 'scanDataset':
        handleScanDataset(message.datasetPath, panel, outputChannel);
        break;

      case 'validateDataset':
        handleValidateDataset(message.datasetPath, panel, outputChannel);
        break;

      case 'buildJsonl':
        handleBuildJsonl(message.pairs, message.outputPath, panel, outputChannel);
        break;

      case 'browse':
        handleBrowse(
          (message as Record<string, unknown>).browseId as string,
          (message as Record<string, unknown>).browseType as string,
          (message as Record<string, unknown>).filters as Record<string, string[]> | undefined,
          panel
        );
        break;
    }
  });
}

// ── Message Handlers ────────────────────────────────────────────────

async function handleConnectRpi(
  config: SSHConfig,
  panel: AIStudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    await rpiConnector.connect(config);
    const testResult = await rpiConnector.testConnection();
    hardwareProvider.updateRpi(testResult.success, testResult.rpiInfo);

    const hailoState = await hailoProbe.probe();
    hardwareProvider.updateHailo(hailoState);
    panel.sendHailoUpdate(hailoState);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[rpi] Connection failed: ${message}`);
    vscode.window.showErrorMessage(`RPi connection failed: ${message}`);
  }
}

async function handleStartTraining(
  config: TrainingConfig,
  panel: AIStudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  if (!bridge.isRunning()) {
    vscode.window.showWarningMessage('Virtus AI: Backend not running');
    return;
  }

  try {
    outputChannel.appendLine(`[training] Starting: ${config.model_name} (${config.run_type})`);

    jobsProvider.addActiveJob(
      `job-${Date.now()}`,
      config.model_name,
      config.run_type
    );

    await bridge.streamSSE('/train', config as unknown as Record<string, unknown>, (event) => {
      try {
        switch (event.event) {
          case 'metric': {
            const metric = JSON.parse(event.data) as TrainingMetric;
            panel.sendTrainingMetric(metric);
            jobsProvider.updateJobMetric(metric.step.toString(), metric);
            break;
          }
          case 'done': {
            const done = JSON.parse(event.data) as { run_id: string; summary: Record<string, number> };
            panel.sendTrainingDone(done.run_id, done.summary);
            jobsProvider.completeJob(done.run_id, done.summary);
            vscode.window.showInformationMessage(
              `Training complete: ${config.model_name}`
            );
            break;
          }
          case 'error': {
            const errorData = JSON.parse(event.data) as { run_id: string; error: string };
            panel.sendTrainingError(errorData.run_id, errorData.error);
            jobsProvider.failJob(errorData.run_id, errorData.error);
            vscode.window.showErrorMessage(
              `Training failed: ${errorData.error}`
            );
            break;
          }
        }
      } catch (parseErr) {
        outputChannel.appendLine(
          `[training] Failed to parse SSE event: ${event.data}`
        );
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[training] Error: ${message}`);
    vscode.window.showErrorMessage(`Training failed: ${message}`);
  }
}

async function handleCancelTraining(
  runId: string,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  if (!bridge.isRunning()) {
    return;
  }

  try {
    await bridge.fetch(`/train/${runId}/cancel`, 'POST');
    outputChannel.appendLine(`[training] Cancelled: ${runId}`);
    jobsProvider.failJob(runId, 'Cancelled by user');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[training] Cancel failed: ${message}`);
  }
}

async function handleStartExport(
  config: ExportConfig,
  panel: AIStudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  if (!bridge.isRunning()) {
    vscode.window.showWarningMessage('Virtus AI: Backend not running');
    return;
  }

  try {
    outputChannel.appendLine(`[export] Starting: ${config.run_id} → ${config.format}`);

    await bridge.streamSSE('/export', config as unknown as Record<string, unknown>, (event) => {
      try {
        switch (event.event) {
          case 'step': {
            const step = JSON.parse(event.data) as { run_id: string; step: string; progress: number };
            panel.sendExportStep(step.run_id, step.step, step.progress);
            break;
          }
          case 'done': {
            const done = JSON.parse(event.data) as { run_id: string; artifact_path: string };
            panel.sendExportDone(done.run_id, done.artifact_path);
            vscode.window.showInformationMessage(
              `Export complete: ${done.artifact_path}`
            );
            break;
          }
        }
      } catch (parseErr) {
        outputChannel.appendLine(
          `[export] Failed to parse SSE event: ${event.data}`
        );
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[export] Error: ${message}`);
    vscode.window.showErrorMessage(`Export failed: ${message}`);
  }
}

async function handleDeployModel(
  config: DeployConfig,
  panel: AIStudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  if (!rpiConnector.isConnected()) {
    vscode.window.showWarningMessage('Virtus AI: Not connected to RPi');
    return;
  }

  try {
    outputChannel.appendLine(`[deploy] Uploading ${config.artifact_path} → ${config.remote_path}`);

    panel.sendDeployProgress('uploading', 0);

    await rpiConnector.putFile(config.artifact_path, config.remote_path, (pct) => {
      panel.sendDeployProgress('uploading', pct);
    });

    panel.sendDeployProgress('restarting service', 80);

    // Restart the target service
    await rpiConnector.exec(`sudo systemctl restart ${config.service_name}`);

    // Check service status
    const statusResult = await rpiConnector.exec(
      `systemctl show ${config.service_name} --property=ActiveState,ActiveEnterTimestamp`
    );

    const isActive = statusResult.stdout.includes('ActiveState=active');
    panel.sendDeployProgress('done', 100);
    panel.sendServiceStatus(config.service_name, isActive, 0);

    if (isActive) {
      vscode.window.showInformationMessage(
        `Model deployed and ${config.service_name} is running`
      );
    } else {
      vscode.window.showWarningMessage(
        `Model deployed but ${config.service_name} failed to start`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[deploy] Error: ${message}`);
    vscode.window.showErrorMessage(`Deployment failed: ${message}`);
  }
}

async function handleRunInference(
  request: InferenceRequest,
  panel: AIStudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  if (!bridge.isRunning()) {
    vscode.window.showWarningMessage('Virtus AI: Backend not running');
    return;
  }

  try {
    const result = await bridge.fetch<{ output: string; tokens_per_second: number }>(
      '/inference',
      'POST',
      request as unknown as Record<string, unknown>
    );
    panel.sendInferenceResult(result.output, result.tokens_per_second);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[inference] Error: ${message}`);
    vscode.window.showErrorMessage(`Inference failed: ${message}`);
  }
}

async function handleGetRunHistory(
  panel: AIStudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  if (!bridge.isRunning()) {
    panel.sendRunHistory([]);
    return;
  }

  try {
    const runs = await bridge.fetch<RunRecord[]>('/runs');
    panel.sendRunHistory(runs);
    jobsProvider.setRunHistory(runs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[runs] Error fetching history: ${message}`);
    panel.sendRunHistory([]);
  }
}

// ── Dataset Handlers ─────────────────────────────────────────────────

async function handleScanDataset(
  datasetPath: string,
  panel: AIStudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    outputChannel.appendLine(`[dataset] Scanning: ${datasetPath}`);
    const stats = await visionDatasetManager.scanDataset(datasetPath);
    panel.sendMessage({ type: 'visionStats', stats });
    outputChannel.appendLine(
      `[dataset] Scan complete: ${stats.totalImages} images, ${stats.numClasses} classes`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[dataset] Scan failed: ${message}`);
    vscode.window.showErrorMessage(`Dataset scan failed: ${message}`);
  }
}

async function handleValidateDataset(
  datasetPath: string,
  panel: AIStudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    outputChannel.appendLine(`[dataset] Validating: ${datasetPath}`);
    const result = await visionDatasetManager.validateDataset(datasetPath);
    panel.sendMessage({ type: 'visionValidation', result });
    outputChannel.appendLine(
      `[dataset] Validation: ${result.valid ? 'PASSED' : 'FAILED'} (${result.errors.length} errors, ${result.warnings.length} warnings)`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[dataset] Validation failed: ${message}`);
    vscode.window.showErrorMessage(`Dataset validation failed: ${message}`);
  }
}

async function handleBuildJsonl(
  pairs: LLMPair[],
  outputPath: string,
  panel: AIStudioPanel,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    outputChannel.appendLine(`[dataset] Building JSONL: ${pairs.length} pairs → ${outputPath}`);
    const result = await llmDatasetBuilder.buildJsonl(pairs, outputPath);
    panel.sendMessage({ type: 'llmBuildResult', result });
    outputChannel.appendLine(
      `[dataset] JSONL built: ${result.totalPairs} pairs, ${result.qualityIssues.length} issues`
    );
    vscode.window.showInformationMessage(
      `JSONL dataset built: ${result.totalPairs} pairs → ${result.outputPath}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[dataset] JSONL build failed: ${message}`);
    vscode.window.showErrorMessage(`JSONL build failed: ${message}`);
  }
}

// ── Browse Handler ──────────────────────────────────────────────────

async function handleBrowse(
  browseId: string,
  browseType: string,
  filters: Record<string, string[]> | undefined,
  panel: AIStudioPanel
): Promise<void> {
  const options: vscode.OpenDialogOptions = {
    canSelectFiles: browseType === 'file',
    canSelectFolders: browseType === 'folder',
    canSelectMany: false,
    openLabel: 'Select',
  };

  if (filters && Object.keys(filters).length > 0) {
    options.filters = filters;
  }

  const result = await vscode.window.showOpenDialog(options);
  if (result && result.length > 0) {
    panel.sendMessage({
      type: 'browseResult' as 'visionStats',  // cast to satisfy union — we send raw
      browseId,
      path: result[0].fsPath,
    } as unknown as import('./types').HostMessage);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

async function promptForSSHConfig(): Promise<SSHConfig | undefined> {
  const vsConfig = vscode.workspace.getConfiguration('virtus-ai');

  const host = await vscode.window.showInputBox({
    title: 'RPi Host',
    prompt: 'Hostname or IP of the Raspberry Pi',
    value: vsConfig.get<string>('rpiHost', ''),
    ignoreFocusOut: true,
  });

  if (!host) {
    return undefined;
  }

  const username = await vscode.window.showInputBox({
    title: 'SSH Username',
    prompt: 'Username for SSH connection',
    value: vsConfig.get<string>('rpiUsername', 'pi'),
    ignoreFocusOut: true,
  });

  if (!username) {
    return undefined;
  }

  const privateKeyPath = await vscode.window.showInputBox({
    title: 'SSH Key Path',
    prompt: 'Path to the SSH private key',
    value: vsConfig.get<string>('rpiSshKeyPath', '~/.ssh/id_rsa'),
    ignoreFocusOut: true,
  });

  if (!privateKeyPath) {
    return undefined;
  }

  return {
    host,
    port: 22,
    username,
    privateKeyPath,
  };
}
