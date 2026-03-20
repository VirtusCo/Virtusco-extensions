// Copyright 2026 VirtusCo

import * as vscode from 'vscode';
import { TelemetryReceiver } from './telemetry/TelemetryReceiver';
import { TelemetryStore } from './telemetry/TelemetryStore';
import { AlertEngine } from './alerts/AlertEngine';
import { AlertLogger } from './alerts/AlertLogger';
import { StatusViewProvider } from './providers/StatusViewProvider';
import { AlertsTreeProvider } from './providers/AlertsTreeProvider';
import { HardwareDashboardPanel } from './panel/HardwareDashboardPanel';
import { openInEditor } from './schematic/SchematicIndex';
import type { TelemetryPacket, WebviewMessage } from './types';

let receiver: TelemetryReceiver;
let store: TelemetryStore;
let alertEngine: AlertEngine;
let alertLogger: AlertLogger;
let statusProvider: StatusViewProvider;
let alertsProvider: AlertsTreeProvider;

export function activate(context: vscode.ExtensionContext): void {
  // ── Initialize core services ──────────────────────────────────────
  receiver = new TelemetryReceiver();
  store = new TelemetryStore();
  alertEngine = new AlertEngine();

  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || context.extensionPath;
  alertLogger = new AlertLogger(workspacePath);

  // ── Sidebar providers ─────────────────────────────────────────────
  statusProvider = new StatusViewProvider(
    context.extensionUri,
    (port, baud) => connectToPort(port, baud),
    () => disconnectFromPort(),
    () => autoDetectPort(),
    () => openDashboard(context),
  );

  alertsProvider = new AlertsTreeProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(StatusViewProvider.viewType, statusProvider),
    vscode.window.registerTreeDataProvider('virtus-hw.alertsView', alertsProvider),
  );

  // ── Telemetry event handling ──────────────────────────────────────
  receiver.on('packet', (packet: TelemetryPacket) => {
    // Store in ring buffer
    store.push(packet);

    // Evaluate alerts
    const alerts = alertEngine.evaluate(packet);
    for (const alert of alerts) {
      alertLogger.append(alert);
      alertsProvider.addAlert(alert);

      // Forward to dashboard panel
      const panel = HardwareDashboardPanel.getInstance();
      if (panel && !panel.isDisposed()) {
        panel.sendAlert(alert);
      }
    }

    // Forward telemetry to dashboard panel
    const panel = HardwareDashboardPanel.getInstance();
    if (panel && !panel.isDisposed()) {
      panel.sendTelemetry(packet);
    }
  });

  receiver.on('connected', (port: string) => {
    vscode.window.showInformationMessage(`Virtus HW: Connected to ${port}`);
    statusProvider.updateConnectionStatus(true, port);
    const panel = HardwareDashboardPanel.getInstance();
    if (panel && !panel.isDisposed()) {
      panel.sendConnectionStatus(true, port);
    }
  });

  receiver.on('disconnected', () => {
    statusProvider.updateConnectionStatus(false, '');
    const panel = HardwareDashboardPanel.getInstance();
    if (panel && !panel.isDisposed()) {
      panel.sendConnectionStatus(false, '');
    }
  });

  receiver.on('error', (err: Error) => {
    vscode.window.showErrorMessage(`Virtus HW Serial Error: ${err.message}`);
  });

  // ── Commands ──────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('virtus-hw.openDashboard', () => {
      openDashboard(context);
    }),

    vscode.commands.registerCommand('virtus-hw.connect', async () => {
      const config = vscode.workspace.getConfiguration('virtus-hw');
      let port = config.get<string>('serialPort', '');
      const baud = config.get<number>('baudRate', 115200);

      if (!port) {
        const ports = await receiver.listPorts();
        if (ports.length === 0) {
          vscode.window.showWarningMessage('No serial ports found.');
          return;
        }
        const selected = await vscode.window.showQuickPick(ports, {
          placeHolder: 'Select a serial port',
        });
        if (!selected) {
          return;
        }
        port = selected;
      }

      await connectToPort(port, baud);
    }),

    vscode.commands.registerCommand('virtus-hw.disconnect', () => {
      disconnectFromPort();
    }),

    vscode.commands.registerCommand('virtus-hw.autoDetect', () => {
      autoDetectPort();
    }),

    vscode.commands.registerCommand('virtus-hw.clearAlerts', () => {
      alertsProvider.clearAlerts();
      alertEngine.resetCooldowns();
      const panel = HardwareDashboardPanel.getInstance();
      if (panel && !panel.isDisposed()) {
        panel.sendAlertCleared();
      }
      vscode.window.showInformationMessage('Virtus HW: Alerts cleared.');
    }),
  );

  // ── Auto-detect on activation ─────────────────────────────────────
  refreshPortList();
}

function openDashboard(context: vscode.ExtensionContext): void {
  const panel = HardwareDashboardPanel.createOrShow(context.extensionUri, handleWebviewMessage);

  // Send current state
  panel.sendConnectionStatus(receiver.connected, receiver.currentPort);
  panel.sendThresholds(alertEngine.getConfig());

  const latestPacket = store.getLatestPacket();
  if (latestPacket) {
    panel.sendTelemetry(latestPacket);
  }
}

function handleWebviewMessage(msg: WebviewMessage): void {
  switch (msg.type) {
    case 'connect': {
      connectToPort(msg.port, msg.baud);
      break;
    }
    case 'disconnect':
      disconnectFromPort();
      break;
    case 'autoDetect':
      autoDetectPort();
      break;
    case 'clearAlerts':
      alertsProvider.clearAlerts();
      alertEngine.resetCooldowns();
      break;
    case 'requestPortList':
      refreshPortList();
      break;
    case 'requestEventLog': {
      const events = alertLogger.readAll();
      const panel = HardwareDashboardPanel.getInstance();
      if (panel && !panel.isDisposed()) {
        panel.sendEventLog(events);
      }
      break;
    }
    case 'exportCsv': {
      const csv = alertLogger.exportToCsv();
      exportCsvFile(csv);
      break;
    }
    case 'updateThresholds':
      alertEngine.setConfig(msg.config);
      break;
    case 'openSchematic':
      openInEditor(msg.field);
      break;
    case 'changePage':
      // Page navigation is handled in the webview
      break;
  }
}

async function connectToPort(port: string, baud: number): Promise<void> {
  try {
    await receiver.connect(port, baud);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to connect to ${port}: ${message}`);
  }
}

async function disconnectFromPort(): Promise<void> {
  await receiver.disconnect();
  vscode.window.showInformationMessage('Virtus HW: Disconnected.');
}

async function autoDetectPort(): Promise<void> {
  const port = await receiver.autoDetect();
  if (port) {
    vscode.window.showInformationMessage(`Virtus HW: Detected port ${port}`);
    const config = vscode.workspace.getConfiguration('virtus-hw');
    const baud = config.get<number>('baudRate', 115200);
    await connectToPort(port, baud);
  } else {
    vscode.window.showWarningMessage('Virtus HW: No telemetry port detected.');
  }
}

async function refreshPortList(): Promise<void> {
  const ports = await receiver.listPorts();
  statusProvider.updatePortList(ports);
  const panel = HardwareDashboardPanel.getInstance();
  if (panel && !panel.isDisposed()) {
    panel.sendPortList(ports);
  }
}

async function exportCsvFile(csv: string): Promise<void> {
  const uri = await vscode.window.showSaveDialog({
    filters: { 'CSV': ['csv'] },
    defaultUri: vscode.Uri.file('power-events.csv'),
  });
  if (uri) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(csv, 'utf-8'));
    vscode.window.showInformationMessage(`Exported to ${uri.fsPath}`);
  }
}

export function deactivate(): void {
  receiver?.dispose();
  alertsProvider?.dispose();
}
