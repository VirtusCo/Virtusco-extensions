// Copyright 2026 VirtusCo
// WebviewPanel lifecycle manager for Virtus Firmware Builder

import * as vscode from 'vscode';
import { FlowGraph, WebviewMessage } from '../types';
import { generateAll } from '../codegen/index';
import { runWestBuild, runWestFlash, openSerialMonitor } from '../flash/westRunner';
import { getBoardById } from '../project/boardDatabase';

const VIEW_TYPE = 'virtus.firmwareBuilder';

export class FirmwareBuilderPanel {
  public static currentPanel: FirmwareBuilderPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _outputChannel: vscode.OutputChannel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
  ): FirmwareBuilderPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (FirmwareBuilderPanel.currentPanel) {
      FirmwareBuilderPanel.currentPanel._panel.reveal(column);
      return FirmwareBuilderPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      'Virtus Firmware Builder',
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

    FirmwareBuilderPanel.currentPanel = new FirmwareBuilderPanel(
      panel,
      context.extensionUri,
      outputChannel
    );

    return FirmwareBuilderPanel.currentPanel;
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
      (msg: WebviewMessage) => this._handleMessage(msg),
      null,
      this._disposables
    );
  }

  public requestGenerate(): void {
    this._postMessage({ type: 'loadFlow', payload: { nodes: [], edges: [] } });
  }

  public sendDynamicNodes(nodes: unknown[], zephyrVersion: string): void {
    this._panel.webview.postMessage({
      type: 'dynamicNodes',
      payload: { nodes, zephyrVersion },
    });
  }

  public notifyBoardChanged(boardId: string): void {
    const board = getBoardById(boardId);
    this._panel.webview.postMessage({
      type: 'boardChanged',
      payload: {
        boardId,
        supportedNodeTypes: board?.supportedNodeTypes ?? [],
      },
    });
  }

  public dispose(): void {
    FirmwareBuilderPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      d?.dispose();
    }
  }

  private async _handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'generateCode':
        await this._handleGenerate(message.payload);
        break;

      case 'saveFlow':
        await this._handleSaveFlow(message.payload);
        break;

      case 'runBuild':
        await runWestBuild(message.payload);
        this._postMessage({
          type: 'buildStatus',
          payload: { status: 'ok', message: 'Build started in terminal' },
        });
        break;

      case 'flashDevice':
        await runWestFlash(message.payload);
        this._postMessage({
          type: 'flashStatus',
          payload: { status: 'ok', message: 'Flash started in terminal' },
        });
        break;

      case 'openMonitor':
        openSerialMonitor(message.payload);
        break;

      case 'requestLoad':
        await this._handleLoadFlow();
        break;
    }
  }

  private async _handleGenerate(graph: FlowGraph): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this._postMessage({
        type: 'codegenStatus',
        payload: { status: 'error', message: 'No workspace folder open' },
      });
      vscode.window.showErrorMessage('Open a Zephyr project folder first');
      return;
    }

    try {
      const files = await generateAll(graph, workspaceFolder.uri);
      this._outputChannel.appendLine(
        `[codegen] Generated ${files.length} files: ${files.join(', ')}`
      );
      this._postMessage({
        type: 'codegenStatus',
        payload: { status: 'ok', message: `Generated ${files.length} files`, files },
      });
      vscode.window.showInformationMessage(
        `Virtus: Generated ${files.length} firmware files`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._outputChannel.appendLine(`[codegen] Error: ${msg}`);
      this._postMessage({
        type: 'codegenStatus',
        payload: { status: 'error', message: msg },
      });
      vscode.window.showErrorMessage(`Code generation failed: ${msg}`);
    }
  }

  private async _handleSaveFlow(graph: FlowGraph): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const uri = vscode.Uri.joinPath(workspaceFolder.uri, 'firmware.virtusflow');
    const content = JSON.stringify(graph, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    vscode.window.showInformationMessage('Flow saved to firmware.virtusflow');
  }

  private async _handleLoadFlow(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const uri = vscode.Uri.joinPath(workspaceFolder.uri, 'firmware.virtusflow');
    try {
      const data = await vscode.workspace.fs.readFile(uri);
      const graph: FlowGraph = JSON.parse(Buffer.from(data).toString('utf8'));
      this._postMessage({ type: 'loadFlow', payload: graph });
      this._outputChannel.appendLine('[load] Restored flow from firmware.virtusflow');
    } catch {
      // No saved flow — that's fine, start fresh
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
  <title>Virtus Firmware Builder</title>
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
