// Copyright 2026 VirtusCo
// WebviewPanel lifecycle manager for Virtus AI Studio dashboard

import * as vscode from 'vscode';
import {
  WebviewMessage,
  HostMessage,
  GpuState,
  HailoState,
  FineTuneRecommendation,
  TrainingMetric,
  RunRecord,
} from '../types';

const VIEW_TYPE = 'virtus-ai.studio';

export class AIStudioPanel {
  public static currentPanel: AIStudioPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _outputChannel: vscode.OutputChannel;
  private _disposables: vscode.Disposable[] = [];
  private _messageHandler: ((message: WebviewMessage) => void) | null = null;

  /**
   * Creates a new panel or reveals an existing one.
   */
  public static createOrShow(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
  ): AIStudioPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (AIStudioPanel.currentPanel) {
      AIStudioPanel.currentPanel._panel.reveal(column);
      return AIStudioPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      'Virtus AI Studio',
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

    AIStudioPanel.currentPanel = new AIStudioPanel(
      panel,
      context.extensionUri,
      outputChannel
    );

    return AIStudioPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    outputChannel: vscode.OutputChannel
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._outputChannel = outputChannel;

    this._panel.webview.html = this._getHtmlForWebview();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => {
        this._outputChannel.appendLine(
          `[AIStudioPanel] Received: ${msg.type}`
        );
        if (this._messageHandler) {
          this._messageHandler(msg);
        }
      },
      null,
      this._disposables
    );
  }

  // ── Public Message API ────────────────────────────────────────────

  /**
   * Registers a handler for messages coming from the webview.
   */
  public onMessage(handler: (message: WebviewMessage) => void): void {
    this._messageHandler = handler;
  }

  /**
   * Sends a typed HostMessage to the webview.
   */
  public sendMessage(message: HostMessage): void {
    this._postMessage(message);
  }

  /**
   * Sends a GPU state update to the webview.
   */
  public sendGpuUpdate(state: GpuState): void {
    this._postMessage({ type: 'gpuUpdate', state });
  }

  /**
   * Sends a Hailo state update to the webview.
   */
  public sendHailoUpdate(state: HailoState): void {
    this._postMessage({ type: 'hailoUpdate', state });
  }

  /**
   * Sends a VRAM-based fine-tune recommendation to the webview.
   */
  public sendVramRecommendation(recommendation: FineTuneRecommendation): void {
    this._postMessage({ type: 'vramRecommendation', recommendation });
  }

  /**
   * Sends a training metric update to the webview.
   */
  public sendTrainingMetric(metric: TrainingMetric): void {
    this._postMessage({ type: 'trainingMetric', metric });
  }

  /**
   * Notifies the webview that training is complete.
   */
  public sendTrainingDone(runId: string, summary: Record<string, number>): void {
    this._postMessage({ type: 'trainingDone', run_id: runId, summary });
  }

  /**
   * Notifies the webview of a training error.
   */
  public sendTrainingError(runId: string, error: string): void {
    this._postMessage({ type: 'trainingError', run_id: runId, error });
  }

  /**
   * Sends an export progress step to the webview.
   */
  public sendExportStep(runId: string, step: string, progress: number): void {
    this._postMessage({ type: 'exportStep', run_id: runId, step, progress });
  }

  /**
   * Notifies the webview that export is complete.
   */
  public sendExportDone(runId: string, artifactPath: string): void {
    this._postMessage({ type: 'exportDone', run_id: runId, artifact_path: artifactPath });
  }

  /**
   * Sends an inference result to the webview.
   */
  public sendInferenceResult(output: string, tokensPerSecond: number): void {
    this._postMessage({ type: 'inferenceResult', output, tokens_per_second: tokensPerSecond });
  }

  /**
   * Sends deployment progress to the webview.
   */
  public sendDeployProgress(stage: string, progress: number): void {
    this._postMessage({ type: 'deployProgress', stage, progress });
  }

  /**
   * Sends service status to the webview.
   */
  public sendServiceStatus(service: string, active: boolean, uptimeSeconds: number): void {
    this._postMessage({ type: 'serviceStatus', service, active, uptime_seconds: uptimeSeconds });
  }

  /**
   * Sends run history to the webview.
   */
  public sendRunHistory(runs: RunRecord[]): void {
    this._postMessage({ type: 'runHistory', runs });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  public dispose(): void {
    AIStudioPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      d?.dispose();
    }
  }

  // ── Internal ──────────────────────────────────────────────────────

  private _postMessage(message: HostMessage): void {
    if (this._panel.visible) {
      this._panel.webview.postMessage(message);
    }
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
  <title>Virtus AI Studio</title>
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
