// Copyright 2026 VirtusCo

import * as vscode from 'vscode';
import { checkAll as checkExtensions } from '../installer/ExtensionInstaller';
import { detectWorkspace } from '../bootstrap/WorkspaceBootstrapper';

export class OverviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'virtusco-suite.overview';
  private _view?: vscode.WebviewView;

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
      switch (message.type) {
        case 'openSuite':
          vscode.commands.executeCommand('virtuscoSuite.openSuite');
          break;
        case 'openExtension':
          vscode.commands.executeCommand(message.command);
          break;
        case 'installAll':
          vscode.commands.executeCommand('virtuscoSuite.installAll');
          break;
      }
    });
  }

  public refresh(): void {
    if (this._view) {
      this._view.webview.html = this._getHtml();
    }
  }

  private _getHtml(): string {
    const extensions = checkExtensions();
    const workspace = detectWorkspace();
    const installedCount = extensions.filter((e) => e.installed).length;

    const extensionButtons = extensions
      .map((ext) => {
        if (ext.installed) {
          return `<button onclick="send('openExtension', '${ext.openCommand}')"
            style="padding: 6px 10px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 2px; width: 100%; text-align: left; margin-bottom: 4px; font-size: 12px;">
            ${ext.name}
          </button>`;
        }
        return `<button disabled
          style="padding: 6px 10px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-disabledForeground); border: none; border-radius: 2px; width: 100%; text-align: left; margin-bottom: 4px; font-size: 12px;">
          ${ext.name} (not installed)
        </button>`;
      })
      .join('\n');

    const workspaceInfo = workspace
      ? `<div style="font-size: 12px;">${workspace.name} [${workspace.branch}]</div>`
      : `<div style="font-size: 12px; color: var(--vscode-descriptionForeground);">No Porter-ROS workspace detected</div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VirtusCo Suite</title>
</head>
<body style="padding: 8px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-sideBar-background);">
  <div style="margin-bottom: 12px;">
    <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">VirtusCo DevTools Suite</div>
    <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">${installedCount}/7 extensions installed</div>
  </div>

  <div style="margin-bottom: 12px;">
    <div style="font-size: 11px; color: var(--vscode-descriptionForeground); text-transform: uppercase; margin-bottom: 4px;">Workspace</div>
    ${workspaceInfo}
  </div>

  <div style="margin-bottom: 12px;">
    <div style="font-size: 11px; color: var(--vscode-descriptionForeground); text-transform: uppercase; margin-bottom: 6px;">Quick Open</div>
    ${extensionButtons}
  </div>

  <div style="display: flex; flex-direction: column; gap: 6px;">
    <button onclick="send('openSuite')" style="padding: 6px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 2px;">
      Open Dashboard
    </button>
    <button onclick="send('installAll')" style="padding: 6px 12px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; cursor: pointer; border-radius: 2px;">
      Install All Missing
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function send(type, command) { vscode.postMessage({ type, command }); }
  </script>
</body>
</html>`;
  }
}
