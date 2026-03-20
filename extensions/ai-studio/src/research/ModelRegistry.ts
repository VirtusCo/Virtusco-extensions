// Copyright 2026 VirtusCo
// Curated model registry — vision and LLM models for Porter robot deployment

export type ModelTask = 'detection' | 'llm' | 'rl';
export type HailoCompat = 'native' | 'compilable' | 'unsupported';

export interface ModelEntry {
  id: string;
  family: string;
  task: ModelTask;
  params_M: number;
  hailo_compat: HailoCompat;
  rpi_cpu_compat: boolean;
  map50_coco: number;
  hailo_fps: number;
  rpi_fps: number;
  vram_train_gb: number;
  notes: string;
  recommended_for: string[];
}

// ── Curated Model Catalog ──────────────────────────────────────────

const MODEL_CATALOG: ModelEntry[] = [
  // ── Vision: Detection ────────────────────────────────────────────
  {
    id: 'yolov8n',
    family: 'YOLOv8',
    task: 'detection',
    params_M: 3.2,
    hailo_compat: 'native',
    rpi_cpu_compat: true,
    map50_coco: 37.3,
    hailo_fps: 120,
    rpi_fps: 8,
    vram_train_gb: 2.5,
    notes:
      'Smallest YOLOv8 variant. Native HEF export via Hailo Model Zoo. ' +
      'Best latency-to-accuracy trade-off for real-time luggage detection on Hailo-10H.',
    recommended_for: ['hailo-detection', 'low-vram-training'],
  },
  {
    id: 'yolov8s',
    family: 'YOLOv8',
    task: 'detection',
    params_M: 11.2,
    hailo_compat: 'native',
    rpi_cpu_compat: true,
    map50_coco: 44.9,
    hailo_fps: 65,
    rpi_fps: 3,
    vram_train_gb: 4.0,
    notes:
      'Mid-range YOLOv8 variant with significantly better accuracy. ' +
      'Native Hailo support. Good choice when accuracy matters more than framerate.',
    recommended_for: ['hailo-detection', 'accuracy-priority'],
  },
  {
    id: 'yolov10n',
    family: 'YOLOv10',
    task: 'detection',
    params_M: 2.7,
    hailo_compat: 'compilable',
    rpi_cpu_compat: true,
    map50_coco: 38.5,
    hailo_fps: 90,
    rpi_fps: 7,
    vram_train_gb: 2.8,
    notes:
      'NMS-free architecture eliminates post-processing overhead. ' +
      'Requires manual ONNX-to-HEF compilation via Hailo DFC. Slightly better mAP than YOLOv8n.',
    recommended_for: ['low-latency-detection'],
  },
  {
    id: 'mobilenetv3-ssd',
    family: 'MobileNetV3',
    task: 'detection',
    params_M: 3.4,
    hailo_compat: 'native',
    rpi_cpu_compat: true,
    map50_coco: 22.0,
    hailo_fps: 150,
    rpi_fps: 12,
    vram_train_gb: 2.0,
    notes:
      'Lightweight MobileNetV3 backbone with SSD detection head. ' +
      'Highest FPS on both Hailo and RPi CPU but lowest accuracy. ' +
      'Best for simple binary detection (person/luggage) when speed is critical.',
    recommended_for: ['rpi-cpu-detection', 'max-fps'],
  },

  // ── LLM ──────────────────────────────────────────────────────────
  {
    id: 'qwen2.5-1.5b',
    family: 'Qwen2.5',
    task: 'llm',
    params_M: 1500,
    hailo_compat: 'unsupported',
    rpi_cpu_compat: true,
    map50_coco: 0,
    hailo_fps: 0,
    rpi_fps: 0,
    vram_train_gb: 5.5,
    notes:
      'Primary LLM for Porter. Excellent instruction-following at 1.5B scale. ' +
      'Q4_K_M GGUF runs at ~8 tok/s on RPi 5 CPU. ' +
      'Best tool-use compliance among sub-2B models after LoRA fine-tuning.',
    recommended_for: ['porter-llm', 'tool-use', 'airport-qa'],
  },
  {
    id: 'qwen2-1.5b',
    family: 'Qwen2',
    task: 'llm',
    params_M: 1500,
    hailo_compat: 'unsupported',
    rpi_cpu_compat: true,
    map50_coco: 0,
    hailo_fps: 0,
    rpi_fps: 0,
    vram_train_gb: 5.0,
    notes:
      'Previous-generation Qwen model. Slightly worse instruction-following than 2.5 ' +
      'but still viable. Useful as a baseline comparison for fine-tuning experiments.',
    recommended_for: ['baseline-comparison'],
  },
  {
    id: 'deepseek-r1-1.5b',
    family: 'DeepSeek-R1',
    task: 'llm',
    params_M: 1500,
    hailo_compat: 'unsupported',
    rpi_cpu_compat: true,
    map50_coco: 0,
    hailo_fps: 0,
    rpi_fps: 0,
    vram_train_gb: 5.5,
    notes:
      'Reasoning-focused model. Better at multi-step logical queries but verbose ' +
      'for simple Q&A. Higher latency due to chain-of-thought generation. ' +
      'Consider for operator/diagnostic mode where reasoning depth matters.',
    recommended_for: ['reasoning', 'operator-mode'],
  },
  {
    id: 'llama-3.2-1b',
    family: 'Llama 3.2',
    task: 'llm',
    params_M: 1000,
    hailo_compat: 'unsupported',
    rpi_cpu_compat: true,
    map50_coco: 0,
    hailo_fps: 0,
    rpi_fps: 0,
    vram_train_gb: 4.0,
    notes:
      'Smallest Llama 3.2 variant. Fastest inference due to 1B params but ' +
      'noticeably worse instruction-following than 1.5B models. ' +
      'Good for latency-critical voice command interpretation.',
    recommended_for: ['voice-commands', 'min-latency-llm'],
  },
];

// ── Scoring weights for autoRecommend ──────────────────────────────

const WEIGHT_ACCURACY = 0.4;
const WEIGHT_LATENCY = 0.4;
const WEIGHT_VRAM = 0.2;

// ── Public API ─────────────────────────────────────────────────────

export class ModelRegistry {
  /**
   * Returns all models in the catalog.
   */
  static getAll(): ModelEntry[] {
    return [...MODEL_CATALOG];
  }

  /**
   * Returns models filtered by task type.
   */
  static getByTask(task: ModelTask): ModelEntry[] {
    return MODEL_CATALOG.filter((m) => m.task === task);
  }

  /**
   * Returns a single model by its unique ID, or undefined if not found.
   */
  static getById(id: string): ModelEntry | undefined {
    return MODEL_CATALOG.find((m) => m.id === id);
  }

  /**
   * Auto-recommends the top 3 models for a given task and deployment target.
   *
   * Scoring formula:
   *   accuracy (40%) + latency (40%) + VRAM cost (20%)
   *
   * For detection models:
   *   accuracy  = map50_coco normalized to [0, 1] within candidates
   *   latency   = fps on target normalized to [0, 1]
   *   vram_cost = inverted vram_train_gb normalized to [0, 1] (lower = better)
   *
   * For LLM models:
   *   accuracy  = inverse params_M rank (more params = better quality proxy)
   *   latency   = inverse params_M rank (fewer params = faster inference)
   *   vram_cost = inverted vram_train_gb
   */
  static autoRecommend(
    task: ModelTask,
    target: 'hailo' | 'rpi_cpu'
  ): ModelEntry[] {
    const candidates = MODEL_CATALOG.filter((m) => m.task === task);
    if (candidates.length === 0) {
      return [];
    }

    // Compute raw values for normalization
    const scored = candidates.map((model) => {
      let accuracyRaw: number;
      let latencyRaw: number;
      const vramRaw = model.vram_train_gb;

      if (task === 'detection') {
        accuracyRaw = model.map50_coco;
        latencyRaw = target === 'hailo' ? model.hailo_fps : model.rpi_fps;
      } else {
        // LLM: more params generally = better quality
        accuracyRaw = model.params_M;
        // LLM: fewer params = faster, so invert
        latencyRaw = 1 / Math.max(model.params_M, 1);
      }

      return { model, accuracyRaw, latencyRaw, vramRaw };
    });

    // Min-max normalization helpers
    const accValues = scored.map((s) => s.accuracyRaw);
    const latValues = scored.map((s) => s.latencyRaw);
    const vramValues = scored.map((s) => s.vramRaw);

    const normalize = (val: number, arr: number[]): number => {
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      if (max === min) return 1;
      return (val - min) / (max - min);
    };

    const results = scored.map((s) => {
      const accNorm = normalize(s.accuracyRaw, accValues);
      const latNorm = normalize(s.latencyRaw, latValues);
      // Lower VRAM is better, so invert
      const vramNorm = 1 - normalize(s.vramRaw, vramValues);

      const score =
        WEIGHT_ACCURACY * accNorm +
        WEIGHT_LATENCY * latNorm +
        WEIGHT_VRAM * vramNorm;

      return { model: s.model, score };
    });

    // Sort descending by score, return top 3
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 3).map((r) => r.model);
  }
}
