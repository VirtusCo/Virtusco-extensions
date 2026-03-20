// Copyright 2026 VirtusCo

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { HostMessage, WebviewMessage, SuiteStatus, DependencyCheck } from '../types';

export class SuiteDashboardPanel {
  public static currentPanel: SuiteDashboardPanel | undefined;
  private static readonly viewType = 'virtuscoSuite.dashboardPanel';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _messageHandler?: (message: WebviewMessage) => void;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.webview.html = this._getHtml(this._panel.webview);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        if (this._messageHandler) {
          this._messageHandler(message);
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri): SuiteDashboardPanel {
    const column = vscode.ViewColumn.One;

    if (SuiteDashboardPanel.currentPanel) {
      SuiteDashboardPanel.currentPanel._panel.reveal(column);
      return SuiteDashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      SuiteDashboardPanel.viewType,
      'VirtusCo DevTools Suite',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
        ],
      }
    );

    SuiteDashboardPanel.currentPanel = new SuiteDashboardPanel(panel, extensionUri);
    return SuiteDashboardPanel.currentPanel;
  }

  public onMessage(handler: (message: WebviewMessage) => void): void {
    this._messageHandler = handler;
  }

  public sendSuiteStatus(status: SuiteStatus): void {
    this._postMessage({ type: 'suiteStatus', status });
  }

  public sendDependencies(dependencies: DependencyCheck[]): void {
    this._postMessage({ type: 'dependencies', dependencies });
  }

  public sendError(message: string): void {
    this._postMessage({ type: 'error', message });
  }

  public sendInfo(message: string): void {
    this._postMessage({ type: 'info', message });
  }

  public postMessage(message: HostMessage): void {
    this._postMessage(message);
  }

  private _postMessage(message: HostMessage): void {
    this._panel.webview.postMessage(message);
  }

  public dispose(): void {
    SuiteDashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }

  private _getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
    );
    const nonce = crypto.randomBytes(16).toString('hex');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
  <title>VirtusCo DevTools Suite</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100vh; overflow: hidden; }
    body {
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground, #cccccc);
      background: var(--vscode-editor-background, #1e1e1e);
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
