// Copyright 2026 VirtusCo
// Hailo accelerator detection via SSH commands on the Raspberry Pi

import { RPiConnector } from './RPiConnector';
import { HailoState } from '../types';

export class HailoProbe {
  private readonly rpi: RPiConnector;

  constructor(rpi: RPiConnector) {
    this.rpi = rpi;
  }

  /**
   * Probes the RPi for Hailo accelerator status.
   * Runs multiple commands via SSH and returns a HailoState.
   * Returns gracefully with null/empty values if Hailo is not installed.
   */
  async probe(): Promise<HailoState> {
    if (!this.rpi.isConnected()) {
      return HailoProbe.emptyState();
    }

    const [version, models, serviceActive] = await Promise.all([
      this.getHailoVersion(),
      this.getLoadedModels(),
      this.isHailoOllamaRunning(),
    ]);

    // Attempt to read performance counters if the runtime is available
    let topsAvailable = 0;
    let llmTps: number | null = null;
    let visionFps: number | null = null;

    if (version !== null) {
      topsAvailable = await this.getTopsAvailable();
      llmTps = await this.getLlmTps();
      visionFps = await this.getVisionFps();
    }

    return {
      hailo_rt_version: version,
      hailo_ollama_running: serviceActive,
      loaded_models: models,
      tops_available: topsAvailable,
      llm_tps: llmTps,
      vision_fps: visionFps,
    };
  }

  /**
   * Reads the Hailo runtime version via hailortcli.
   */
  private async getHailoVersion(): Promise<string | null> {
    try {
      const result = await this.rpi.exec('hailortcli fw-control identify');
      // Parse version from output like "Firmware Version: X.Y.Z" or similar
      const versionMatch = result.stdout.match(
        /(?:firmware version|hailo.?rt version)[:\s]+(\S+)/i
      );
      if (versionMatch) {
        return versionMatch[1];
      }
      // If the command succeeded but we couldn't parse a version, return the full output trimmed
      const trimmed = result.stdout.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  }

  /**
   * Lists models loaded in hailo-ollama.
   */
  private async getLoadedModels(): Promise<string[]> {
    try {
      const result = await this.rpi.exec('hailo-ollama list');
      if (!result.stdout.trim()) {
        return [];
      }
      // Parse model names — one per line, filter empty lines
      return result.stdout
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    } catch {
      return [];
    }
  }

  /**
   * Checks if the hailo-ollama systemd service is active.
   */
  private async isHailoOllamaRunning(): Promise<boolean> {
    try {
      const result = await this.rpi.exec('systemctl is-active hailo-ollama');
      return result.stdout.trim() === 'active';
    } catch {
      return false;
    }
  }

  /**
   * Reads the available TOPS from the Hailo device.
   */
  private async getTopsAvailable(): Promise<number> {
    try {
      const result = await this.rpi.exec(
        'hailortcli fw-control identify 2>/dev/null | grep -i tops'
      );
      const match = result.stdout.match(/([\d.]+)\s*TOPS/i);
      if (match) {
        return parseFloat(match[1]);
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Reads the current LLM tokens-per-second if available.
   */
  private async getLlmTps(): Promise<number | null> {
    try {
      const result = await this.rpi.exec(
        'curl -s http://127.0.0.1:11434/api/stats 2>/dev/null'
      );
      const parsed = JSON.parse(result.stdout) as { tokens_per_second?: number };
      return parsed.tokens_per_second ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Reads the current vision inference FPS if a vision pipeline is running.
   */
  private async getVisionFps(): Promise<number | null> {
    try {
      const result = await this.rpi.exec(
        'curl -s http://127.0.0.1:8080/stats 2>/dev/null'
      );
      const parsed = JSON.parse(result.stdout) as { fps?: number };
      return parsed.fps ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Returns an empty HailoState when the device is unreachable.
   */
  private static emptyState(): HailoState {
    return {
      hailo_rt_version: null,
      hailo_ollama_running: false,
      loaded_models: [],
      tops_available: 0,
      llm_tps: null,
      vision_fps: null,
    };
  }
}
