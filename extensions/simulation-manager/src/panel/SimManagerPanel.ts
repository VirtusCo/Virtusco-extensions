// Copyright 2026 VirtusCo
// WebviewPanel singleton for the full Simulation Manager UI

import * as vscode from 'vscode';
import {
  WebviewMessage,
  HostMessage,
  ProcessInfo,
  BagFile,
  Nav2ParamGroup,
  ScenarioResult,
  LaunchProfile,
  URDFLink,
  URDFJoint,
  Scenario,
  WorldFile,
} from '../types';

const VIEW_TYPE = 'virtusSim.simManager';

export class SimManagerPanel {
  public static currentPanel: SimManagerPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _onMessage?: (msg: WebviewMessage) => void;

  public static createOrShow(
    context: vscode.ExtensionContext
  ): SimManagerPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (SimManagerPanel.currentPanel) {
      SimManagerPanel.currentPanel._panel.reveal(column);
      return SimManagerPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      'Virtus Simulation Manager',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist'),
          vscode.Uri.joinPath(context.extensionUri, 'resources'),
        ],
      }
    );

    SimManagerPanel.currentPanel = new SimManagerPanel(panel, context.extensionUri);
    return SimManagerPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.webview.html = this._getHtmlForWebview();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => {
        this._onMessage?.(msg);
      },
      null,
      this._disposables
    );
  }

  setOnMessage(handler: (msg: WebviewMessage) => void): void {
    this._onMessage = handler;
  }

  sendProcessStatus(processes: ProcessInfo[]): void {
    this._postMessage({ type: 'processStatus', processes });
  }

  sendProfilesData(profiles: LaunchProfile[], activeProfileId: string | null): void {
    this._postMessage({ type: 'profilesData', profiles, activeProfileId });
  }

  sendBagList(bags: BagFile[]): void {
    this._postMessage({ type: 'bagList', bags });
  }

  sendRecordingStatus(recording: boolean, elapsed_s: number): void {
    this._postMessage({ type: 'recordingStatus', recording, elapsed_s });
  }

  sendNav2Params(params: Record<string, unknown>, schema: Nav2ParamGroup[]): void {
    this._postMessage({ type: 'nav2Params', params, schema });
  }

  sendURDFData(links: URDFLink[], joints: URDFJoint[], warnings: string[]): void {
    this._postMessage({ type: 'urdfData', links, joints, warnings });
  }

  sendScenarioList(scenarios: Scenario[]): void {
    this._postMessage({ type: 'scenarioList', scenarios });
  }

  sendScenarioResult(result: ScenarioResult): void {
    this._postMessage({ type: 'scenarioResult', result });
  }

  sendWorldList(worlds: WorldFile[]): void {
    this._postMessage({ type: 'worldList', worlds });
  }

  sendError(message: string): void {
    this._postMessage({ type: 'error', message });
  }

  sendInfo(message: string): void {
    this._postMessage({ type: 'info', message });
  }

  public dispose(): void {
    SimManagerPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      d?.dispose();
    }
  }

  private _postMessage(message: HostMessage): void {
    this._panel.webview.postMessage(message);
  }

  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}';
             font-src ${webview.cspSource};
             img-src ${webview.cspSource} data:;">
  <title>Virtus Simulation Manager</title>
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

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return nonce;
}
