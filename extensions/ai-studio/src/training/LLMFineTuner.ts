// Copyright 2026 VirtusCo
// LLM fine-tuning orchestrator — launches LoRA/QLoRA training via PythonBridge

import { PythonBridge } from '../python/PythonBridge';

// ── Config Interface ───────────────────────────────────────────────

export interface LLMFineTuneConfig {
  base_model: string;
  dataset_jsonl: string;
  method: 'full' | 'lora' | 'qlora';
  lora_r: number;
  lora_alpha: number;
  lora_dropout: number;
  target_modules: string[];
  epochs: number;
  batch_size: number;
  grad_accumulation: number;
  learning_rate: number;
  warmup_ratio: number;
  max_seq_length: number;
  eval_steps: number;
  save_steps: number;
  output_dir: string;
  export_after: {
    merge_weights: boolean;
    export_gguf: boolean;
  };
}

// ── Metric payload from Python stdout ──────────────────────────────

export interface LLMMetric {
  step: number;
  loss: number;
  eval_loss: number;
  learning_rate: number;
  epoch: number;
  adapter_size_mb: number;
}

// ── LLMFineTuner ───────────────────────────────────────────────────

export class LLMFineTuner {
  private readonly bridge: PythonBridge;
  private activeRunIds: Set<string> = new Set();

  constructor(bridge: PythonBridge) {
    this.bridge = bridge;
  }

  /**
   * Starts an LLM fine-tuning run (full, LoRA, or QLoRA).
   * Returns a run_id that can be used to stream metrics or cancel.
   */
  async startFineTune(
    config: LLMFineTuneConfig,
    onMetric: (metric: LLMMetric) => void,
    onComplete: (runId: string, summary: Record<string, number>) => void,
    onError: (runId: string, error: string) => void
  ): Promise<string> {
    const body: Record<string, unknown> = {
      base_model: config.base_model,
      dataset_jsonl: config.dataset_jsonl,
      method: config.method,
      lora_r: config.lora_r,
      lora_alpha: config.lora_alpha,
      lora_dropout: config.lora_dropout,
      target_modules: config.target_modules,
      epochs: config.epochs,
      batch_size: config.batch_size,
      grad_accumulation: config.grad_accumulation,
      learning_rate: config.learning_rate,
      warmup_ratio: config.warmup_ratio,
      max_seq_length: config.max_seq_length,
      eval_steps: config.eval_steps,
      save_steps: config.save_steps,
      output_dir: config.output_dir,
      export_after: config.export_after,
    };

    // POST to start the job
    const startResult = await this.bridge.fetch<{ job_id: string }>(
      '/train/llm',
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
   * Cancels an active fine-tuning run by sending a cancel request to the backend.
   */
  async cancelFineTune(runId: string): Promise<void> {
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
    onMetric: (metric: LLMMetric) => void,
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
              if (typeof data.step === 'number') {
                onMetric(data as LLMMetric);
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
