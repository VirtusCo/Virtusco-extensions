// Copyright 2026 VirtusCo
// Benchmark runner — evaluates vision, LLM, and RL models

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonBridge } from '../python/PythonBridge';

// ── Benchmark Types ─────────────────────────────────────────────────

export type BenchmarkModelType = 'vision' | 'llm' | 'rl';

export interface BenchmarkResult {
  run_id: string;
  model_type: BenchmarkModelType;
  model_name: string;
  model_path: string;
  // Vision metrics
  map50?: number;
  map50_95?: number;
  fps_onnx?: number;
  // LLM metrics
  perplexity?: number;
  tokens_per_sec?: number;
  ttft_ms?: number;
  // RL metrics
  mean_reward?: number;
  std_reward?: number;
  mean_episode_length?: number;
  // Common
  timestamp: string;
  duration_seconds?: number;
  notes?: string;
}

// ── BenchmarkRunner Class ───────────────────────────────────────────

export class BenchmarkRunner {
  private readonly bridge: PythonBridge;
  private readonly outputChannel: vscode.OutputChannel;
  private readonly storageDir: string;

  constructor(
    bridge: PythonBridge,
    outputChannel: vscode.OutputChannel,
    workspaceRoot: string
  ) {
    this.bridge = bridge;
    this.outputChannel = outputChannel;
    this.storageDir = path.join(workspaceRoot, '.virtus-ai', 'benchmarks');
  }

  /**
   * Runs a vision model benchmark (mAP evaluation on a YOLO dataset).
   */
  async runVisionBenchmark(
    modelPath: string,
    datasetPath: string
  ): Promise<BenchmarkResult> {
    this.outputChannel.appendLine(
      `[Benchmark] Running vision benchmark: model=${modelPath}, dataset=${datasetPath}`
    );

    const result = await this.bridge.fetch<{
      run_id: string;
      model_name: string;
      map50: number;
      map50_95: number;
      fps_onnx: number;
      duration_seconds: number;
    }>('/benchmark/vision', 'POST', {
      model_path: modelPath,
      dataset_path: datasetPath,
    });

    const benchmark: BenchmarkResult = {
      run_id: result.run_id,
      model_type: 'vision',
      model_name: result.model_name,
      model_path: modelPath,
      map50: result.map50,
      map50_95: result.map50_95,
      fps_onnx: result.fps_onnx,
      duration_seconds: result.duration_seconds,
      timestamp: new Date().toISOString(),
    };

    await this.saveResult(benchmark);
    this.outputChannel.appendLine(
      `[Benchmark] Vision complete: mAP50=${result.map50.toFixed(4)}, ` +
      `mAP50-95=${result.map50_95.toFixed(4)}, FPS=${result.fps_onnx.toFixed(1)}`
    );

    return benchmark;
  }

  /**
   * Runs an LLM benchmark (perplexity + tokens/sec on a GGUF model).
   */
  async runLLMBenchmark(
    modelPath: string,
    evalJsonl: string
  ): Promise<BenchmarkResult> {
    this.outputChannel.appendLine(
      `[Benchmark] Running LLM benchmark: model=${modelPath}, eval=${evalJsonl}`
    );

    const result = await this.bridge.fetch<{
      run_id: string;
      model_name: string;
      perplexity: number;
      tokens_per_sec: number;
      ttft_ms: number;
      duration_seconds: number;
    }>('/benchmark/llm', 'POST', {
      model_path: modelPath,
      eval_jsonl: evalJsonl,
    });

    const benchmark: BenchmarkResult = {
      run_id: result.run_id,
      model_type: 'llm',
      model_name: result.model_name,
      model_path: modelPath,
      perplexity: result.perplexity,
      tokens_per_sec: result.tokens_per_sec,
      ttft_ms: result.ttft_ms,
      duration_seconds: result.duration_seconds,
      timestamp: new Date().toISOString(),
    };

    await this.saveResult(benchmark);
    this.outputChannel.appendLine(
      `[Benchmark] LLM complete: perplexity=${result.perplexity.toFixed(4)}, ` +
      `TPS=${result.tokens_per_sec.toFixed(1)}, TTFT=${result.ttft_ms.toFixed(0)}ms`
    );

    return benchmark;
  }

  /**
   * Runs an RL benchmark (mean reward over N evaluation episodes).
   */
  async runRLBenchmark(
    modelPath: string,
    envId: string
  ): Promise<BenchmarkResult> {
    this.outputChannel.appendLine(
      `[Benchmark] Running RL benchmark: model=${modelPath}, env=${envId}`
    );

    const result = await this.bridge.fetch<{
      run_id: string;
      model_name: string;
      mean_reward: number;
      std_reward: number;
      mean_episode_length: number;
      duration_seconds: number;
    }>('/benchmark/rl', 'POST', {
      model_path: modelPath,
      env_id: envId,
    });

    const benchmark: BenchmarkResult = {
      run_id: result.run_id,
      model_type: 'rl',
      model_name: result.model_name,
      model_path: modelPath,
      mean_reward: result.mean_reward,
      std_reward: result.std_reward,
      mean_episode_length: result.mean_episode_length,
      duration_seconds: result.duration_seconds,
      timestamp: new Date().toISOString(),
    };

    await this.saveResult(benchmark);
    this.outputChannel.appendLine(
      `[Benchmark] RL complete: mean_reward=${result.mean_reward.toFixed(2)} ` +
      `+/- ${result.std_reward.toFixed(2)}, ep_len=${result.mean_episode_length.toFixed(1)}`
    );

    return benchmark;
  }

  /**
   * Loads all saved benchmark results from the .virtus-ai/benchmarks/ directory.
   * Results are sorted by timestamp (newest first).
   */
  async loadHistory(): Promise<BenchmarkResult[]> {
    try {
      await fs.promises.mkdir(this.storageDir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    let entries: string[];
    try {
      entries = await fs.promises.readdir(this.storageDir);
    } catch {
      return [];
    }

    const results: BenchmarkResult[] = [];

    for (const entry of entries) {
      if (!entry.endsWith('.json')) {
        continue;
      }

      try {
        const filePath = path.join(this.storageDir, entry);
        const raw = await fs.promises.readFile(filePath, 'utf8');
        const result: BenchmarkResult = JSON.parse(raw);
        results.push(result);
      } catch (err) {
        this.outputChannel.appendLine(
          `[Benchmark] Failed to read ${entry}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return tb - ta;
    });

    return results;
  }

  /**
   * Saves a benchmark result to .virtus-ai/benchmarks/{run_id}.json.
   */
  async saveResult(result: BenchmarkResult): Promise<void> {
    try {
      await fs.promises.mkdir(this.storageDir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    const filePath = path.join(this.storageDir, `${result.run_id}.json`);
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(result, null, 2),
      'utf8'
    );

    this.outputChannel.appendLine(
      `[Benchmark] Result saved: ${filePath}`
    );
  }
}
