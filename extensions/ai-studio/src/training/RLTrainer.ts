// Copyright 2026 VirtusCo
// Reinforcement learning trainer — manages SB3 training via PythonBridge

import * as path from 'path';
import * as vscode from 'vscode';
import { PythonBridge } from '../python/PythonBridge';

// ── RL Training Config ──────────────────────────────────────────────

export type RLAlgorithm = 'SAC' | 'PPO' | 'TD3';

export interface RLTrainConfig {
  algorithm: RLAlgorithm;
  environment: string;
  total_timesteps: number;
  learning_rate: number;
  buffer_size: number;
  batch_size: number;
  gamma: number;
  policy: string;
  save_freq: number;
  eval_freq: number;
  output_dir: string;
}

// ── RL Training Metrics ─────────────────────────────────────────────

export interface RLMetric {
  timestep: number;
  mean_reward: number;
  std_reward: number;
  episode_length_mean: number;
  value_loss: number;
  policy_loss: number;
  fps: number;
}

// ── RLTrainer Class ─────────────────────────────────────────────────

export class RLTrainer {
  private readonly bridge: PythonBridge;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(bridge: PythonBridge, outputChannel: vscode.OutputChannel) {
    this.bridge = bridge;
    this.outputChannel = outputChannel;
  }

  /**
   * Starts an RL training run via the Python backend.
   * Streams metrics via SSE events, calling onMetric for each evaluation.
   * Returns the run_id assigned by the server.
   */
  async startTraining(
    config: RLTrainConfig,
    onMetric: (metric: RLMetric) => void,
    onProgress?: (pct: number) => void
  ): Promise<string> {
    this.outputChannel.appendLine(
      `[RLTrainer] Starting ${config.algorithm} training on env=${config.environment} ` +
      `for ${config.total_timesteps} timesteps`
    );

    let runId = '';

    await this.bridge.streamSSE(
      '/training/rl',
      {
        algorithm: config.algorithm,
        environment: config.environment,
        total_timesteps: config.total_timesteps,
        learning_rate: config.learning_rate,
        buffer_size: config.buffer_size,
        batch_size: config.batch_size,
        gamma: config.gamma,
        policy: config.policy,
        save_freq: config.save_freq,
        eval_freq: config.eval_freq,
        output_dir: config.output_dir,
      },
      (event) => {
        switch (event.event) {
          case 'run_id': {
            runId = event.data;
            this.outputChannel.appendLine(`[RLTrainer] Run ID: ${runId}`);
            break;
          }
          case 'metric': {
            try {
              const metric: RLMetric = JSON.parse(event.data);
              onMetric(metric);

              if (onProgress && config.total_timesteps > 0) {
                const pct = Math.min(
                  100,
                  Math.round((metric.timestep / config.total_timesteps) * 100)
                );
                onProgress(pct);
              }

              this.outputChannel.appendLine(
                `[RLTrainer] step=${metric.timestep} ` +
                `reward=${metric.mean_reward.toFixed(2)} +/- ${metric.std_reward.toFixed(2)} ` +
                `fps=${metric.fps}`
              );
            } catch {
              this.outputChannel.appendLine(
                `[RLTrainer] Failed to parse metric: ${event.data}`
              );
            }
            break;
          }
          case 'done': {
            this.outputChannel.appendLine(
              `[RLTrainer] Training completed: ${event.data}`
            );
            break;
          }
          case 'error': {
            this.outputChannel.appendLine(
              `[RLTrainer] Training error: ${event.data}`
            );
            break;
          }
          default:
            break;
        }
      }
    );

    if (!runId) {
      throw new Error('RL training completed but no run_id was assigned');
    }

    return runId;
  }

  /**
   * Returns the default config for a given algorithm, suitable for
   * navigation RL training on the Porter robot.
   */
  static defaultConfig(algorithm: RLAlgorithm): RLTrainConfig {
    const base: RLTrainConfig = {
      algorithm,
      environment: 'PorterNav-v0',
      total_timesteps: 500_000,
      learning_rate: 3e-4,
      buffer_size: 100_000,
      batch_size: 256,
      gamma: 0.99,
      policy: 'MlpPolicy',
      save_freq: 10_000,
      eval_freq: 5_000,
      output_dir: '',
    };

    switch (algorithm) {
      case 'PPO':
        // PPO does not use a replay buffer
        base.buffer_size = 0;
        base.batch_size = 64;
        base.learning_rate = 3e-4;
        break;
      case 'TD3':
        base.learning_rate = 1e-3;
        base.buffer_size = 200_000;
        base.batch_size = 100;
        break;
      case 'SAC':
      default:
        // SAC defaults are already set
        break;
    }

    return base;
  }
}
