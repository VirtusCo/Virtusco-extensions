// Copyright 2026 VirtusCo

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { TelemetryPacket, Alert, HostMessage, WebviewMessage, AlertConfig } from '../types';

/**
 * WebviewPanel singleton for the main hardware dashboard.
 * Handles CSP with nonce, message passing, and panel lifecycle.
 */
export class HardwareDashboardPanel {
  public static readonly viewType = 'virtus-hw.dashboard';
  private static instance: HardwareDashboardPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposed = false;

  private onMessage: ((msg: WebviewMessage) => void) | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    onMessage?: (msg: WebviewMessage) => void,
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.onMessage = onMessage;

    this.panel.webview.html = this.getHtml();

    this.panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      if (this.onMessage) {
        this.onMessage(msg);
      }
    });

    this.panel.onDidDispose(() => {
      this.disposed = true;
      HardwareDashboardPanel.instance = undefined;
    });
  }

  /** Create or reveal the singleton dashboard panel */
  static createOrShow(
    extensionUri: vscode.Uri,
    onMessage?: (msg: WebviewMessage) => void,
  ): HardwareDashboardPanel {
    if (HardwareDashboardPanel.instance) {
      HardwareDashboardPanel.instance.panel.reveal(vscode.ViewColumn.One);
      return HardwareDashboardPanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      HardwareDashboardPanel.viewType,
      'Virtus Hardware Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
        ],
      },
    );

    HardwareDashboardPanel.instance = new HardwareDashboardPanel(panel, extensionUri, onMessage);
    return HardwareDashboardPanel.instance;
  }

  /** Get existing instance (if any) */
  static getInstance(): HardwareDashboardPanel | undefined {
    return HardwareDashboardPanel.instance;
  }

  /** Send a telemetry packet to the webview */
  sendTelemetry(packet: TelemetryPacket): void {
    this.postMessage({ type: 'telemetry', packet });
  }

  /** Send an alert to the webview */
  sendAlert(alert: Alert): void {
    this.postMessage({ type: 'alert', alert });
  }

  /** Send connection status to the webview */
  sendConnectionStatus(connected: boolean, port: string): void {
    this.postMessage({ type: 'connectionStatus', connected, port });
  }

  /** Send available port list to the webview */
  sendPortList(ports: string[]): void {
    this.postMessage({ type: 'portList', ports });
  }

  /** Send event log to the webview */
  sendEventLog(events: Alert[]): void {
    this.postMessage({ type: 'eventLog', events });
  }

  /** Send threshold config to the webview */
  sendThresholds(config: AlertConfig): void {
    this.postMessage({ type: 'thresholds', config });
  }

  /** Notify alerts cleared */
  sendAlertCleared(): void {
    this.postMessage({ type: 'alertCleared' });
  }

  /** Send error message */
  sendError(message: string): void {
    this.postMessage({ type: 'error', message });
  }

  /** Check if panel is still alive */
  isDisposed(): boolean {
    return this.disposed;
  }

  private postMessage(msg: HostMessage): void {
    if (!this.disposed) {
      this.panel.webview.postMessage(msg);
    }
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const nonce = crypto.randomBytes(16).toString('hex');

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js'),
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; font-src ${webview.cspSource};">
  <title>Virtus Hardware Dashboard</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    #root {
      width: 100%;
      min-height: 100vh;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
