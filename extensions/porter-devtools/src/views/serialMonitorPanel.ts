import * as vscode from 'vscode';

import { SerialService } from '../services/serialService';
import { Logger } from '../utils/logger';
import { Settings } from '../config/settings';

/** Messages sent from the webview to the extension host. */
interface WebviewToExtensionMessage {
    readonly type: 'send' | 'clear' | 'changeBaud' | 'changePort';
    readonly data?: string;
    readonly baudRate?: number;
    readonly port?: string;
}

/** Messages sent from the extension host to the webview. */
interface ExtensionToWebviewMessage {
    readonly type: 'data' | 'status' | 'error' | 'portList';
    readonly data?: string;
    readonly connected?: boolean;
    readonly port?: string;
    readonly baudRate?: number;
    readonly message?: string;
    readonly ports?: string[];
}

/**
 * Webview-based serial terminal for ESP32 debugging.
 *
 * Manages a singleton webview panel that displays serial data from an open
 * port and allows users to send commands back to the device.
 */
export class SerialMonitorPanel implements vscode.Disposable {
    static currentPanel?: SerialMonitorPanel;

    private static readonly viewType = 'porterSerialMonitor';

    private readonly panel: vscode.WebviewPanel;
    private readonly disposables: vscode.Disposable[] = [];
    private dataListener?: vscode.Disposable;
    private currentPort?: string;
    private currentBaudRate: number;
    private connected = false;

    /**
     * Creates or reveals the singleton serial monitor panel.
     */
    static createOrShow(
        extensionUri: vscode.Uri,
        serialService: SerialService,
        logger: Logger,
    ): SerialMonitorPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SerialMonitorPanel.currentPanel) {
            SerialMonitorPanel.currentPanel.panel.reveal(column);
            return SerialMonitorPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            SerialMonitorPanel.viewType,
            'Porter Serial Monitor',
            column ?? vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri],
            },
        );

        SerialMonitorPanel.currentPanel = new SerialMonitorPanel(
            panel,
            extensionUri,
            serialService,
            logger,
        );

        return SerialMonitorPanel.currentPanel;
    }

    private constructor(
        panel: vscode.WebviewPanel,
        _extensionUri: vscode.Uri,
        private readonly serialService: SerialService,
        private readonly logger: Logger,
    ) {
        this.panel = panel;
        this.currentBaudRate = Settings.serial.baudRate;

        this.panel.webview.html = this._getHtmlForWebview(this.panel.webview);

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            (message: WebviewToExtensionMessage) => this.handleWebviewMessage(message),
            null,
            this.disposables,
        );

        this.refreshPortList().catch((err: unknown) => {
            this.logger.warn('Failed to refresh port list on panel creation', String(err));
        });
    }

    /**
     * Opens a serial port and pipes incoming data to the webview.
     */
    async openPort(portPath: string, baudRate: number): Promise<void> {
        this.closePort();

        try {
            this.logger.info(`Serial Monitor: opening ${portPath} at ${baudRate} baud`);
            await this.serialService.openPort(portPath, baudRate);

            this.currentPort = portPath;
            this.currentBaudRate = baudRate;
            this.connected = true;

            this.dataListener = this.serialService.onData(portPath, (data: Buffer) => {
                this.postMessage({ type: 'data', data: data.toString('utf-8') });
            });
            this.disposables.push(this.dataListener);

            this.sendStatus();
            this.logger.info(`Serial Monitor: connected to ${portPath}`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Serial Monitor: failed to open ${portPath}`, message);
            this.postMessage({ type: 'error', message: `Failed to open port: ${message}` });
            this.connected = false;
            this.sendStatus();
        }
    }

    /**
     * Closes the currently open serial port.
     */
    closePort(): void {
        if (this.dataListener) {
            this.dataListener.dispose();
            this.dataListener = undefined;
        }

        if (this.currentPort && this.serialService.isOpen(this.currentPort)) {
            const portPath = this.currentPort;
            this.serialService.closePort(portPath).catch((err: unknown) => {
                this.logger.warn(`Serial Monitor: error closing port ${portPath}`, String(err));
            });
            this.logger.info(`Serial Monitor: closed port ${portPath}`);
        }

        this.connected = false;
        this.currentPort = undefined;
        this.sendStatus();
    }

    /**
     * Disposes the panel and all associated resources.
     */
    dispose(): void {
        SerialMonitorPanel.currentPanel = undefined;

        this.closePort();

        this.panel.dispose();

        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables.length = 0;
    }

    // ── Private helpers ────────────────────────────────────────────────

    private async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
        switch (message.type) {
            case 'send': {
                if (!this.currentPort || !this.connected) {
                    this.postMessage({ type: 'error', message: 'Not connected to any port.' });
                    return;
                }
                try {
                    await this.serialService.write(this.currentPort, message.data ?? '');
                } catch (err: unknown) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    this.postMessage({ type: 'error', message: `Send failed: ${errMsg}` });
                }
                break;
            }

            case 'clear':
                // The webview handles clearing its own terminal output.
                break;

            case 'changeBaud': {
                const newBaud = message.baudRate;
                if (!newBaud) {
                    return;
                }
                this.logger.info(`Serial Monitor: changing baud rate to ${newBaud}`);
                if (this.currentPort && this.connected) {
                    const port = this.currentPort;
                    this.closePort();
                    await this.openPort(port, newBaud);
                } else {
                    this.currentBaudRate = newBaud;
                    this.sendStatus();
                }
                break;
            }

            case 'changePort': {
                const newPort = message.port;
                if (!newPort) {
                    return;
                }
                this.logger.info(`Serial Monitor: switching to port ${newPort}`);
                this.closePort();
                await this.openPort(newPort, this.currentBaudRate);
                break;
            }

            default:
                this.logger.warn(`Serial Monitor: unknown message type`);
        }
    }

    private postMessage(message: ExtensionToWebviewMessage): void {
        this.panel.webview.postMessage(message).then(
            undefined,
            (err: unknown) => {
                this.logger.warn('Failed to post message to webview', String(err));
            },
        );
    }

    private sendStatus(): void {
        this.postMessage({
            type: 'status',
            connected: this.connected,
            port: this.currentPort ?? '',
            baudRate: this.currentBaudRate,
        });
    }

    private async refreshPortList(): Promise<void> {
        try {
            const ports = await this.serialService.listPorts();
            const portPaths = ports.map((p) => p.path);
            this.postMessage({ type: 'portList' as ExtensionToWebviewMessage['type'], ports: portPaths });
        } catch (err: unknown) {
            this.logger.warn('Failed to list ports for Serial Monitor', String(err));
        }
    }

    /**
     * Returns the full HTML content for the serial monitor webview.
     */
    _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <title>Porter Serial Monitor</title>
    <style nonce="${nonce}">
        :root {
            --bg-primary: #1e1e1e;
            --bg-secondary: #252526;
            --bg-tertiary: #2d2d2d;
            --bg-input: #3c3c3c;
            --border: #3e3e42;
            --text-primary: #cccccc;
            --text-secondary: #969696;
            --text-muted: #6a6a6a;
            --accent: #0e639c;
            --accent-hover: #1177bb;
            --success: #22c55e;
            --error: #ef4444;
            --warning: #f59e0b;
            --font-mono: 'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace;
            --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: var(--bg-primary);
            color: var(--text-primary);
            font-family: var(--font-ui);
            font-size: 13px;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* ── Toolbar ─────────────────────────────────── */
        .toolbar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
            flex-shrink: 0;
        }

        .toolbar label {
            color: var(--text-secondary);
            font-size: 12px;
            white-space: nowrap;
        }

        .toolbar select,
        .toolbar button {
            background: var(--bg-input);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: 3px;
            padding: 3px 8px;
            font-size: 12px;
            font-family: var(--font-ui);
            cursor: pointer;
            outline: none;
        }

        .toolbar select:hover,
        .toolbar button:hover {
            border-color: var(--accent);
        }

        .toolbar select:focus,
        .toolbar button:focus {
            border-color: var(--accent);
            outline: 1px solid var(--accent);
            outline-offset: -1px;
        }

        .toolbar button {
            padding: 3px 12px;
        }

        .toolbar button:active {
            background: var(--accent);
        }

        .toolbar .spacer {
            flex: 1;
        }

        .toolbar .toggle-label {
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
        }

        .toolbar input[type="checkbox"] {
            accent-color: var(--accent);
            cursor: pointer;
        }

        /* ── Terminal output ─────────────────────────── */
        .terminal-container {
            flex: 1;
            overflow: hidden;
            position: relative;
        }

        #terminal {
            width: 100%;
            height: 100%;
            overflow-y: auto;
            overflow-x: auto;
            padding: 8px 12px;
            font-family: var(--font-mono);
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-break: break-all;
            background: var(--bg-primary);
            color: #d4d4d4;
        }

        #terminal::-webkit-scrollbar {
            width: 10px;
        }

        #terminal::-webkit-scrollbar-track {
            background: var(--bg-primary);
        }

        #terminal::-webkit-scrollbar-thumb {
            background: var(--bg-tertiary);
            border-radius: 5px;
        }

        #terminal::-webkit-scrollbar-thumb:hover {
            background: var(--border);
        }

        /* ── Input area ──────────────────────────────── */
        .input-area {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            background: var(--bg-secondary);
            border-top: 1px solid var(--border);
            flex-shrink: 0;
        }

        .input-area input[type="text"] {
            flex: 1;
            background: var(--bg-input);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: 3px;
            padding: 5px 10px;
            font-family: var(--font-mono);
            font-size: 13px;
            outline: none;
        }

        .input-area input[type="text"]:focus {
            border-color: var(--accent);
            outline: 1px solid var(--accent);
            outline-offset: -1px;
        }

        .input-area input[type="text"]::placeholder {
            color: var(--text-muted);
        }

        .input-area button {
            background: var(--accent);
            color: #ffffff;
            border: none;
            border-radius: 3px;
            padding: 5px 16px;
            font-size: 12px;
            font-family: var(--font-ui);
            cursor: pointer;
            white-space: nowrap;
        }

        .input-area button:hover {
            background: var(--accent-hover);
        }

        .input-area button:active {
            opacity: 0.8;
        }

        /* ── Status bar ──────────────────────────────── */
        .status-bar {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 3px 10px;
            background: var(--bg-tertiary);
            border-top: 1px solid var(--border);
            font-size: 11px;
            color: var(--text-secondary);
            flex-shrink: 0;
        }

        .status-bar .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 4px;
        }

        .status-bar .status-indicator.connected {
            background: var(--success);
            box-shadow: 0 0 4px var(--success);
        }

        .status-bar .status-indicator.disconnected {
            background: var(--error);
        }

        .status-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .error-text {
            color: var(--error);
        }
    </style>
</head>
<body>
    <!-- Toolbar -->
    <div class="toolbar">
        <label for="portSelect">Port:</label>
        <select id="portSelect">
            <option value="">-- Select Port --</option>
        </select>

        <label for="baudSelect">Baud:</label>
        <select id="baudSelect">
            <option value="9600">9600</option>
            <option value="19200">19200</option>
            <option value="38400">38400</option>
            <option value="57600">57600</option>
            <option value="115200" selected>115200</option>
            <option value="230400">230400</option>
            <option value="460800">460800</option>
        </select>

        <div class="spacer"></div>

        <button id="clearBtn" title="Clear terminal output">Clear</button>

        <label class="toggle-label" title="Toggle auto-scroll">
            <input type="checkbox" id="autoScrollToggle" checked>
            Auto-scroll
        </label>
    </div>

    <!-- Terminal -->
    <div class="terminal-container">
        <div id="terminal"></div>
    </div>

    <!-- Input -->
    <div class="input-area">
        <input type="text" id="commandInput" placeholder="Type a command and press Enter..." autocomplete="off" spellcheck="false">
        <button id="sendBtn">Send</button>
    </div>

    <!-- Status bar -->
    <div class="status-bar">
        <div class="status-item">
            <span class="status-indicator disconnected" id="statusDot"></span>
            <span id="statusText">Disconnected</span>
        </div>
        <div class="status-item" id="portInfo">Port: --</div>
        <div class="status-item" id="baudInfo">Baud: --</div>
    </div>

    <script nonce="${nonce}">
        (function() {
            const vscode = acquireVsCodeApi();

            const terminal = document.getElementById('terminal');
            const commandInput = document.getElementById('commandInput');
            const sendBtn = document.getElementById('sendBtn');
            const clearBtn = document.getElementById('clearBtn');
            const portSelect = document.getElementById('portSelect');
            const baudSelect = document.getElementById('baudSelect');
            const autoScrollToggle = document.getElementById('autoScrollToggle');
            const statusDot = document.getElementById('statusDot');
            const statusText = document.getElementById('statusText');
            const portInfo = document.getElementById('portInfo');
            const baudInfo = document.getElementById('baudInfo');

            const MAX_LINES = 10000;
            let lineCount = 0;

            function appendOutput(text) {
                const fragment = document.createDocumentFragment();
                const span = document.createElement('span');
                span.textContent = text;
                fragment.appendChild(span);
                terminal.appendChild(fragment);

                lineCount += (text.match(/\\n/g) || []).length;

                // Trim excess lines
                while (lineCount > MAX_LINES && terminal.firstChild) {
                    const firstText = terminal.firstChild.textContent || '';
                    const firstLines = (firstText.match(/\\n/g) || []).length;
                    terminal.removeChild(terminal.firstChild);
                    lineCount -= firstLines;
                }

                if (autoScrollToggle.checked) {
                    terminal.scrollTop = terminal.scrollHeight;
                }
            }

            function clearTerminal() {
                terminal.textContent = '';
                lineCount = 0;
            }

            function sendCommand() {
                const text = commandInput.value;
                if (text.length === 0) {
                    return;
                }
                vscode.postMessage({ type: 'send', data: text + '\\n' });
                commandInput.value = '';
                commandInput.focus();
            }

            function updateStatus(connected, port, baudRate) {
                statusDot.className = 'status-indicator ' + (connected ? 'connected' : 'disconnected');
                statusText.textContent = connected ? 'Connected' : 'Disconnected';
                portInfo.textContent = 'Port: ' + (port || '--');
                baudInfo.textContent = 'Baud: ' + (baudRate || '--');

                if (port && portSelect.querySelector('option[value="' + port + '"]')) {
                    portSelect.value = port;
                }
                if (baudRate) {
                    baudSelect.value = String(baudRate);
                }
            }

            // ── Event listeners ─────────────────────────

            sendBtn.addEventListener('click', sendCommand);

            commandInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendCommand();
                }
            });

            clearBtn.addEventListener('click', function() {
                clearTerminal();
                vscode.postMessage({ type: 'clear' });
            });

            portSelect.addEventListener('change', function() {
                const port = portSelect.value;
                if (port) {
                    vscode.postMessage({ type: 'changePort', port: port });
                }
            });

            baudSelect.addEventListener('change', function() {
                const baudRate = parseInt(baudSelect.value, 10);
                if (!isNaN(baudRate)) {
                    vscode.postMessage({ type: 'changeBaud', baudRate: baudRate });
                }
            });

            // ── Messages from extension host ────────────

            window.addEventListener('message', function(event) {
                const msg = event.data;

                switch (msg.type) {
                    case 'data':
                        appendOutput(msg.data || '');
                        break;

                    case 'status':
                        updateStatus(msg.connected, msg.port, msg.baudRate);
                        break;

                    case 'error':
                        appendOutput('[ERROR] ' + (msg.message || 'Unknown error') + '\\n');
                        break;

                    case 'portList': {
                        const ports = msg.ports || [];
                        // Preserve current selection
                        const current = portSelect.value;
                        // Remove all options except the placeholder
                        while (portSelect.options.length > 1) {
                            portSelect.remove(1);
                        }
                        for (const p of ports) {
                            const opt = document.createElement('option');
                            opt.value = p;
                            opt.textContent = p;
                            portSelect.appendChild(opt);
                        }
                        if (current && portSelect.querySelector('option[value="' + current + '"]')) {
                            portSelect.value = current;
                        }
                        break;
                    }
                }
            });

            // Focus input on load
            commandInput.focus();
        })();
    </script>
</body>
</html>`;
    }
}

/** Generates a random nonce for Content Security Policy. */
function getNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values: string[] = [];
    for (let i = 0; i < 32; i++) {
        values.push(possible.charAt(Math.floor(Math.random() * possible.length)));
    }
    return values.join('');
}
