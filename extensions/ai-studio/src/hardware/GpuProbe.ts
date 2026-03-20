// Copyright 2026 VirtusCo
// GPU monitoring — polls nvidia-smi directly (no Python backend required)

import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { PlatformUtils } from '../platform/PlatformUtils';
import { GpuState, FineTuneRecommendation } from '../types';

const DEFAULT_POLL_INTERVAL_MS = 3_000;

export class GpuProbe {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(state: GpuState) => void> = new Set();
  private lastState: GpuState | null = null;
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  startPolling(intervalMs: number = DEFAULT_POLL_INTERVAL_MS): void {
    if (this.pollInterval) return;

    const poll = async (): Promise<void> => {
      try {
        const state = await this.queryNvidiaSmi();
        if (state) {
          this.lastState = state;
          for (const listener of this.listeners) {
            listener(state);
          }
        }
      } catch {
        // nvidia-smi not available or failed — silently ignore
      }
    };

    void poll();
    this.pollInterval = setInterval(() => void poll(), intervalMs);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  onUpdate(listener: (state: GpuState) => void): vscode.Disposable {
    this.listeners.add(listener);
    return new vscode.Disposable(() => {
      this.listeners.delete(listener);
    });
  }

  getLastState(): GpuState | null {
    return this.lastState;
  }

  /**
   * Queries nvidia-smi directly via child_process — no Python backend needed.
   * Works on both Windows (C:\Windows\System32\nvidia-smi.exe) and Linux.
   */
  private queryNvidiaSmi(): Promise<GpuState | null> {
    return new Promise((resolve) => {
      const smiBin = PlatformUtils.nvidiaSmi();
      const args = [
        '--query-gpu=name,memory.total,memory.used,memory.free,power.draw,power.limit,utilization.gpu,temperature.gpu',
        '--format=csv,noheader,nounits',
      ];

      execFile(smiBin, args, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          this.outputChannel.appendLine(`[gpu] nvidia-smi failed: ${error.message}`);
          resolve(null);
          return;
        }

        if (stderr && stderr.trim()) {
          this.outputChannel.appendLine(`[gpu] nvidia-smi stderr: ${stderr.trim()}`);
        }

        try {
          const line = stdout.trim().split('\n')[0];
          if (!line) {
            resolve(null);
            return;
          }

          const parts = line.split(',').map(s => s.trim());
          if (parts.length < 8) {
            this.outputChannel.appendLine(`[gpu] nvidia-smi unexpected output: ${line}`);
            resolve(null);
            return;
          }

          const powerDraw = parseFloat(parts[4]) || 0;
          // Laptop GPUs may report [N/A] for power limit
          const powerLimitRaw = parts[5].replace(/[[\]]/g, '').trim();
          const powerLimit = powerLimitRaw === 'N/A' ? 0 : (parseFloat(powerLimitRaw) || 0);

          const state: GpuState = {
            name: parts[0],
            vram_total_mb: parseInt(parts[1]) || 0,
            vram_used_mb: parseInt(parts[2]) || 0,
            vram_free_mb: parseInt(parts[3]) || 0,
            power_draw_w: powerDraw,
            power_limit_w: powerLimit,
            gpu_util_pct: parseInt(parts[6]) || 0,
            temperature_c: parseInt(parts[7]) || 0,
            is_throttled: powerLimit > 0 ? powerDraw > 0.92 * powerLimit : false,
          };

          resolve(state);
        } catch (parseErr) {
          this.outputChannel.appendLine(`[gpu] Failed to parse nvidia-smi output: ${parseErr}`);
          resolve(null);
        }
      });
    });
  }

  /**
   * One-shot probe — useful for manual refresh.
   */
  async probe(): Promise<GpuState | null> {
    const state = await this.queryNvidiaSmi();
    if (state) {
      this.lastState = state;
      for (const listener of this.listeners) {
        listener(state);
      }
    }
    return state;
  }

  recommendFineTuneMethod(state: GpuState): FineTuneRecommendation {
    const free = state.vram_free_mb;

    if (free > 12_000) {
      return {
        method: 'full',
        dtype: 'fp16',
        lora_r: null,
        reason: `${free} MB VRAM free — sufficient for full fine-tuning in fp16`,
      };
    }

    if (free > 6_000) {
      return {
        method: 'lora',
        dtype: 'bf16',
        lora_r: 16,
        reason: `${free} MB VRAM free — LoRA with bf16 and rank 16 recommended`,
      };
    }

    if (free > 4_000) {
      return {
        method: 'qlora',
        dtype: 'nf4',
        lora_r: 16,
        reason: `${free} MB VRAM free — QLoRA with nf4 quantization and rank 16 recommended`,
      };
    }

    return {
      method: 'qlora',
      dtype: 'nf4',
      lora_r: 8,
      reason: `${free} MB VRAM free — low memory: QLoRA with nf4 and reduced rank 8. Training may be unstable.`,
    };
  }
}
