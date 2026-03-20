// Copyright 2026 VirtusCo
// Project sidebar webview provider — create/open/recent projects

import * as vscode from 'vscode';

export class ProjectWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'virtus.projectView';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'createProject':
          vscode.commands.executeCommand('virtus.createProject');
          break;
        case 'openProject':
          vscode.commands.executeCommand('virtus.openProject');
          break;
        case 'openBuilder':
          vscode.commands.executeCommand('virtus.openBuilder');
          break;
        case 'selectBoard':
          vscode.commands.executeCommand('virtus.selectBoard');
          break;
      }
    });
  }

  private _getHtml(_webview: vscode.Webview): string {
    const board = vscode.workspace.getConfiguration('virtus').get('selectedBoard', 'esp32_devkitc_wroom');
    const hasWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
    const workspaceName = hasWorkspace ? vscode.workspace.workspaceFolders![0].name : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 0;
      margin: 0;
    }
    .section {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 10px;
      margin-bottom: 4px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      text-align: left;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      transition: background 0.1s;
    }
    .btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .icon {
      font-size: 14px;
      width: 18px;
      text-align: center;
    }
    .workspace-info {
      padding: 8px 12px;
      background: var(--vscode-editor-background);
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .workspace-info .name {
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }
    .workspace-info .meta {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      margin-top: 2px;
    }
    .logo {
      text-align: center;
      padding: 16px 0 8px;
      font-size: 16px;
      font-weight: 700;
      color: var(--vscode-textLink-foreground);
    }
    .logo .sub {
      font-size: 10px;
      font-weight: 400;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="logo">
    Virtus Firmware Builder
    <div class="sub">VirtusCo · Zephyr RTOS</div>
  </div>

  ${hasWorkspace ? `
  <div class="section">
    <div class="section-title">Current Project</div>
    <div class="workspace-info">
      <div class="name">${workspaceName}</div>
      <div class="meta">Board: ${board}</div>
    </div>
    <button class="btn btn-primary" onclick="send('openBuilder')">
      <span class="icon">◧</span> Open Canvas
    </button>
    <button class="btn" onclick="send('selectBoard')">
      <span class="icon">⊞</span> Change Board
    </button>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Get Started</div>
    <button class="btn btn-primary" onclick="send('createProject')">
      <span class="icon">+</span> Create New Project
    </button>
    <button class="btn" onclick="send('openProject')">
      <span class="icon">📂</span> Open Existing Project
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function send(type) {
      vscode.postMessage({ type });
    }
  </script>
</body>
</html>`;
  }
}
