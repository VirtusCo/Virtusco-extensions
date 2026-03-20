// Copyright 2026 VirtusCo
// RPi deployer — deploys AI models to Raspberry Pi via SSH

import * as vscode from 'vscode';
import { RPiConnector } from '../hardware/RPiConnector';

// ── Runtime Mode ────────────────────────────────────────────────────

export type RuntimeMode = 'vision_priority' | 'llm_priority' | 'balanced';

// ── Service Status ──────────────────────────────────────────────────

export interface ServiceStatus {
  active: boolean;
  uptime: string;
}

// ── RPi Deployer Class ──────────────────────────────────────────────

export class RPiDeployer {
  private readonly connector: RPiConnector;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(connector: RPiConnector, outputChannel: vscode.OutputChannel) {
    this.connector = connector;
    this.outputChannel = outputChannel;
  }

  /**
   * Deploys a Hailo HEF vision model to the RPi.
   * Uploads the file via SCP and restarts the vision service.
   */
  async deployVisionHEF(
    localPath: string,
    remotePath: string,
    onProgress?: (pct: number) => void
  ): Promise<void> {
    this.outputChannel.appendLine(
      `[RPiDeployer] Deploying vision HEF: ${localPath} -> ${remotePath}`
    );

    if (!this.connector.isConnected()) {
      throw new Error('Not connected to RPi — connect first');
    }

    // Ensure remote directory exists
    const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
    await this.connector.exec(`mkdir -p "${remoteDir}"`);

    // Upload the file
    this.outputChannel.appendLine('[RPiDeployer] Uploading vision HEF...');
    await this.connector.putFile(localPath, remotePath, onProgress);

    // Restart the vision service
    this.outputChannel.appendLine('[RPiDeployer] Restarting virtus-vision service...');
    const restartResult = await this.connector.exec(
      'sudo systemctl restart virtus-vision.service'
    );

    if (restartResult.stderr && restartResult.stderr.includes('Failed')) {
      throw new Error(`Failed to restart virtus-vision: ${restartResult.stderr}`);
    }

    // Verify the service started
    const statusResult = await this.connector.exec(
      'systemctl is-active virtus-vision.service'
    );

    const isActive = statusResult.stdout.trim() === 'active';
    this.outputChannel.appendLine(
      `[RPiDeployer] virtus-vision service: ${isActive ? 'active' : 'inactive'}`
    );

    if (!isActive) {
      this.outputChannel.appendLine(
        '[RPiDeployer] Warning: virtus-vision service did not start. ' +
        'Check systemctl status on the RPi for details.'
      );
    }
  }

  /**
   * Deploys a GGUF LLM model to the RPi.
   * Uses SCP with progress tracking (these files are typically 800MB+).
   * Restarts the LLM service after upload.
   */
  async deployGGUF(
    localPath: string,
    remotePath: string,
    onProgress?: (pct: number) => void
  ): Promise<void> {
    this.outputChannel.appendLine(
      `[RPiDeployer] Deploying GGUF: ${localPath} -> ${remotePath}`
    );

    if (!this.connector.isConnected()) {
      throw new Error('Not connected to RPi — connect first');
    }

    // Ensure remote directory exists
    const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
    await this.connector.exec(`mkdir -p "${remoteDir}"`);

    // Upload the large GGUF file with progress
    this.outputChannel.appendLine('[RPiDeployer] Uploading GGUF model (this may take several minutes)...');
    await this.connector.putFile(localPath, remotePath, onProgress);

    // Restart the LLM service
    this.outputChannel.appendLine('[RPiDeployer] Restarting virtus-llm service...');
    const restartResult = await this.connector.exec(
      'sudo systemctl restart virtus-llm.service'
    );

    if (restartResult.stderr && restartResult.stderr.includes('Failed')) {
      throw new Error(`Failed to restart virtus-llm: ${restartResult.stderr}`);
    }

    const statusResult = await this.connector.exec(
      'systemctl is-active virtus-llm.service'
    );

    const isActive = statusResult.stdout.trim() === 'active';
    this.outputChannel.appendLine(
      `[RPiDeployer] virtus-llm service: ${isActive ? 'active' : 'inactive'}`
    );
  }

  /**
   * Deploys a Hailo HEF LLM model for hailo-ollama.
   * Uploads the file and runs hailo-ollama pull to register it.
   */
  async deployHailoLLM(
    localPath: string,
    remotePath: string,
    onProgress?: (pct: number) => void
  ): Promise<void> {
    this.outputChannel.appendLine(
      `[RPiDeployer] Deploying Hailo LLM HEF: ${localPath} -> ${remotePath}`
    );

    if (!this.connector.isConnected()) {
      throw new Error('Not connected to RPi — connect first');
    }

    const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
    await this.connector.exec(`mkdir -p "${remoteDir}"`);

    // Upload the HEF file
    this.outputChannel.appendLine('[RPiDeployer] Uploading Hailo LLM HEF...');
    await this.connector.putFile(localPath, remotePath, onProgress);

    // Register with hailo-ollama if available
    this.outputChannel.appendLine('[RPiDeployer] Registering model with hailo-ollama...');
    const pullResult = await this.connector.exec(
      `hailo-ollama pull "${remotePath}" 2>&1 || echo "hailo-ollama not available"`
    );

    this.outputChannel.appendLine(`[RPiDeployer] hailo-ollama: ${pullResult.stdout.trim()}`);

    // Restart the LLM service
    await this.connector.exec('sudo systemctl restart virtus-llm.service');

    this.outputChannel.appendLine('[RPiDeployer] Hailo LLM deployment complete');
  }

  /**
   * Gets the status of all Virtus services on the RPi.
   * Returns a map of service name to active/uptime status.
   */
  async getServiceStatus(): Promise<Record<string, ServiceStatus>> {
    if (!this.connector.isConnected()) {
      throw new Error('Not connected to RPi — connect first');
    }

    const services = ['virtus-vision', 'virtus-llm', 'virtus-nav'];
    const result: Record<string, ServiceStatus> = {};

    for (const service of services) {
      try {
        const [activeResult, uptimeResult] = await Promise.all([
          this.connector.exec(`systemctl is-active ${service}.service`),
          this.connector.exec(
            `systemctl show ${service}.service --property=ActiveEnterTimestamp --value`
          ),
        ]);

        const active = activeResult.stdout.trim() === 'active';
        let uptime = '--';

        if (active && uptimeResult.stdout.trim()) {
          const enterTime = new Date(uptimeResult.stdout.trim());
          const now = new Date();
          const diffMs = now.getTime() - enterTime.getTime();

          if (diffMs > 0) {
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

            if (hours > 0) {
              uptime = `${hours}h ${minutes}m`;
            } else if (minutes > 0) {
              uptime = `${minutes}m ${seconds}s`;
            } else {
              uptime = `${seconds}s`;
            }
          }
        }

        result[service] = { active, uptime };
      } catch {
        result[service] = { active: false, uptime: '--' };
      }
    }

    return result;
  }

  /**
   * Sets the runtime resource allocation mode on the RPi.
   * Controls CPU/memory priority between vision, LLM, and navigation.
   *
   * - vision_priority: Vision gets 3 cores, LLM gets 1
   * - llm_priority: LLM gets 3 cores, Vision gets 1
   * - balanced: Each service gets 2 cores
   */
  async setRuntimeMode(mode: RuntimeMode): Promise<void> {
    if (!this.connector.isConnected()) {
      throw new Error('Not connected to RPi — connect first');
    }

    this.outputChannel.appendLine(
      `[RPiDeployer] Setting runtime mode: ${mode}`
    );

    // Configure CPU affinity and nice values based on mode
    let visionCpus: string;
    let llmCpus: string;
    let visionNice: number;
    let llmNice: number;

    switch (mode) {
      case 'vision_priority':
        visionCpus = '0-2';
        llmCpus = '3';
        visionNice = -5;
        llmNice = 10;
        break;
      case 'llm_priority':
        visionCpus = '0';
        llmCpus = '1-3';
        visionNice = 10;
        llmNice = -5;
        break;
      case 'balanced':
      default:
        visionCpus = '0-1';
        llmCpus = '2-3';
        visionNice = 0;
        llmNice = 0;
        break;
    }

    // Write the runtime config
    const configContent = [
      `RUNTIME_MODE=${mode}`,
      `VISION_CPUS=${visionCpus}`,
      `LLM_CPUS=${llmCpus}`,
      `VISION_NICE=${visionNice}`,
      `LLM_NICE=${llmNice}`,
    ].join('\n');

    await this.connector.exec(
      `echo '${configContent}' | sudo tee /etc/virtus/runtime.conf > /dev/null`
    );

    // Apply CPU affinity to running services via systemd overrides
    const commands = [
      `sudo mkdir -p /etc/systemd/system/virtus-vision.service.d`,
      `echo -e "[Service]\\nCPUAffinity=${visionCpus}\\nNice=${visionNice}" | ` +
      `sudo tee /etc/systemd/system/virtus-vision.service.d/resources.conf > /dev/null`,
      `sudo mkdir -p /etc/systemd/system/virtus-llm.service.d`,
      `echo -e "[Service]\\nCPUAffinity=${llmCpus}\\nNice=${llmNice}" | ` +
      `sudo tee /etc/systemd/system/virtus-llm.service.d/resources.conf > /dev/null`,
      `sudo systemctl daemon-reload`,
      `sudo systemctl restart virtus-vision.service virtus-llm.service`,
    ];

    for (const cmd of commands) {
      const result = await this.connector.exec(cmd);
      if (result.stderr && result.stderr.includes('Failed')) {
        this.outputChannel.appendLine(
          `[RPiDeployer] Warning: command failed: ${cmd}\n${result.stderr}`
        );
      }
    }

    this.outputChannel.appendLine(
      `[RPiDeployer] Runtime mode set to ${mode}`
    );
  }
}
