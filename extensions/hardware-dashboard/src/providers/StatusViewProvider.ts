// Copyright 2026 VirtusCo

import * as vscode from 'vscode';

/**
 * Sidebar webview showing connection status, port selector,
 * and connect/disconnect buttons.
 */
export class StatusViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'virtus-hw.statusView';

  private view?: vscode.WebviewView;
  private connected = false;
  private currentPort = '';
  private ports: string[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onConnect: (port: string, baud: number) => void,
    private readonly onDisconnect: () => void,
    private readonly onAutoDetect: () => void,
    private readonly onOpenDashboard: () => void,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'connect': {
          const config = vscode.workspace.getConfiguration('virtus-hw');
          const baud = config.get<number>('baudRate', 115200);
          this.onConnect(msg.port, baud);
          break;
        }
        case 'disconnect':
          this.onDisconnect();
          break;
        case 'autoDetect':
          this.onAutoDetect();
          break;
        case 'openDashboard':
          this.onOpenDashboard();
          break;
      }
    });
  }

  updateConnectionStatus(connected: boolean, port: string): void {
    this.connected = connected;
    this.currentPort = port;
    this.refresh();
  }

  updatePortList(ports: string[]): void {
    this.ports = ports;
    this.refresh();
  }

  private refresh(): void {
    if (this.view) {
      this.view.webview.html = this.getHtml();
    }
  }

  private getHtml(): string {
    const statusColor = this.connected
      ? 'var(--vscode-testing-iconPassed)'
      : 'var(--vscode-testing-iconFailed)';
    const statusText = this.connected
      ? `Connected: ${this.currentPort}`
      : 'Disconnected';

    const portOptions = this.ports
      .map((p) => `<option value="${p}" ${p === this.currentPort ? 'selected' : ''}>${p}</option>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Status</title>
</head>
<body style="padding: 8px; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground);">
  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
    <span style="width: 10px; height: 10px; border-radius: 50%; background: ${statusColor}; display: inline-block;"></span>
    <span style="font-weight: bold;">${statusText}</span>
  </div>

  <div style="margin-bottom: 8px;">
    <label style="display: block; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; opacity: 0.7;">Port</label>
    <select id="portSelect" style="width: 100%; padding: 4px 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px;">
      ${portOptions}
      <option value="">Manual entry...</option>
    </select>
  </div>

  <div style="display: flex; gap: 4px; margin-bottom: 8px;">
    ${this.connected
      ? '<button onclick="disconnect()" style="flex: 1; padding: 6px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; cursor: pointer;">Disconnect</button>'
      : '<button onclick="connect()" style="flex: 1; padding: 6px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; cursor: pointer;">Connect</button>'
    }
    <button onclick="autoDetect()" style="padding: 6px 10px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 2px; cursor: pointer;" title="Auto-detect port">Detect</button>
  </div>

  <button onclick="openDashboard()" style="width: 100%; padding: 6px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; cursor: pointer;">
    Open Dashboard
  </button>

  <script>
    const vscode = acquireVsCodeApi();
    function connect() {
      const port = document.getElementById('portSelect').value;
      if (port) {
        vscode.postMessage({ type: 'connect', port });
      }
    }
    function disconnect() {
      vscode.postMessage({ type: 'disconnect' });
    }
    function autoDetect() {
      vscode.postMessage({ type: 'autoDetect' });
    }
    function openDashboard() {
      vscode.postMessage({ type: 'openDashboard' });
    }
  </script>
</body>
</html>`;
  }
}
