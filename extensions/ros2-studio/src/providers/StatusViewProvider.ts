// Copyright 2026 VirtusCo
// Status sidebar webview provider — connection status + quick actions

import * as vscode from 'vscode';
import { ROS2Status } from '../types';

export class StatusViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'virtus-ros2.status';
  private _view?: vscode.WebviewView;
  private _status: ROS2Status = {
    connected: false,
    version: '',
    rosbridgeRunning: false,
  };

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

    webviewView.webview.html = this._getHtml();

    // Auto-open the full studio panel when sidebar becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        vscode.commands.executeCommand('virtus-ros2.openStudio');
      }
    });

    // Also open on first resolve
    vscode.commands.executeCommand('virtus-ros2.openStudio');

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'openStudio':
          vscode.commands.executeCommand('virtus-ros2.openStudio');
          break;
        case 'refreshGraph':
          vscode.commands.executeCommand('virtus-ros2.refreshGraph');
          break;
        case 'connectRos2':
          vscode.commands.executeCommand('virtus-ros2.connectRos2');
          break;
        case 'createWorkspace':
          vscode.commands.executeCommand('virtus-ros2.createWorkspace');
          break;
        case 'createPackage':
          vscode.commands.executeCommand('virtus-ros2.createPackage');
          break;
        case 'openProject':
          vscode.commands.executeCommand('virtus-ros2.openProject');
          break;
      }
    });
  }

  /**
   * Updates the ROS 2 connection status display.
   */
  updateStatus(status: ROS2Status): void {
    this._status = status;
    this._updateWebview();
  }

  private _updateWebview(): void {
    if (this._view) {
      this._view.webview.html = this._getHtml();
    }
  }

  private _getHtml(): string {
    const s = this._status;
    const statusDot = s.connected ? '#4caf50' : '#f44336';
    const statusText = s.connected ? 'Connected' : 'Disconnected';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); font-size: 12px; color: var(--vscode-foreground); padding: 0; margin: 0; }
    .section { padding: 10px 14px; border-bottom: 1px solid var(--vscode-panel-border); }
    .title { font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--vscode-descriptionForeground); margin-bottom: 6px; letter-spacing: 0.5px; }
    .btn { display: block; width: 100%; padding: 6px 10px; margin-bottom: 4px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; text-align: left; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
    .stat { display: flex; justify-content: space-between; padding: 2px 0; }
    .stat .label { color: var(--vscode-descriptionForeground); }
    .stat .value { font-weight: 600; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
    .logo { text-align: center; padding: 12px 0 4px; font-size: 14px; font-weight: 700; color: var(--vscode-textLink-foreground); }
    .logo .sub { font-size: 10px; font-weight: 400; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <div class="logo">
    Virtus ROS 2 Studio
    <div class="sub">Development Environment</div>
  </div>

  <div class="section">
    <button class="btn btn-primary" onclick="send('openStudio')">Open Full Studio</button>
  </div>

  <div class="section">
    <div class="title">ROS 2 Status</div>
    <div class="stat">
      <span class="label"><span class="dot" style="background:${statusDot}"></span>${statusText}</span>
    </div>
    ${s.version ? `<div class="stat"><span class="label">Version</span><span class="value">${s.version}</span></div>` : ''}
    <div class="stat">
      <span class="label">rosbridge</span>
      <span class="value" style="color:${s.rosbridgeRunning ? '#4caf50' : '#f44336'}">${s.rosbridgeRunning ? 'Running' : 'Stopped'}</span>
    </div>
  </div>

  <div class="section">
    <div class="title">Project</div>
    <button class="btn btn-primary" onclick="send('createWorkspace')">New Workspace</button>
    <button class="btn" onclick="send('createPackage')">New Package</button>
    <button class="btn" onclick="send('openProject')">Open Project</button>
  </div>

  <div class="section">
    <div class="title">Quick Actions</div>
    <button class="btn" onclick="send('connectRos2')">Connect to ROS 2</button>
    <button class="btn" onclick="send('refreshGraph')">Refresh Node Graph</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function send(type) { vscode.postMessage({ type }); }
  </script>
</body>
</html>`;
  }
}
