// Copyright 2026 VirtusCo
// Manages the FastAPI backend server lifecycle for AI Studio

import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as http from 'http';
import * as vscode from 'vscode';
import { PlatformUtils, Platform } from '../platform/PlatformUtils';
import { VenvManager } from './VenvManager';

const DEFAULT_PORT = 47821;
const HEALTH_POLL_INTERVAL_MS = 500;
const HEALTH_TIMEOUT_MS = 30_000;
const MAX_RESTARTS = 3;

interface SSEEvent {
  event: string;
  data: string;
}

export class PythonBridge {
  private process: ChildProcess | null = null;
  private readonly port: number = DEFAULT_PORT;
  private restartCount: number = 0;
  private readonly maxRestarts: number = MAX_RESTARTS;
  private readonly outputChannel: vscode.OutputChannel;
  private stopping: boolean = false;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Starts the FastAPI backend server.
   * Ensures the base venv is ready, spawns python/server.py, and waits for /health.
   */
  async start(): Promise<void> {
    if (this.process) {
      this.outputChannel.appendLine('[PythonBridge] Server already running');
      return;
    }

    this.stopping = false;

    // Ensure the base venv exists
    const extensionRoot = path.resolve(__dirname, '..', '..');
    const requirementsFile = path.join(extensionRoot, 'python', 'requirements.txt');
    await VenvManager.ensureVenv('base', requirementsFile);

    const pythonExe = VenvManager.pythonExe('base');
    const serverScript = path.join(extensionRoot, 'python', 'server.py');
    const spawnOpts = PlatformUtils.spawnOpts(extensionRoot);

    this.outputChannel.appendLine(
      `[PythonBridge] Starting server: ${pythonExe} ${serverScript} --port ${this.port}`
    );

    this.process = spawn(
      pythonExe,
      [serverScript, '--port', String(this.port)],
      { ...spawnOpts, stdio: 'pipe' }
    );

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.outputChannel.appendLine(`[server:stdout] ${chunk.toString().trimEnd()}`);
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      this.outputChannel.appendLine(`[server:stderr] ${chunk.toString().trimEnd()}`);
    });

    this.process.on('exit', (code, signal) => {
      this.outputChannel.appendLine(
        `[PythonBridge] Server exited: code=${code}, signal=${signal}`
      );
      this.process = null;

      if (!this.stopping) {
        this.onCrash();
      }
    });

    this.process.on('error', (err) => {
      this.outputChannel.appendLine(`[PythonBridge] Spawn error: ${err.message}`);
      this.process = null;
    });

    // Wait for the server to become healthy
    const healthUrl = `http://127.0.0.1:${this.port}/health`;
    await this.waitForHealthy(healthUrl, HEALTH_TIMEOUT_MS);
    this.outputChannel.appendLine('[PythonBridge] Server is healthy');
    this.restartCount = 0;
  }

  /**
   * Gracefully stops the server process.
   * Sends SIGTERM on Unix, SIGINT on Windows (taskkill is unreliable with SIGTERM).
   */
  async stop(): Promise<void> {
    this.stopping = true;

    if (!this.process) {
      return;
    }

    const proc = this.process;
    this.process = null;

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve();
      }, 5_000);

      proc.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      if (Platform.isWindows) {
        // Windows: SIGINT is more reliably caught by Python
        proc.kill('SIGINT');
      } else {
        proc.kill('SIGTERM');
      }
    });
  }

  /**
   * Returns whether the server process is currently running.
   */
  isRunning(): boolean {
    return this.process !== null;
  }

  /**
   * Makes an HTTP request to the backend server.
   */
  async fetch<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `http://127.0.0.1:${this.port}${endpoint}`;
    const bodyStr = body ? JSON.stringify(body) : undefined;

    return new Promise<T>((resolve, reject) => {
      const urlObj = new URL(url);

      const options: http.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        },
      };

      const req = http.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
            return;
          }
          try {
            resolve(JSON.parse(raw) as T);
          } catch {
            reject(new Error(`Invalid JSON response from ${endpoint}: ${raw}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Request to ${endpoint} failed: ${err.message}`));
      });

      if (bodyStr) {
        req.write(bodyStr);
      }
      req.end();
    });
  }

  /**
   * Starts a job via POST, then streams SSE events from /stream/{job_id}.
   * Calls onEvent for each parsed SSE event.
   */
  async streamSSE(
    endpoint: string,
    body: Record<string, unknown>,
    onEvent: (event: SSEEvent) => void
  ): Promise<void> {
    // POST to start the job
    const startResult = await this.fetch<{ job_id: string }>(endpoint, 'POST', body);
    const jobId = startResult.job_id;

    // GET /stream/{job_id} for SSE
    const streamUrl = `http://127.0.0.1:${this.port}/stream/${jobId}`;

    return new Promise<void>((resolve, reject) => {
      const urlObj = new URL(streamUrl);

      const req = http.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname,
          method: 'GET',
          headers: { Accept: 'text/event-stream' },
        },
        (res) => {
          let buffer = '';
          let currentEvent = '';
          let currentData = '';

          res.on('data', (chunk: Buffer) => {
            buffer += chunk.toString('utf8');
            const lines = buffer.split('\n');
            // Keep the last potentially incomplete line
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                currentData = line.slice(5).trim();
              } else if (line.trim() === '' && currentData) {
                onEvent({ event: currentEvent || 'message', data: currentData });
                currentEvent = '';
                currentData = '';
              }
            }
          });

          res.on('end', () => {
            // Flush any remaining event
            if (currentData) {
              onEvent({ event: currentEvent || 'message', data: currentData });
            }
            resolve();
          });

          res.on('error', (err) => {
            reject(new Error(`SSE stream error: ${err.message}`));
          });
        }
      );

      req.on('error', (err) => {
        reject(new Error(`SSE connection failed: ${err.message}`));
      });

      req.end();
    });
  }

  /**
   * Polls the /health endpoint until it returns 200 or the timeout elapses.
   */
  private waitForHealthy(url: string, timeout: number): Promise<void> {
    const startTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      const poll = (): void => {
        if (Date.now() - startTime > timeout) {
          reject(
            new Error(`Server failed to become healthy within ${timeout}ms`)
          );
          return;
        }

        const urlObj = new URL(url);
        const req = http.request(
          {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: 'GET',
            timeout: 2_000,
          },
          (res) => {
            // Consume the response body
            res.resume();
            if (res.statusCode === 200) {
              resolve();
            } else {
              setTimeout(poll, HEALTH_POLL_INTERVAL_MS);
            }
          }
        );

        req.on('error', () => {
          setTimeout(poll, HEALTH_POLL_INTERVAL_MS);
        });

        req.on('timeout', () => {
          req.destroy();
          setTimeout(poll, HEALTH_POLL_INTERVAL_MS);
        });

        req.end();
      };

      poll();
    });
  }

  /**
   * Handles unexpected server crashes with automatic restart.
   */
  private onCrash(): void {
    if (this.restartCount >= this.maxRestarts) {
      this.outputChannel.appendLine(
        `[PythonBridge] Server crashed ${this.restartCount} times — giving up`
      );
      vscode.window.showErrorMessage(
        `Virtus AI: Backend server crashed ${this.restartCount} times. Check the output panel for details.`
      );
      return;
    }

    this.restartCount++;
    this.outputChannel.appendLine(
      `[PythonBridge] Auto-restarting (attempt ${this.restartCount}/${this.maxRestarts})`
    );

    // Delay restart slightly to avoid tight loops
    setTimeout(() => {
      this.start().catch((err) => {
        this.outputChannel.appendLine(
          `[PythonBridge] Restart failed: ${err instanceof Error ? err.message : String(err)}`
        );
      });
    }, 2_000);
  }
}
