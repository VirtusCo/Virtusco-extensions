// Copyright 2026 VirtusCo
// Zustand store for Virtus AI Studio webview state

import { create } from "zustand";

// ── Types (duplicated from host — webview is a separate bundle) ─────

export interface GpuState {
  name: string;
  vram_total_mb: number;
  vram_used_mb: number;
  vram_free_mb: number;
  power_draw_w: number;
  power_limit_w: number;
  gpu_util_pct: number;
  is_throttled: boolean;
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

export type FineTuneMethod = "full" | "lora" | "qlora";

export interface FineTuneRecommendation {
  method: FineTuneMethod;
  dtype: string;
  lora_r: number | null;
  reason: string;
}

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

export interface RpiInfo {
  hostname: string;
  cpu_temp: number;
  mem_total_mb: number;
  mem_available_mb: number;
}

// ── Dataset Types ──────────────────────────────────────────────────

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

export type LLMMode = "passenger" | "voice_command" | "multilingual" | "operator";

export interface LLMPair {
  mode: LLMMode;
  userMessage: string;
  assistantResponse: string;
  language?: string;
}

export interface QualityIssue {
  severity: "error" | "warning";
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

// ── Store ───────────────────────────────────────────────────────────

export type PageId =
  | "dashboard"
  | "dataset"
  | "research"
  | "training"
  | "benchmark"
  | "export"
  | "inference"
  | "deploy";

export type TrainingStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface AIStudioStore {
  activePage: PageId;
  gpuState: GpuState | null;
  hailoState: HailoState | null;
  rpiConnected: boolean;
  rpiInfo: RpiInfo | null;
  vramRecommendation: FineTuneRecommendation | null;
  trainingStatus: TrainingStatus;
  trainingMetrics: TrainingMetric[];
  activeJobId: string | null;

  // Dataset state
  visionStats: VisionDatasetStats | null;
  visionValidation: ValidationResult | null;
  llmPairs: LLMPair[];
  llmBuildResult: DatasetBuildResult | null;
  activeDatasetTab: "vision" | "llm";
  activeLlmMode: LLMMode;

  setActivePage: (page: PageId) => void;
  setGpuState: (state: GpuState) => void;
  setHailoState: (state: HailoState) => void;
  setRpiConnected: (connected: boolean, info?: RpiInfo) => void;
  setVramRecommendation: (rec: FineTuneRecommendation) => void;
  addTrainingMetric: (metric: TrainingMetric) => void;
  setTrainingStatus: (status: TrainingStatus) => void;
  setActiveJobId: (id: string | null) => void;

  // Dataset actions
  setVisionStats: (stats: VisionDatasetStats | null) => void;
  setVisionValidation: (result: ValidationResult | null) => void;
  addLlmPair: (pair: LLMPair) => void;
  removeLlmPair: (index: number) => void;
  updateLlmPair: (index: number, pair: LLMPair) => void;
  setLlmBuildResult: (result: DatasetBuildResult | null) => void;
  setActiveDatasetTab: (tab: "vision" | "llm") => void;
  setActiveLlmMode: (mode: LLMMode) => void;
}

export const useAIStudioStore = create<AIStudioStore>((set) => ({
  activePage: "dashboard",
  gpuState: null,
  hailoState: null,
  rpiConnected: false,
  rpiInfo: null,
  vramRecommendation: null,
  trainingStatus: "idle",
  trainingMetrics: [],
  activeJobId: null,

  // Dataset state
  visionStats: null,
  visionValidation: null,
  llmPairs: [],
  llmBuildResult: null,
  activeDatasetTab: "vision",
  activeLlmMode: "passenger",

  setActivePage: (page) => set({ activePage: page }),
  setGpuState: (state) => set({ gpuState: state }),
  setHailoState: (state) => set({ hailoState: state }),
  setRpiConnected: (connected, info) =>
    set({ rpiConnected: connected, rpiInfo: info ?? null }),
  setVramRecommendation: (rec) => set({ vramRecommendation: rec }),
  addTrainingMetric: (metric) =>
    set((s) => ({ trainingMetrics: [...s.trainingMetrics, metric] })),
  setTrainingStatus: (status) => set({ trainingStatus: status }),
  setActiveJobId: (id) => set({ activeJobId: id }),

  // Dataset actions
  setVisionStats: (stats) => set({ visionStats: stats }),
  setVisionValidation: (result) => set({ visionValidation: result }),
  addLlmPair: (pair) =>
    set((s) => ({ llmPairs: [...s.llmPairs, pair] })),
  removeLlmPair: (index) =>
    set((s) => ({ llmPairs: s.llmPairs.filter((_, i) => i !== index) })),
  updateLlmPair: (index, pair) =>
    set((s) => ({
      llmPairs: s.llmPairs.map((p, i) => (i === index ? pair : p)),
    })),
  setLlmBuildResult: (result) => set({ llmBuildResult: result }),
  setActiveDatasetTab: (tab) => set({ activeDatasetTab: tab }),
  setActiveLlmMode: (mode) => set({ activeLlmMode: mode }),
}));
