// Copyright 2026 VirtusCo
// Dashboard sidebar webview provider — quick-access overview + open studio button

import * as vscode from 'vscode';
import { GpuState, HailoState, FineTuneRecommendation } from '../types';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'virtus-ai.dashboard';
  private _view?: vscode.WebviewView;
  private _gpuState: GpuState | null = null;
  private _hailoState: HailoState | null = null;
  private _recommendation: FineTuneRecommendation | null = null;

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

    // Auto-open the full studio panel when sidebar is first shown
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        vscode.commands.executeCommand('virtus-ai.openStudio');
      }
    });

    // Also open on first resolve
    vscode.commands.executeCommand('virtus-ai.openStudio');

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'openStudio':
          vscode.commands.executeCommand('virtus-ai.openStudio');
          break;
        case 'probeGpu':
          vscode.commands.executeCommand('virtus-ai.probeGpu');
          break;
        case 'connectRpi':
          vscode.commands.executeCommand('virtus-ai.connectRpi');
          break;
        case 'refresh':
          vscode.commands.executeCommand('virtus-ai.refreshHardware');
          break;
      }
    });
  }

  updateGpu(state: GpuState): void {
    this._gpuState = state;
    this._updateWebview();
  }

  updateHailo(state: HailoState): void {
    this._hailoState = state;
    this._updateWebview();
  }

  updateRecommendation(rec: FineTuneRecommendation): void {
    this._recommendation = rec;
    this._updateWebview();
  }

  private _updateWebview(): void {
    if (this._view) {
      this._view.webview.html = this._getHtml();
    }
  }

  private _getHtml(): string {
    const gpu = this._gpuState;
    const rec = this._recommendation;

    const vramPct = gpu ? Math.round((gpu.vram_used_mb / gpu.vram_total_mb) * 100) : 0;
    const vramBarColor = vramPct > 85 ? '#f44336' : vramPct > 60 ? '#ff9800' : '#4caf50';

    const methodBadge: Record<string, string> = {
      full: 'background:#4caf50',
      lora: 'background:#2196f3',
      qlora: 'background:#ff9800',
    };

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
    .bar-outer { height: 6px; background: var(--vscode-editor-background); border-radius: 3px; margin: 4px 0; overflow: hidden; }
    .bar-inner { height: 100%; border-radius: 3px; transition: width 0.3s; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; color: #fff; }
    .logo { text-align: center; padding: 12px 0 4px; font-size: 14px; font-weight: 700; color: var(--vscode-textLink-foreground); }
    .logo .sub { font-size: 10px; font-weight: 400; color: var(--vscode-descriptionForeground); }
    .warning { padding: 6px 10px; background: #ff980020; border-left: 3px solid #ff9800; border-radius: 2px; font-size: 11px; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="logo">
    Virtus AI Studio
    <div class="sub">MLOps Workbench</div>
  </div>

  <div class="section">
    <button class="btn btn-primary" onclick="send('openStudio')">Open Full Studio</button>
  </div>

  ${gpu ? `
  <div class="section">
    <div class="title">GPU</div>
    <div class="stat"><span class="label">Model</span><span class="value">${gpu.name.replace('NVIDIA ', '').replace('GeForce ', '')}</span></div>
    <div class="stat"><span class="label">VRAM</span><span class="value">${gpu.vram_used_mb} / ${gpu.vram_total_mb} MB</span></div>
    <div class="bar-outer"><div class="bar-inner" style="width:${vramPct}%; background:${vramBarColor}"></div></div>
    <div class="stat"><span class="label">Utilization</span><span class="value">${gpu.gpu_util_pct}%</span></div>
    <div class="stat"><span class="label">Temperature</span><span class="value">${gpu.temperature_c}°C</span></div>
    <div class="stat"><span class="label">Power</span><span class="value">${gpu.power_draw_w}W${gpu.power_limit_w > 0 ? ' / ' + gpu.power_limit_w + 'W' : ''}</span></div>
    ${gpu.is_throttled ? '<div class="warning">GPU is throttling — power limit reached</div>' : ''}
  </div>
  ` : `
  <div class="section">
    <div class="title">GPU</div>
    <div style="color:var(--vscode-descriptionForeground)">Detecting...</div>
    <button class="btn" onclick="send('probeGpu')">Probe GPU</button>
  </div>
  `}

  ${rec ? `
  <div class="section">
    <div class="title">VRAM Advisor</div>
    <div style="margin-bottom: 4px">
      <span class="badge" style="${methodBadge[rec.method] || 'background:#888'}">${rec.method.toUpperCase()}</span>
      ${rec.dtype ? `<span class="badge" style="background:#555; margin-left: 3px">${rec.dtype}</span>` : ''}
      ${rec.lora_r ? `<span class="badge" style="background:#555; margin-left: 3px">r=${rec.lora_r}</span>` : ''}
    </div>
    <div style="font-size:11px; color:var(--vscode-descriptionForeground)">${rec.reason}</div>
  </div>
  ` : ''}

  <div class="section">
    <div class="title">Quick Actions</div>
    <button class="btn" onclick="send('probeGpu')">Refresh GPU</button>
    <button class="btn" onclick="send('connectRpi')">Connect RPi</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function send(type) { vscode.postMessage({ type }); }
  </script>
</body>
</html>`;
  }
}
