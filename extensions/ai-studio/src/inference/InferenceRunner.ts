// Copyright 2026 VirtusCo
// Inference runner — executes vision and LLM inference via PythonBridge

import * as vscode from 'vscode';
import { PythonBridge } from '../python/PythonBridge';

// ── Vision Inference Types ──────────────────────────────────────────

export interface BoundingBox {
  class_name: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VisionInferenceResult {
  boxes: BoundingBox[];
  latency_ms: number;
  image_width: number;
  image_height: number;
}

// ── LLM Inference Types ─────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMInferenceResult {
  response: string;
  tokens_per_sec: number;
  ttft_ms: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  model_name: string;
}

// ── InferenceRunner Class ───────────────────────────────────────────

export class InferenceRunner {
  private readonly bridge: PythonBridge;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(bridge: PythonBridge, outputChannel: vscode.OutputChannel) {
    this.bridge = bridge;
    this.outputChannel = outputChannel;
  }

  /**
   * Runs vision inference on an image using an ONNX or YOLO model.
   * Returns detected bounding boxes and latency.
   */
  async runVisionInference(
    modelPath: string,
    imagePath: string,
    confThreshold: number = 0.25
  ): Promise<VisionInferenceResult> {
    this.outputChannel.appendLine(
      `[Inference] Vision: model=${modelPath}, image=${imagePath}, conf=${confThreshold}`
    );

    const result = await this.bridge.fetch<{
      boxes: Array<{
        class_name: string;
        confidence: number;
        x: number;
        y: number;
        w: number;
        h: number;
      }>;
      latency_ms: number;
      image_width: number;
      image_height: number;
    }>('/inference/vision', 'POST', {
      model_path: modelPath,
      image_path: imagePath,
      conf_threshold: confThreshold,
    });

    this.outputChannel.appendLine(
      `[Inference] Vision result: ${result.boxes.length} detections, ` +
      `latency=${result.latency_ms.toFixed(1)}ms`
    );

    return {
      boxes: result.boxes,
      latency_ms: result.latency_ms,
      image_width: result.image_width,
      image_height: result.image_height,
    };
  }

  /**
   * Runs LLM inference using a GGUF model with chat messages.
   * Returns the response text and performance metrics.
   */
  async runLLMInference(
    modelPath: string,
    messages: ChatMessage[],
    maxTokens: number = 256
  ): Promise<LLMInferenceResult> {
    this.outputChannel.appendLine(
      `[Inference] LLM: model=${modelPath}, messages=${messages.length}, maxTokens=${maxTokens}`
    );

    const result = await this.bridge.fetch<{
      response: string;
      tokens_per_sec: number;
      ttft_ms: number;
      total_tokens: number;
      prompt_tokens: number;
      completion_tokens: number;
      model_name: string;
    }>('/inference/llm', 'POST', {
      model_path: modelPath,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: maxTokens,
    });

    this.outputChannel.appendLine(
      `[Inference] LLM result: ${result.completion_tokens} tokens, ` +
      `TPS=${result.tokens_per_sec.toFixed(1)}, TTFT=${result.ttft_ms.toFixed(0)}ms`
    );

    return result;
  }
}
