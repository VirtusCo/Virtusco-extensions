// Copyright 2026 VirtusCo

import * as vscode from 'vscode';

export class StatusViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'virtusPCB.statusView';
  private _view?: vscode.WebviewView;
  private _schematicPath: string = '';
  private _syncStatus: 'none' | 'ok' | 'issues' = 'none';
  private _componentCount: number = 0;
  private _netCount: number = 0;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.type === 'openStudio') {
        vscode.commands.executeCommand('virtusPCB.openPCBStudio');
      } else if (message.type === 'loadSchematic') {
        vscode.commands.executeCommand('virtusPCB.loadSchematic');
      } else if (message.type === 'runSyncCheck') {
        vscode.commands.executeCommand('virtusPCB.runSyncCheck');
      }
    });
  }

  public updateStatus(
    schematicPath: string,
    syncStatus: 'none' | 'ok' | 'issues',
    componentCount: number,
    netCount: number
  ): void {
    this._schematicPath = schematicPath;
    this._syncStatus = syncStatus;
    this._componentCount = componentCount;
    this._netCount = netCount;

    if (this._view) {
      this._view.webview.html = this._getHtml();
    }
  }

  private _getHtml(): string {
    const syncBadge =
      this._syncStatus === 'ok'
        ? '<span style="color: #4caf50; font-weight: bold;">SYNC OK</span>'
        : this._syncStatus === 'issues'
          ? '<span style="color: #f44336; font-weight: bold;">SYNC ISSUES</span>'
          : '<span style="color: #888;">Not checked</span>';

    const schName = this._schematicPath
      ? this._schematicPath.split(/[\\/]/).pop() || 'Unknown'
      : 'No schematic loaded';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PCB Status</title>
</head>
<body style="padding: 8px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-sideBar-background);">
  <div style="margin-bottom: 12px;">
    <div style="font-size: 11px; color: var(--vscode-descriptionForeground); text-transform: uppercase; margin-bottom: 4px;">Schematic</div>
    <div style="font-size: 13px; font-weight: 500;">${schName}</div>
  </div>

  <div style="margin-bottom: 12px;">
    <div style="font-size: 11px; color: var(--vscode-descriptionForeground); text-transform: uppercase; margin-bottom: 4px;">Sync Status</div>
    <div style="font-size: 13px;">${syncBadge}</div>
  </div>

  ${this._schematicPath ? `
  <div style="display: flex; gap: 16px; margin-bottom: 12px;">
    <div>
      <div style="font-size: 20px; font-weight: bold; color: var(--vscode-charts-blue);">${this._componentCount}</div>
      <div style="font-size: 10px; color: var(--vscode-descriptionForeground);">Components</div>
    </div>
    <div>
      <div style="font-size: 20px; font-weight: bold; color: var(--vscode-charts-green);">${this._netCount}</div>
      <div style="font-size: 10px; color: var(--vscode-descriptionForeground);">Nets</div>
    </div>
  </div>
  ` : ''}

  <div style="display: flex; flex-direction: column; gap: 6px;">
    <button onclick="send('openStudio')" style="padding: 6px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 2px;">
      Open PCB Studio
    </button>
    <button onclick="send('loadSchematic')" style="padding: 6px 12px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; cursor: pointer; border-radius: 2px;">
      Load Schematic
    </button>
    <button onclick="send('runSyncCheck')" style="padding: 6px 12px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; cursor: pointer; border-radius: 2px;">
      Run Sync Check
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function send(type) { vscode.postMessage({ type }); }
  </script>
</body>
</html>`;
  }
}
