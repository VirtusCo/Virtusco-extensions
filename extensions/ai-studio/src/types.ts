// Copyright 2026 VirtusCo
// Shared type definitions for Virtus AI Studio

// ── Hardware State ──────────────────────────────────────────────────

export interface GpuState {
  name: string;
  vram_total_mb: number;
  vram_used_mb: number;
  vram_free_mb: number;
  power_draw_w: number;
  power_limit_w: number;
  gpu_util_pct: number;
  is_throttled: boolean; // power_draw > 0.92 * power_limit
  temperature_c: number;
}

export interface HailoState {
  hailo_rt_version: string | null;
  hailo_ollama_running: boolean;
  loaded_models: string[];
  tops_available: number;
  llm_tps: number | null;
  vision_fps: number | null;
}

// ── Training & Recommendations ──────────────────────────────────────

export type FineTuneMethod = 'full' | 'lora' | 'qlora';

export interface FineTuneRecommendation {
  method: FineTuneMethod;
  dtype: string;
  lora_r: number | null;
  reason: string;
}

// ── Connection ──────────────────────────────────────────────────────

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
}

// ── Training Metrics & Runs ─────────────────────────────────────────

export interface TrainingMetric {
  step: number;
  loss: number;
  eval_loss: number;
  learning_rate: number;
  epoch: number;
  eta_seconds: number;
  gpu_vram_used_mb: number;
  gpu_power_w: number;
  is_throttled: boolean;
}

export type RunType = 'vision' | 'llm' | 'rl';

export interface RunRecord {
  run_id: string;
  type: RunType;
  model_name: string;
  config: Record<string, string | number | boolean>;
  metrics: Record<string, number>;
  artifacts: Record<string, string>;
  timestamp: string;
}

// ── RPi Info ────────────────────────────────────────────────────────

export interface RpiInfo {
  hostname: string;
  os: string;
  cpu_temp: number;
  mem_total: number;
  mem_available: number;
}

// ── Training Config ─────────────────────────────────────────────────

export interface TrainingConfig {
  model_name: string;
  run_type: RunType;
  dataset_path: string;
  epochs: number;
  batch_size: number;
  learning_rate: number;
  method: FineTuneMethod;
  dtype: string;
  lora_r: number | null;
}

export interface ExportConfig {
  run_id: string;
  format: 'onnx' | 'tflite' | 'hef';
  quantize: boolean;
}

export interface DeployConfig {
  run_id: string;
  artifact_path: string;
  remote_path: string;
  service_name: string;
}

export interface InferenceRequest {
  model_path: string;
  input_text: string;
  max_tokens: number;
}

// ── Dataset Types ─────────────────────────────────────────────────────

export interface VisionDatasetStats {
  path: string;
  numClasses: number;
  classNames: string[];
  splits: { train: number; val: number; test: number };
  totalImages: number;
  totalInstances: number;
  instancesPerClass: Record<string, number>;
  missingLabels: string[];
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type LLMMode = 'passenger' | 'voice_command' | 'multilingual' | 'operator';

export interface LLMPair {
  mode: LLMMode;
  userMessage: string;
  assistantResponse: string;
  language?: string;
}

export interface QualityIssue {
  severity: 'error' | 'warning';
  message: string;
  pairIndex?: number;
}

export interface DatasetBuildResult {
  outputPath: string;
  totalPairs: number;
  pairsPerMode: Record<string, number>;
  avgResponseTokens: number;
  qualityIssues: QualityIssue[];
}

// ── Message Protocol: Webview → Host ────────────────────────────────

export type WebviewMessage =
  | { type: 'probeGpu' }
  | { type: 'connectRpi'; config: SSHConfig }
  | { type: 'startTraining'; config: TrainingConfig }
  | { type: 'cancelTraining'; run_id: string }
  | { type: 'startExport'; config: ExportConfig }
  | { type: 'deployModel'; config: DeployConfig }
  | { type: 'runInference'; request: InferenceRequest }
  | { type: 'getRunHistory' }
  | { type: 'navigateTo'; view: string }
  | { type: 'scanDataset'; datasetPath: string }
  | { type: 'validateDataset'; datasetPath: string }
  | { type: 'buildJsonl'; pairs: LLMPair[]; outputPath: string };

// ── Message Protocol: Host → Webview ────────────────────────────────

export type HostMessage =
  | { type: 'gpuUpdate'; state: GpuState }
  | { type: 'hailoUpdate'; state: HailoState }
  | { type: 'trainingMetric'; metric: TrainingMetric }
  | { type: 'trainingDone'; run_id: string; summary: Record<string, number> }
  | { type: 'trainingError'; run_id: string; error: string }
  | { type: 'exportStep'; run_id: string; step: string; progress: number }
  | { type: 'exportDone'; run_id: string; artifact_path: string }
  | { type: 'inferenceResult'; output: string; tokens_per_second: number }
  | { type: 'deployProgress'; stage: string; progress: number }
  | { type: 'serviceStatus'; service: string; active: boolean; uptime_seconds: number }
  | { type: 'runHistory'; runs: RunRecord[] }
  | { type: 'vramRecommendation'; recommendation: FineTuneRecommendation }
  | { type: 'visionStats'; stats: VisionDatasetStats }
  | { type: 'visionValidation'; result: ValidationResult }
  | { type: 'llmBuildResult'; result: DatasetBuildResult };
