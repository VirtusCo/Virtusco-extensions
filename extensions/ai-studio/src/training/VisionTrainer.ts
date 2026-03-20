// Copyright 2026 VirtusCo
// Vision training orchestrator — launches YOLO training via PythonBridge

import { PythonBridge } from '../python/PythonBridge';

// ── Config Interface ───────────────────────────────────────────────

export interface VisionTrainConfig {
  model: string;
  dataset_yaml: string;
  epochs: number;
  batch_size: number;
  imgsz: number;
  lr0: number;
  augmentation: boolean;
  early_stopping_patience: number;
  export_onnx_after: boolean;
  project_name: string;
}

// ── Metric payload from Python stdout ──────────────────────────────

export interface VisionMetric {
  epoch: number;
  box_loss: number;
  cls_loss: number;
  map50: number;
  map50_95: number;
  precision: number;
  recall: number;
  lr: number;
}

// ── VisionTrainer ──────────────────────────────────────────────────

export class VisionTrainer {
  private readonly bridge: PythonBridge;
  private activeRunIds: Set<string> = new Set();

  constructor(bridge: PythonBridge) {
    this.bridge = bridge;
  }

  /**
   * Starts a YOLO vision training run.
   * Returns a run_id that can be used to stream metrics or cancel.
   */
  async startTraining(
    config: VisionTrainConfig,
    onMetric: (metric: VisionMetric) => void,
    onComplete: (runId: string, summary: Record<string, number>) => void,
    onError: (runId: string, error: string) => void
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: config.model,
      dataset_yaml: config.dataset_yaml,
      epochs: config.epochs,
      batch_size: config.batch_size,
      imgsz: config.imgsz,
      lr0: config.lr0,
      augmentation: config.augmentation,
      early_stopping_patience: config.early_stopping_patience,
      export_onnx_after: config.export_onnx_after,
      project_name: config.project_name,
    };

    // POST to start the job, then stream SSE
    const startResult = await this.bridge.fetch<{ job_id: string }>(
      '/train/vision',
      'POST',
      body
    );
    const runId = startResult.job_id;
    this.activeRunIds.add(runId);

    // Stream metrics in background (non-blocking)
    this.streamMetrics(runId, onMetric, onComplete, onError);

    return runId;
  }

  /**
   * Cancels an active training run by sending a cancel request to the backend.
   */
  async cancelTraining(runId: string): Promise<void> {
    this.activeRunIds.delete(runId);
    await this.bridge.fetch<{ status: string }>(
      `/train/cancel/${runId}`,
      'POST'
    );
  }

  /**
   * Returns whether a given run is currently tracked as active.
   */
  isActive(runId: string): boolean {
    return this.activeRunIds.has(runId);
  }

  /**
   * Streams SSE events from the backend for the given run.
   */
  private async streamMetrics(
    runId: string,
    onMetric: (metric: VisionMetric) => void,
    onComplete: (runId: string, summary: Record<string, number>) => void,
    onError: (runId: string, error: string) => void
  ): Promise<void> {
    try {
      await this.bridge.streamSSE(
        `/train/stream/${runId}`,
        {},
        (sseEvent) => {
          if (!this.activeRunIds.has(runId)) {
            return;
          }

          try {
            const data = JSON.parse(sseEvent.data);

            if (sseEvent.event === 'metric' || sseEvent.event === 'message') {
              if (typeof data.epoch === 'number') {
                onMetric(data as VisionMetric);
              }
            } else if (sseEvent.event === 'done') {
              this.activeRunIds.delete(runId);
              onComplete(runId, data as Record<string, number>);
            } else if (sseEvent.event === 'error') {
              this.activeRunIds.delete(runId);
              onError(runId, data.message ?? 'Unknown error');
            }
          } catch {
            // Skip malformed SSE data
          }
        }
      );

      // Stream ended naturally
      if (this.activeRunIds.has(runId)) {
        this.activeRunIds.delete(runId);
        onComplete(runId, {});
      }
    } catch (err) {
      this.activeRunIds.delete(runId);
      onError(
        runId,
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}
