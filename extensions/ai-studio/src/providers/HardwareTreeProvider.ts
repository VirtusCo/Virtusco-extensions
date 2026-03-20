// Copyright 2026 VirtusCo
// Sidebar tree view showing GPU, Raspberry Pi, and Hailo accelerator status

import * as vscode from 'vscode';
import { GpuState, HailoState, RpiInfo } from '../types';

// ── Tree Item Types ─────────────────────────────────────────────────

type HardwareItemKind =
  | 'section'
  | 'gpu-name'
  | 'gpu-vram'
  | 'gpu-power'
  | 'gpu-util'
  | 'gpu-temp'
  | 'gpu-throttle'
  | 'rpi-status'
  | 'rpi-host'
  | 'rpi-os'
  | 'rpi-temp'
  | 'rpi-mem'
  | 'hailo-version'
  | 'hailo-service'
  | 'hailo-tops'
  | 'hailo-model'
  | 'hailo-tps'
  | 'hailo-fps';

class HardwareItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly kind: HardwareItemKind,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    icon?: vscode.ThemeIcon
  ) {
    super(label, collapsibleState);
    if (icon) {
      this.iconPath = icon;
    }
  }
}

// ── Provider ────────────────────────────────────────────────────────

export class HardwareTreeProvider implements vscode.TreeDataProvider<HardwareItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<HardwareItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private gpuState: GpuState | null = null;
  private rpiConnected: boolean = false;
  private rpiInfo: RpiInfo | null = null;
  private hailoState: HailoState | null = null;

  /**
   * Triggers a full tree refresh.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Updates the GPU state and refreshes the tree.
   */
  updateGpu(state: GpuState): void {
    this.gpuState = state;
    this.refresh();
  }

  /**
   * Updates the RPi connection info and refreshes the tree.
   */
  updateRpi(connected: boolean, info?: RpiInfo): void {
    this.rpiConnected = connected;
    this.rpiInfo = info ?? null;
    this.refresh();
  }

  /**
   * Updates the Hailo accelerator state and refreshes the tree.
   */
  updateHailo(state: HailoState): void {
    this.hailoState = state;
    this.refresh();
  }

  getTreeItem(element: HardwareItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: HardwareItem): HardwareItem[] {
    if (!element) {
      return this.getRootSections();
    }

    switch (element.kind) {
      case 'section':
        if (element.label === 'GPU') {
          return this.getGpuChildren();
        }
        if (element.label === 'Raspberry Pi') {
          return this.getRpiChildren();
        }
        if (element.label === 'Hailo Accelerator') {
          return this.getHailoChildren();
        }
        return [];
      default:
        return [];
    }
  }

  // ── Root ────────────────────────────────────────────────────────

  private getRootSections(): HardwareItem[] {
    return [
      new HardwareItem(
        'GPU',
        'section',
        vscode.TreeItemCollapsibleState.Expanded,
        new vscode.ThemeIcon('circuit-board')
      ),
      new HardwareItem(
        'Raspberry Pi',
        'section',
        vscode.TreeItemCollapsibleState.Expanded,
        new vscode.ThemeIcon('remote')
      ),
      new HardwareItem(
        'Hailo Accelerator',
        'section',
        vscode.TreeItemCollapsibleState.Expanded,
        new vscode.ThemeIcon('zap')
      ),
    ];
  }

  // ── GPU Section ─────────────────────────────────────────────────

  private getGpuChildren(): HardwareItem[] {
    if (!this.gpuState) {
      return [
        new HardwareItem(
          'No GPU detected',
          'gpu-name',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('warning')
        ),
      ];
    }

    const gpu = this.gpuState;
    const vramPct = Math.round((gpu.vram_used_mb / gpu.vram_total_mb) * 100);
    const vramBar = this.makeBar(vramPct);

    const items: HardwareItem[] = [
      new HardwareItem(
        gpu.name,
        'gpu-name',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('symbol-class')
      ),
      new HardwareItem(
        `VRAM: ${gpu.vram_used_mb}/${gpu.vram_total_mb} MB ${vramBar} ${vramPct}%`,
        'gpu-vram',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('database')
      ),
      new HardwareItem(
        `Power: ${gpu.power_draw_w.toFixed(0)}W / ${gpu.power_limit_w.toFixed(0)}W`,
        'gpu-power',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('plug')
      ),
      new HardwareItem(
        `Utilization: ${gpu.gpu_util_pct}%`,
        'gpu-util',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('dashboard')
      ),
      new HardwareItem(
        `Temperature: ${gpu.temperature_c}\u00B0C`,
        'gpu-temp',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('flame')
      ),
    ];

    if (gpu.is_throttled) {
      items.push(
        new HardwareItem(
          'THROTTLED — power limit reached',
          'gpu-throttle',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('warning')
        )
      );
    }

    return items;
  }

  // ── RPi Section ─────────────────────────────────────────────────

  private getRpiChildren(): HardwareItem[] {
    if (!this.rpiConnected || !this.rpiInfo) {
      return [
        new HardwareItem(
          'Disconnected',
          'rpi-status',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('debug-disconnect')
        ),
      ];
    }

    const info = this.rpiInfo;
    const memUsedKb = info.mem_total - info.mem_available;
    const memPct = info.mem_total > 0
      ? Math.round((memUsedKb / info.mem_total) * 100)
      : 0;

    return [
      new HardwareItem(
        `Connected`,
        'rpi-status',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('pass-filled')
      ),
      new HardwareItem(
        `Host: ${info.hostname}`,
        'rpi-host',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('server')
      ),
      new HardwareItem(
        `OS: ${info.os}`,
        'rpi-os',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('terminal-linux')
      ),
      new HardwareItem(
        `CPU Temp: ${info.cpu_temp.toFixed(1)}\u00B0C`,
        'rpi-temp',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('flame')
      ),
      new HardwareItem(
        `Memory: ${Math.round(memUsedKb / 1024)}/${Math.round(info.mem_total / 1024)} MB (${memPct}%)`,
        'rpi-mem',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('database')
      ),
    ];
  }

  // ── Hailo Section ───────────────────────────────────────────────

  private getHailoChildren(): HardwareItem[] {
    if (!this.hailoState || this.hailoState.hailo_rt_version === null) {
      return [
        new HardwareItem(
          'Not detected',
          'hailo-version',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('circle-slash')
        ),
      ];
    }

    const hailo = this.hailoState;
    const items: HardwareItem[] = [
      new HardwareItem(
        `Runtime: v${hailo.hailo_rt_version}`,
        'hailo-version',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('versions')
      ),
      new HardwareItem(
        `Service: ${hailo.hailo_ollama_running ? 'Running' : 'Stopped'}`,
        'hailo-service',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon(hailo.hailo_ollama_running ? 'pass-filled' : 'circle-slash')
      ),
      new HardwareItem(
        `TOPS: ${hailo.tops_available}`,
        'hailo-tops',
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('rocket')
      ),
    ];

    // Loaded models
    if (hailo.loaded_models.length > 0) {
      for (const model of hailo.loaded_models) {
        items.push(
          new HardwareItem(
            `Model: ${model}`,
            'hailo-model',
            vscode.TreeItemCollapsibleState.None,
            new vscode.ThemeIcon('symbol-method')
          )
        );
      }
    }

    // Performance metrics
    if (hailo.llm_tps !== null) {
      items.push(
        new HardwareItem(
          `LLM: ${hailo.llm_tps.toFixed(1)} tokens/s`,
          'hailo-tps',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('symbol-text')
        )
      );
    }

    if (hailo.vision_fps !== null) {
      items.push(
        new HardwareItem(
          `Vision: ${hailo.vision_fps.toFixed(1)} FPS`,
          'hailo-fps',
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('eye')
        )
      );
    }

    return items;
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /**
   * Creates a simple text-based progress bar.
   */
  private makeBar(pct: number): string {
    const filled = Math.round(pct / 10);
    const empty = 10 - filled;
    return `[${'#'.repeat(filled)}${'-'.repeat(empty)}]`;
  }
}
