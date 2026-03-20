// Copyright 2026 VirtusCo
// Sidebar tree view showing active training jobs and completed run history

import * as vscode from 'vscode';
import { RunRecord, TrainingMetric } from '../types';

// ── Active Job Tracking ─────────────────────────────────────────────

interface ActiveJob {
  run_id: string;
  model_name: string;
  type: string;
  latestMetric: TrainingMetric | null;
  startedAt: number;
}

// ── Tree Item Types ─────────────────────────────────────────────────

type JobItemKind =
  | 'section'
  | 'active-job'
  | 'active-metric'
  | 'completed-run'
  | 'run-detail'
  | 'empty';

class JobItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly kind: JobItemKind,
    public readonly runId?: string,
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

const MAX_COMPLETED_RUNS = 10;

export class JobsTreeProvider implements vscode.TreeDataProvider<JobItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<JobItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private activeJobs: Map<string, ActiveJob> = new Map();
  private completedRuns: RunRecord[] = [];

  /**
   * Triggers a full tree refresh.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Registers a new active training job.
   */
  addActiveJob(runId: string, modelName: string, type: string): void {
    this.activeJobs.set(runId, {
      run_id: runId,
      model_name: modelName,
      type,
      latestMetric: null,
      startedAt: Date.now(),
    });
    this.refresh();
  }

  /**
   * Updates the latest metric for an active job.
   */
  updateJobMetric(runId: string, metric: TrainingMetric): void {
    const job = this.activeJobs.get(runId);
    if (job) {
      job.latestMetric = metric;
      this.refresh();
    }
  }

  /**
   * Marks a job as completed and moves it to the completed runs list.
   */
  completeJob(runId: string, summary: Record<string, number>): void {
    const job = this.activeJobs.get(runId);
    if (job) {
      this.activeJobs.delete(runId);

      const run: RunRecord = {
        run_id: job.run_id,
        type: job.type as RunRecord['type'],
        model_name: job.model_name,
        config: {},
        metrics: summary,
        artifacts: {},
        timestamp: new Date().toISOString(),
      };

      this.completedRuns.unshift(run);
      if (this.completedRuns.length > MAX_COMPLETED_RUNS) {
        this.completedRuns = this.completedRuns.slice(0, MAX_COMPLETED_RUNS);
      }
    }

    this.refresh();
  }

  /**
   * Marks a job as failed and removes it from active jobs.
   */
  failJob(runId: string, error: string): void {
    const job = this.activeJobs.get(runId);
    if (job) {
      this.activeJobs.delete(runId);

      const run: RunRecord = {
        run_id: job.run_id,
        type: job.type as RunRecord['type'],
        model_name: job.model_name,
        config: {},
        metrics: { error: 1 },
        artifacts: { error_message: error },
        timestamp: new Date().toISOString(),
      };

      this.completedRuns.unshift(run);
      if (this.completedRuns.length > MAX_COMPLETED_RUNS) {
        this.completedRuns = this.completedRuns.slice(0, MAX_COMPLETED_RUNS);
      }
    }

    this.refresh();
  }

  /**
   * Replaces the completed runs list with data from the backend.
   */
  setRunHistory(runs: RunRecord[]): void {
    this.completedRuns = runs.slice(0, MAX_COMPLETED_RUNS);
    this.refresh();
  }

  getTreeItem(element: JobItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: JobItem): JobItem[] {
    if (!element) {
      return this.getRootSections();
    }

    if (element.kind === 'section') {
      if (element.label === 'Active Jobs') {
        return this.getActiveJobItems();
      }
      if (element.label === 'Completed Runs') {
        return this.getCompletedRunItems();
      }
    }

    if (element.kind === 'active-job' && element.runId) {
      return this.getActiveJobMetrics(element.runId);
    }

    if (element.kind === 'completed-run' && element.runId) {
      return this.getRunDetails(element.runId);
    }

    return [];
  }

  // ── Root ────────────────────────────────────────────────────────

  private getRootSections(): JobItem[] {
    const activeCount = this.activeJobs.size;
    const completedCount = this.completedRuns.length;

    return [
      new JobItem(
        'Active Jobs',
        'section',
        undefined,
        vscode.TreeItemCollapsibleState.Expanded,
        new vscode.ThemeIcon(activeCount > 0 ? 'sync~spin' : 'sync')
      ),
      new JobItem(
        'Completed Runs',
        'section',
        undefined,
        vscode.TreeItemCollapsibleState.Expanded,
        new vscode.ThemeIcon(completedCount > 0 ? 'history' : 'circle-slash')
      ),
    ];
  }

  // ── Active Jobs ─────────────────────────────────────────────────

  private getActiveJobItems(): JobItem[] {
    if (this.activeJobs.size === 0) {
      return [
        new JobItem(
          'No active jobs',
          'empty',
          undefined,
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('circle-slash')
        ),
      ];
    }

    const items: JobItem[] = [];
    for (const job of this.activeJobs.values()) {
      const metric = job.latestMetric;
      const progress = metric
        ? `epoch ${metric.epoch.toFixed(1)} | loss ${metric.loss.toFixed(4)}`
        : 'starting...';

      const item = new JobItem(
        `${job.model_name} (${job.type}) — ${progress}`,
        'active-job',
        job.run_id,
        vscode.TreeItemCollapsibleState.Collapsed,
        new vscode.ThemeIcon('sync~spin')
      );
      item.description = job.run_id.slice(0, 8);
      items.push(item);
    }

    return items;
  }

  private getActiveJobMetrics(runId: string): JobItem[] {
    const job = this.activeJobs.get(runId);
    if (!job || !job.latestMetric) {
      return [
        new JobItem(
          'Waiting for metrics...',
          'active-metric',
          runId,
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('loading~spin')
        ),
      ];
    }

    const m = job.latestMetric;
    const etaMinutes = Math.ceil(m.eta_seconds / 60);

    return [
      new JobItem(
        `Step: ${m.step}`,
        'active-metric',
        runId,
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('symbol-number')
      ),
      new JobItem(
        `Loss: ${m.loss.toFixed(4)}`,
        'active-metric',
        runId,
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('graph-line')
      ),
      new JobItem(
        `Eval Loss: ${m.eval_loss.toFixed(4)}`,
        'active-metric',
        runId,
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('graph-line')
      ),
      new JobItem(
        `LR: ${m.learning_rate.toExponential(2)}`,
        'active-metric',
        runId,
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('settings-gear')
      ),
      new JobItem(
        `VRAM: ${m.gpu_vram_used_mb} MB | Power: ${m.gpu_power_w.toFixed(0)}W`,
        'active-metric',
        runId,
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('circuit-board')
      ),
      new JobItem(
        `ETA: ${etaMinutes} min`,
        'active-metric',
        runId,
        vscode.TreeItemCollapsibleState.None,
        new vscode.ThemeIcon('clock')
      ),
    ];
  }

  // ── Completed Runs ──────────────────────────────────────────────

  private getCompletedRunItems(): JobItem[] {
    if (this.completedRuns.length === 0) {
      return [
        new JobItem(
          'No completed runs',
          'empty',
          undefined,
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('circle-slash')
        ),
      ];
    }

    return this.completedRuns.map((run) => {
      const hasError = run.metrics['error'] === 1;
      const icon = hasError ? 'error' : 'pass-filled';
      const status = hasError ? 'FAILED' : 'OK';
      const date = new Date(run.timestamp);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

      const item = new JobItem(
        `${run.model_name} (${run.type}) — ${status}`,
        'completed-run',
        run.run_id,
        vscode.TreeItemCollapsibleState.Collapsed,
        new vscode.ThemeIcon(icon)
      );
      item.description = dateStr;
      return item;
    });
  }

  private getRunDetails(runId: string): JobItem[] {
    const run = this.completedRuns.find((r) => r.run_id === runId);
    if (!run) {
      return [];
    }

    const items: JobItem[] = [];

    // Show metrics
    for (const [key, value] of Object.entries(run.metrics)) {
      if (key === 'error') {
        continue;
      }
      items.push(
        new JobItem(
          `${key}: ${typeof value === 'number' ? value.toFixed(4) : String(value)}`,
          'run-detail',
          runId,
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('symbol-number')
        )
      );
    }

    // Show artifacts
    for (const [key, value] of Object.entries(run.artifacts)) {
      items.push(
        new JobItem(
          `${key}: ${value}`,
          'run-detail',
          runId,
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('file-binary')
        )
      );
    }

    if (items.length === 0) {
      items.push(
        new JobItem(
          'No details available',
          'run-detail',
          runId,
          vscode.TreeItemCollapsibleState.None,
          new vscode.ThemeIcon('info')
        )
      );
    }

    return items;
  }
}
