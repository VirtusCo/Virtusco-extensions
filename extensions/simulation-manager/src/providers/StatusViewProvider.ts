// Copyright 2026 VirtusCo
// Sidebar webview provider for simulation status and quick launch

import * as vscode from 'vscode';
import { LaunchProfile, ProcessInfo } from '../types';

export class StatusViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'virtusSim.statusView';
  private _view?: vscode.WebviewView;
  private _profiles: LaunchProfile[] = [];
  private _activeProfileId: string | null = null;
  private _processes: ProcessInfo[] = [];

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

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'launchProfile':
          vscode.commands.executeCommand('virtusSim.launchProfile', msg.profileId);
          break;
        case 'stopAll':
          vscode.commands.executeCommand('virtusSim.stopAll');
          break;
        case 'openPanel':
          vscode.commands.executeCommand('virtusSim.openSimManager');
          break;
      }
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        vscode.commands.executeCommand('virtusSim.openSimManager');
      }
    });
  }

  updateStatus(profiles: LaunchProfile[], activeProfileId: string | null, processes: ProcessInfo[]): void {
    this._profiles = profiles;
    this._activeProfileId = activeProfileId;
    this._processes = processes;
    if (this._view) {
      this._view.webview.html = this._getHtml();
    }
  }

  private _getHtml(): string {
    const runningCount = this._processes.filter((p) => p.status === 'running').length;
    const activeProfile = this._profiles.find((p) => p.id === this._activeProfileId);

    const profileButtons = this._profiles.map((p) => {
      const isActive = p.id === this._activeProfileId;
      const btnClass = isActive ? 'btn btn-stop' : 'btn btn-launch';
      const label = isActive ? 'Stop' : 'Launch';
      return `
        <div class="profile-card" style="border-left: 3px solid ${p.color};">
          <div class="profile-name">${p.label}</div>
          <div class="profile-desc">${p.description.substring(0, 60)}...</div>
          <button class="${btnClass}" onclick="send('${isActive ? 'stopAll' : 'launchProfile'}', '${p.id}')">${label}</button>
        </div>`;
    }).join('');

    const processRows = this._processes.map((p) => {
      const dotColor = p.status === 'running' ? '#4caf50' : p.status === 'error' ? '#f44336' : '#9e9e9e';
      return `<div class="proc-row"><span class="dot" style="background:${dotColor};"></span> ${p.name} <span class="pid">(${p.pid})</span></div>`;
    }).join('');

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
    .header {
      text-align: center;
      padding: 12px 0 6px;
      font-size: 14px;
      font-weight: 700;
      color: var(--vscode-textLink-foreground);
    }
    .header .sub {
      font-size: 10px;
      font-weight: 400;
      color: var(--vscode-descriptionForeground);
    }
    .section {
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    .status-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 12px;
    }
    .status-bar .count {
      font-weight: 600;
      color: ${runningCount > 0 ? '#4caf50' : 'var(--vscode-descriptionForeground)'};
    }
    .profile-card {
      padding: 6px 10px;
      margin-bottom: 6px;
      background: var(--vscode-editor-background);
      border-radius: 4px;
    }
    .profile-name {
      font-weight: 600;
      font-size: 12px;
    }
    .profile-desc {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin: 2px 0 4px;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 4px 8px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      text-align: center;
    }
    .btn-launch {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-launch:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .btn-stop {
      background: #c62828;
      color: #ffffff;
    }
    .btn-stop:hover {
      background: #b71c1c;
    }
    .btn-open {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-open:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .proc-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      padding: 2px 0;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .pid {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
    }
    .active-info {
      padding: 6px 10px;
      background: var(--vscode-editor-background);
      border-radius: 4px;
      margin-bottom: 6px;
      font-size: 11px;
    }
    .active-label {
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }
  </style>
</head>
<body>
  <div class="header">
    Virtus Simulation Manager
    <div class="sub">VirtusCo - Gazebo + ROS 2</div>
  </div>

  <div class="status-bar">
    <span class="count">${runningCount}</span> process${runningCount !== 1 ? 'es' : ''} running
    ${activeProfile ? `| <span class="active-label">${activeProfile.label}</span>` : ''}
  </div>

  ${activeProfile ? `
  <div class="section">
    <div class="section-title">Active Profile</div>
    <div class="active-info">
      <div class="active-label">${activeProfile.label}</div>
      <div style="font-size:10px;color:var(--vscode-descriptionForeground);margin-top:2px;">${activeProfile.steps.length} steps</div>
    </div>
    ${processRows || '<div style="font-size:11px;color:var(--vscode-descriptionForeground);">No processes</div>'}
    <button class="btn btn-stop" style="margin-top:6px;" onclick="send('stopAll')">Stop All</button>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Launch Profiles</div>
    ${profileButtons}
  </div>

  <div class="section">
    <button class="btn btn-open" onclick="send('openPanel')">Open Full Simulation Manager</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function send(type, profileId) {
      vscode.postMessage({ type, profileId });
    }
  </script>
</body>
</html>`;
  }
}
