// Copyright 2026 VirtusCo
// Model research page — curated registry, auto-recommend, compatibility matrix

import React, { useState, useMemo } from "react";
import { vscode } from "../vscodeApi";

// ── Types (mirrored from ModelRegistry.ts for webview bundle) ──────

type ModelTask = "detection" | "llm" | "rl";
type HailoCompat = "native" | "compilable" | "unsupported";

interface ModelEntry {
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

// ── Curated catalog (mirrors host-side ModelRegistry) ──────────────

const MODEL_CATALOG: ModelEntry[] = [
  {
    id: "yolov8n",
    family: "YOLOv8",
    task: "detection",
    params_M: 3.2,
    hailo_compat: "native",
    rpi_cpu_compat: true,
    map50_coco: 37.3,
    hailo_fps: 120,
    rpi_fps: 8,
    vram_train_gb: 2.5,
    notes:
      "Smallest YOLOv8 variant. Native HEF export via Hailo Model Zoo. " +
      "Best latency-to-accuracy trade-off for real-time luggage detection on Hailo-10H.",
    recommended_for: ["hailo-detection", "low-vram-training"],
  },
  {
    id: "yolov8s",
    family: "YOLOv8",
    task: "detection",
    params_M: 11.2,
    hailo_compat: "native",
    rpi_cpu_compat: true,
    map50_coco: 44.9,
    hailo_fps: 65,
    rpi_fps: 3,
    vram_train_gb: 4.0,
    notes:
      "Mid-range YOLOv8 variant with significantly better accuracy. " +
      "Native Hailo support. Good choice when accuracy matters more than framerate.",
    recommended_for: ["hailo-detection", "accuracy-priority"],
  },
  {
    id: "yolov10n",
    family: "YOLOv10",
    task: "detection",
    params_M: 2.7,
    hailo_compat: "compilable",
    rpi_cpu_compat: true,
    map50_coco: 38.5,
    hailo_fps: 90,
    rpi_fps: 7,
    vram_train_gb: 2.8,
    notes:
      "NMS-free architecture eliminates post-processing overhead. " +
      "Requires manual ONNX-to-HEF compilation via Hailo DFC. Slightly better mAP than YOLOv8n.",
    recommended_for: ["low-latency-detection"],
  },
  {
    id: "mobilenetv3-ssd",
    family: "MobileNetV3",
    task: "detection",
    params_M: 3.4,
    hailo_compat: "native",
    rpi_cpu_compat: true,
    map50_coco: 22.0,
    hailo_fps: 150,
    rpi_fps: 12,
    vram_train_gb: 2.0,
    notes:
      "Lightweight MobileNetV3 backbone with SSD detection head. " +
      "Highest FPS on both Hailo and RPi CPU but lowest accuracy. " +
      "Best for simple binary detection (person/luggage) when speed is critical.",
    recommended_for: ["rpi-cpu-detection", "max-fps"],
  },
  {
    id: "qwen2.5-1.5b",
    family: "Qwen2.5",
    task: "llm",
    params_M: 1500,
    hailo_compat: "unsupported",
    rpi_cpu_compat: true,
    map50_coco: 0,
    hailo_fps: 0,
    rpi_fps: 0,
    vram_train_gb: 5.5,
    notes:
      "Primary LLM for Porter. Excellent instruction-following at 1.5B scale. " +
      "Q4_K_M GGUF runs at ~8 tok/s on RPi 5 CPU. " +
      "Best tool-use compliance among sub-2B models after LoRA fine-tuning.",
    recommended_for: ["porter-llm", "tool-use", "airport-qa"],
  },
  {
    id: "qwen2-1.5b",
    family: "Qwen2",
    task: "llm",
    params_M: 1500,
    hailo_compat: "unsupported",
    rpi_cpu_compat: true,
    map50_coco: 0,
    hailo_fps: 0,
    rpi_fps: 0,
    vram_train_gb: 5.0,
    notes:
      "Previous-generation Qwen model. Slightly worse instruction-following than 2.5 " +
      "but still viable. Useful as a baseline comparison for fine-tuning experiments.",
    recommended_for: ["baseline-comparison"],
  },
  {
    id: "deepseek-r1-1.5b",
    family: "DeepSeek-R1",
    task: "llm",
    params_M: 1500,
    hailo_compat: "unsupported",
    rpi_cpu_compat: true,
    map50_coco: 0,
    hailo_fps: 0,
    rpi_fps: 0,
    vram_train_gb: 5.5,
    notes:
      "Reasoning-focused model. Better at multi-step logical queries but verbose " +
      "for simple Q&A. Higher latency due to chain-of-thought generation. " +
      "Consider for operator/diagnostic mode where reasoning depth matters.",
    recommended_for: ["reasoning", "operator-mode"],
  },
  {
    id: "llama-3.2-1b",
    family: "Llama 3.2",
    task: "llm",
    params_M: 1000,
    hailo_compat: "unsupported",
    rpi_cpu_compat: true,
    map50_coco: 0,
    hailo_fps: 0,
    rpi_fps: 0,
    vram_train_gb: 4.0,
    notes:
      "Smallest Llama 3.2 variant. Fastest inference due to 1B params but " +
      "noticeably worse instruction-following than 1.5B models. " +
      "Good for latency-critical voice command interpretation.",
    recommended_for: ["voice-commands", "min-latency-llm"],
  },
];

// ── Auto-recommend scoring ─────────────────────────────────────────

function autoRecommend(
  task: ModelTask,
  target: "hailo" | "rpi_cpu"
): Set<string> {
  const candidates = MODEL_CATALOG.filter((m) => m.task === task);
  if (candidates.length === 0) return new Set();

  const scored = candidates.map((model) => {
    let accuracyRaw: number;
    let latencyRaw: number;
    const vramRaw = model.vram_train_gb;

    if (task === "detection") {
      accuracyRaw = model.map50_coco;
      latencyRaw = target === "hailo" ? model.hailo_fps : model.rpi_fps;
    } else {
      accuracyRaw = model.params_M;
      latencyRaw = 1 / Math.max(model.params_M, 1);
    }

    return { model, accuracyRaw, latencyRaw, vramRaw };
  });

  const normalize = (val: number, arr: number[]): number => {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    if (max === min) return 1;
    return (val - min) / (max - min);
  };

  const accVals = scored.map((s) => s.accuracyRaw);
  const latVals = scored.map((s) => s.latencyRaw);
  const vramVals = scored.map((s) => s.vramRaw);

  const results = scored.map((s) => {
    const accNorm = normalize(s.accuracyRaw, accVals);
    const latNorm = normalize(s.latencyRaw, latVals);
    const vramNorm = 1 - normalize(s.vramRaw, vramVals);
    const score = 0.4 * accNorm + 0.4 * latNorm + 0.2 * vramNorm;
    return { id: s.model.id, score };
  });

  results.sort((a, b) => b.score - a.score);
  return new Set(results.slice(0, 3).map((r) => r.id));
}

// ── Styles ──────────────────────────────────────────────────────────

const HAILO_COLORS: Record<HailoCompat, string> = {
  native: "#4caf50",
  compilable: "#ff9800",
  unsupported: "#f44336",
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    maxWidth: "1200px",
  },
  toolbar: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap" as const,
  },
  select: {
    padding: "6px 10px",
    fontSize: "13px",
    border: "1px solid var(--vscode-input-border, rgba(255,255,255,0.15))",
    borderRadius: "4px",
    background: "var(--vscode-input-background)",
    color: "var(--vscode-input-foreground, var(--vscode-foreground))",
    fontFamily: "inherit",
    outline: "none",
    cursor: "pointer",
  },
  toggleGroup: {
    display: "flex",
    borderRadius: "4px",
    overflow: "hidden" as const,
    border: "1px solid var(--vscode-input-border, rgba(255,255,255,0.15))",
  },
  toggleBtn: (active: boolean) => ({
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 600 as const,
    border: "none",
    cursor: "pointer",
    background: active
      ? "var(--vscode-button-background)"
      : "var(--vscode-input-background)",
    color: active
      ? "var(--vscode-button-foreground)"
      : "var(--vscode-foreground)",
    fontFamily: "inherit",
  }),
  button: {
    padding: "6px 16px",
    fontSize: "12px",
    fontWeight: 600 as const,
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    background: "var(--vscode-button-background)",
    color: "var(--vscode-button-foreground)",
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "13px",
  },
  th: {
    textAlign: "left" as const,
    padding: "8px 10px",
    fontSize: "11px",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    color: "var(--vscode-descriptionForeground)",
    borderBottom: "2px solid var(--vscode-panel-border, rgba(255,255,255,0.12))",
    whiteSpace: "nowrap" as const,
  },
  td: {
    padding: "8px 10px",
    borderBottom: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.06))",
    color: "var(--vscode-foreground)",
    verticalAlign: "top" as const,
  },
  row: (highlighted: boolean, expanded: boolean) => ({
    cursor: "pointer",
    background: highlighted
      ? "rgba(0, 122, 204, 0.12)"
      : expanded
        ? "rgba(255, 255, 255, 0.03)"
        : "transparent",
    transition: "background 0.15s ease",
  }),
  badge: (color: string) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "11px",
    fontWeight: 700 as const,
    color: "#fff",
    background: color,
    textTransform: "capitalize" as const,
    letterSpacing: "0.3px",
  }),
  checkMark: {
    color: "#4caf50",
    fontWeight: 700 as const,
    fontSize: "14px",
  },
  crossMark: {
    color: "#f44336",
    fontWeight: 700 as const,
    fontSize: "14px",
  },
  expandRow: {
    padding: "12px 10px 16px 20px",
    borderBottom: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.06))",
    background: "rgba(255, 255, 255, 0.02)",
  },
  notesText: {
    fontSize: "12px",
    color: "var(--vscode-descriptionForeground)",
    lineHeight: "1.6",
    maxWidth: "800px",
  },
  tagList: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap" as const,
    marginTop: "8px",
  },
  tag: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600 as const,
    background: "rgba(0, 122, 204, 0.15)",
    color: "var(--vscode-focusBorder, #007acc)",
  },
  recommendBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "1px 8px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: 700 as const,
    background: "rgba(255, 193, 7, 0.2)",
    color: "#ffc107",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
};

// ── Component ──────────────────────────────────────────────────────

type TaskFilter = "all" | ModelTask;

const ResearchPage: React.FC = () => {
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [deployTarget, setDeployTarget] = useState<"hailo" | "rpi_cpu">("hailo");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());

  // Filter models by task
  const filteredModels = useMemo(() => {
    const models =
      taskFilter === "all"
        ? [...MODEL_CATALOG]
        : MODEL_CATALOG.filter((m) => m.task === taskFilter);

    // Sort by best fit for deploy target
    models.sort((a, b) => {
      if (a.task !== b.task) {
        // Group by task: detection first, then llm
        const order: Record<string, number> = { detection: 0, llm: 1, rl: 2 };
        return (order[a.task] ?? 9) - (order[b.task] ?? 9);
      }

      if (a.task === "detection") {
        const aFps = deployTarget === "hailo" ? a.hailo_fps : a.rpi_fps;
        const bFps = deployTarget === "hailo" ? b.hailo_fps : b.rpi_fps;
        return bFps - aFps;
      }

      // LLMs: sort by VRAM (lower = more accessible)
      return a.vram_train_gb - b.vram_train_gb;
    });

    return models;
  }, [taskFilter, deployTarget]);

  const handleAutoRecommend = () => {
    const task: ModelTask = taskFilter === "all" ? "detection" : taskFilter;
    const ids = autoRecommend(task, deployTarget);
    setRecommendedIds(ids);
  };

  const handleRowClick = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <select
          style={styles.select}
          value={taskFilter}
          onChange={(e) => {
            setTaskFilter(e.target.value as TaskFilter);
            setRecommendedIds(new Set());
          }}
        >
          <option value="all">All Tasks</option>
          <option value="detection">Detection</option>
          <option value="llm">LLM</option>
          <option value="rl">RL</option>
        </select>

        <div style={styles.toggleGroup}>
          <button
            style={styles.toggleBtn(deployTarget === "hailo")}
            onClick={() => setDeployTarget("hailo")}
          >
            Hailo
          </button>
          <button
            style={styles.toggleBtn(deployTarget === "rpi_cpu")}
            onClick={() => setDeployTarget("rpi_cpu")}
          >
            RPi CPU
          </button>
        </div>

        <button style={styles.button} onClick={handleAutoRecommend}>
          Auto-Recommend
        </button>

        {recommendedIds.size > 0 && (
          <span
            style={{
              fontSize: "12px",
              color: "var(--vscode-descriptionForeground)",
              fontStyle: "italic",
            }}
          >
            Top 3 highlighted for{" "}
            {taskFilter === "all" ? "detection" : taskFilter} on{" "}
            {deployTarget === "hailo" ? "Hailo" : "RPi CPU"}
          </span>
        )}
      </div>

      {/* Model Table */}
      <div
        style={{
          border: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.1))",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Params</th>
              <th style={styles.th}>Hailo</th>
              <th style={styles.th}>RPi CPU</th>
              <th style={styles.th}>Accuracy</th>
              <th style={styles.th}>FPS</th>
              <th style={styles.th}>VRAM</th>
              <th style={{ ...styles.th, width: "1px" }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredModels.map((model) => {
              const isHighlighted = recommendedIds.has(model.id);
              const isExpanded = expandedId === model.id;
              const fps =
                deployTarget === "hailo" ? model.hailo_fps : model.rpi_fps;
              const accuracy =
                model.task === "detection"
                  ? `${model.map50_coco.toFixed(1)} mAP50`
                  : "N/A";

              return (
                <React.Fragment key={model.id}>
                  <tr
                    style={styles.row(isHighlighted, isExpanded)}
                    onClick={() => handleRowClick(model.id)}
                    onMouseOver={(e) => {
                      if (!isHighlighted) {
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          "rgba(255, 255, 255, 0.04)";
                      }
                    }}
                    onMouseOut={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        isHighlighted
                          ? "rgba(0, 122, 204, 0.12)"
                          : isExpanded
                            ? "rgba(255, 255, 255, 0.03)"
                            : "transparent";
                    }}
                  >
                    <td style={styles.td}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{model.id}</span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--vscode-descriptionForeground)",
                          }}
                        >
                          {model.family}
                        </span>
                        {isHighlighted && (
                          <span style={styles.recommendBadge}>
                            &#x2605; recommended
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {model.params_M >= 1000
                        ? `${(model.params_M / 1000).toFixed(1)}B`
                        : `${model.params_M}M`}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge(HAILO_COLORS[model.hailo_compat])}>
                        {model.hailo_compat}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {model.rpi_cpu_compat ? (
                        <span style={styles.checkMark}>&#10003;</span>
                      ) : (
                        <span style={styles.crossMark}>&#10007;</span>
                      )}
                    </td>
                    <td style={styles.td}>{accuracy}</td>
                    <td style={styles.td}>
                      {model.task === "detection" ? (
                        <span style={{ fontFamily: "monospace" }}>{fps}</span>
                      ) : (
                        <span
                          style={{
                            color: "var(--vscode-descriptionForeground)",
                          }}
                        >
                          --
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontFamily: "monospace" }}>
                        {model.vram_train_gb.toFixed(1)} GB
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--vscode-descriptionForeground)",
                          transition: "transform 0.2s ease",
                          display: "inline-block",
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        }}
                      >
                        &#x25B6;
                      </span>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} style={styles.expandRow}>
                        <div style={styles.notesText}>{model.notes}</div>
                        {model.recommended_for.length > 0 && (
                          <div style={styles.tagList}>
                            {model.recommended_for.map((tag) => (
                              <span key={tag} style={styles.tag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {filteredModels.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    ...styles.td,
                    textAlign: "center",
                    padding: "32px",
                    color: "var(--vscode-descriptionForeground)",
                  }}
                >
                  No models found for this task filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResearchPage;
