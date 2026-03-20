// Copyright 2026 VirtusCo
// SSH connection manager for Raspberry Pi targets

import * as fs from 'fs';
import { NodeSSH } from 'node-ssh';
import { SSHConfig, RpiInfo } from '../types';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  rpiInfo?: RpiInfo;
}

export class RPiConnector {
  private ssh: NodeSSH;
  private connected: boolean = false;

  constructor() {
    this.ssh = new NodeSSH();
  }

  /**
   * Establishes an SSH connection to the Raspberry Pi using the given config.
   */
  async connect(config: SSHConfig): Promise<void> {
    try {
      const privateKey = await fs.promises.readFile(config.privateKeyPath, 'utf8');

      await this.ssh.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey,
        readyTimeout: 10_000,
        keepaliveInterval: 15_000,
      });

      this.connected = true;
    } catch (err) {
      this.connected = false;
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`SSH connection to ${config.host}:${config.port} failed: ${message}`);
    }
  }

  /**
   * Disconnects the SSH session.
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      this.ssh.dispose();
      this.connected = false;
    }
  }

  /**
   * Returns whether an SSH session is currently active.
   */
  isConnected(): boolean {
    return this.connected && this.ssh.isConnected();
  }

  /**
   * Executes a command on the remote RPi and returns stdout/stderr.
   */
  async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    if (!this.isConnected()) {
      throw new Error('Not connected to RPi — call connect() first');
    }

    const result = await this.ssh.execCommand(command, {
      execOptions: { pty: false },
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  /**
   * Uploads a local file to the remote RPi.
   * Optionally reports upload progress as a percentage.
   */
  async putFile(
    localPath: string,
    remotePath: string,
    onProgress?: (pct: number) => void
  ): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to RPi — call connect() first');
    }

    // Get file size for progress reporting
    const stat = await fs.promises.stat(localPath);
    const totalBytes = stat.size;
    let transferred = 0;

    await this.ssh.putFile(localPath, remotePath, undefined, {
      step: (totalTransferred: number, _chunk: number, total: number) => {
        transferred = totalTransferred;
        if (onProgress && total > 0) {
          onProgress(Math.round((transferred / total) * 100));
        } else if (onProgress && totalBytes > 0) {
          onProgress(Math.round((transferred / totalBytes) * 100));
        }
      },
    });

    if (onProgress) {
      onProgress(100);
    }
  }

  /**
   * Tests the SSH connection and gathers basic RPi system information.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.isConnected()) {
      return { success: false, message: 'Not connected' };
    }

    try {
      // Gather system info via standard Linux commands
      const [hostnameResult, osResult, tempResult, memResult] = await Promise.all([
        this.exec('hostname'),
        this.exec('cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\''),
        this.exec('cat /sys/class/thermal/thermal_zone0/temp'),
        this.exec('cat /proc/meminfo | grep -E "MemTotal|MemAvailable"'),
      ]);

      const hostname = hostnameResult.stdout.trim();
      const os = osResult.stdout.trim();

      // CPU temp is in millidegrees
      const cpuTempRaw = parseInt(tempResult.stdout.trim(), 10);
      const cpuTemp = isNaN(cpuTempRaw) ? 0 : cpuTempRaw / 1000;

      // Parse memory info (in kB)
      const memLines = memResult.stdout.trim().split('\n');
      let memTotal = 0;
      let memAvailable = 0;

      for (const line of memLines) {
        const match = line.match(/(\w+):\s+(\d+)/);
        if (match) {
          const value = parseInt(match[2], 10);
          if (match[1] === 'MemTotal') {
            memTotal = value;
          } else if (match[1] === 'MemAvailable') {
            memAvailable = value;
          }
        }
      }

      return {
        success: true,
        message: `Connected to ${hostname}`,
        rpiInfo: {
          hostname,
          os,
          cpu_temp: cpuTemp,
          mem_total: memTotal,
          mem_available: memAvailable,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Connection test failed: ${message}`,
      };
    }
  }
}
