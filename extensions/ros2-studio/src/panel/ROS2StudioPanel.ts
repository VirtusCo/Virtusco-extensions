// Copyright 2026 VirtusCo
// WebviewPanel lifecycle manager for Virtus ROS 2 Studio

import * as vscode from 'vscode';
import {
  WebviewMessage,
  HostMessage,
  NodeGraphData,
  FSMState,
  DecodedFrame,
  ROS2Status,
} from '../types';

const VIEW_TYPE = 'virtus-ros2.studio';

export class ROS2StudioPanel {
  public static currentPanel: ROS2StudioPanel | undefined;

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
  ): ROS2StudioPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (ROS2StudioPanel.currentPanel) {
      ROS2StudioPanel.currentPanel._panel.reveal(column);
      return ROS2StudioPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      'Virtus ROS 2 Studio',
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

    ROS2StudioPanel.currentPanel = new ROS2StudioPanel(
      panel,
      context.extensionUri,
      outputChannel
    );

    return ROS2StudioPanel.currentPanel;
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
          `[ROS2StudioPanel] Received: ${msg.type}`
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
   * Sends a topic message to the webview.
   */
  public sendTopicMessage(topic: string, data: unknown): void {
    this._postMessage({ type: 'topicMessage', topic, data });
  }

  /**
   * Sends node graph data to the webview.
   */
  public sendNodeGraph(graph: NodeGraphData): void {
    this._postMessage({ type: 'nodeGraph', graph });
  }

  /**
   * Sends an FSM state update to the webview.
   */
  public sendFsmState(state: FSMState): void {
    this._postMessage({ type: 'fsmState', state });
  }

  /**
   * Sends a decoded bridge frame to the webview.
   */
  public sendBridgeFrame(frame: DecodedFrame): void {
    this._postMessage({ type: 'bridgeFrame', frame });
  }

  /**
   * Sends the ROS 2 connection status to the webview.
   */
  public sendRos2Status(status: ROS2Status): void {
    this._postMessage({ type: 'ros2Status', status });
  }

  /**
   * Sends command execution output to the webview.
   */
  public sendCommandOutput(cmd: string, output: string, exitCode: number): void {
    this._postMessage({ type: 'commandOutput', cmd, output, exitCode });
  }

  /**
   * Sends generated launch file code to the webview.
   */
  public sendLaunchGenerated(code: string): void {
    this._postMessage({ type: 'launchGenerated', code });
  }

  /**
   * Sends launch save confirmation to the webview.
   */
  public sendLaunchSaved(filePath: string): void {
    this._postMessage({ type: 'launchSaved', path: filePath });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  public dispose(): void {
    ROS2StudioPanel.currentPanel = undefined;
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

    // Check if CSS exists (only present when webview imports CSS)
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.css')
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
  <title>Virtus ROS 2 Studio</title>
  <link rel="stylesheet" href="${cssUri}">
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
