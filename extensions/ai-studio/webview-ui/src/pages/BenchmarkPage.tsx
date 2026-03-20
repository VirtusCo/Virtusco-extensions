// Copyright 2026 VirtusCo
// Benchmark page — run history, multi-run comparison, scatter plot

import React, { useState, useEffect } from "react";
import { vscode } from "../vscodeApi";

// ── Types ───────────────────────────────────────────────────────────

type BenchmarkModelType = "vision" | "llm" | "rl";

interface BenchmarkResult {
  run_id: string;
  model_type: BenchmarkModelType;
  model_name: string;
  model_path: string;
  map50?: number;
  map50_95?: number;
  fps_onnx?: number;
  perplexity?: number;
  tokens_per_sec?: number;
  ttft_ms?: number;
  mean_reward?: number;
  std_reward?: number;
  mean_episode_length?: number;
  timestamp: string;
  duration_seconds?: number;
  notes?: string;
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    maxWidth: "1200px",
  },
  card: {
    background: "var(--vscode-editor-background)",
    border: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.1))",
    borderRadius: "6px",
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  cardTitle: {
    fontSize: "13px",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.6px",
    color: "var(--vscode-foreground)",
    margin: "0 0 4px 0",
    borderBottom: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.08))",
    paddingBottom: "8px",
  },
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
  buttonSecondary: {
    padding: "6px 16px",
    fontSize: "12px",
    fontWeight: 600 as const,
    border: "1px solid var(--vscode-button-background)",
    borderRadius: "4px",
    cursor: "pointer",
    background: "transparent",
    color: "var(--vscode-button-background)",
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
  },
  input: {
    flex: 1,
    padding: "6px 10px",
    fontSize: "13px",
    border: "1px solid var(--vscode-input-border, rgba(255,255,255,0.15))",
    borderRadius: "4px",
    background: "var(--vscode-input-background)",
    color: "var(--vscode-input-foreground, var(--vscode-foreground))",
    fontFamily: "inherit",
    outline: "none",
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
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "12px",
  },
  th: {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.15))",
    color: "var(--vscode-descriptionForeground)",
    fontWeight: 600 as const,
    fontSize: "11px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  td: {
    padding: "8px 10px",
    borderBottom: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.05))",
    color: "var(--vscode-foreground)",
  },
  row: (expanded: boolean) => ({
    cursor: "pointer",
    background: expanded
      ? "var(--vscode-list-activeSelectionBackground, rgba(255,255,255,0.06))"
      : "transparent",
    transition: "background 0.1s ease",
  }),
  badge: (type: BenchmarkModelType) => {
    const colors: Record<BenchmarkModelType, { bg: string; fg: string }> = {
      vision: { bg: "rgba(0,122,204,0.2)", fg: "#4da6ff" },
      llm: { bg: "rgba(155,89,182,0.2)", fg: "#c39bd3" },
      rl: { bg: "rgba(46,204,113,0.2)", fg: "#2ecc71" },
    };
    const c = colors[type];
    return {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "10px",
      fontSize: "11px",
      fontWeight: 600 as const,
      background: c.bg,
      color: c.fg,
    };
  },
  delta: (positive: boolean) => ({
    fontSize: "11px",
    fontWeight: 600 as const,
    color: positive ? "#2ecc71" : "#e74c3c",
  }),
  expandedRow: {
    background: "var(--vscode-sideBar-background, rgba(255,255,255,0.02))",
    padding: "12px 16px",
    fontSize: "12px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "8px",
  },
  metricBox: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  metricLabel: {
    fontSize: "10px",
    color: "var(--vscode-descriptionForeground)",
    textTransform: "uppercase" as const,
  },
  metricValue: {
    fontSize: "14px",
    fontWeight: 600 as const,
    color: "var(--vscode-foreground)",
  },
  scatter: {
    position: "relative" as const,
    width: "100%",
    height: "200px",
    background: "var(--vscode-input-background)",
    borderRadius: "4px",
    overflow: "hidden" as const,
  },
  scatterDot: (x: number, y: number, color: string) => ({
    position: "absolute" as const,
    left: `${x}%`,
    bottom: `${y}%`,
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: color,
    transform: "translate(-50%, 50%)",
    cursor: "pointer",
    border: "2px solid rgba(255,255,255,0.3)",
  }),
  scatterAxis: {
    position: "absolute" as const,
    fontSize: "10px",
    color: "var(--vscode-descriptionForeground)",
  },
  dialogOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  dialog: {
    background: "var(--vscode-editor-background)",
    border: "1px solid var(--vscode-panel-border)",
    borderRadius: "8px",
    padding: "24px",
    width: "400px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
  },
  dialogTitle: {
    fontSize: "15px",
    fontWeight: 700 as const,
    color: "var(--vscode-foreground)",
  },
  dialogRow: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  dialogLabel: {
    fontSize: "12px",
    fontWeight: 600 as const,
    color: "var(--vscode-descriptionForeground)",
  },
  dialogActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "8px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "8px",
    padding: "32px 16px",
    color: "var(--vscode-descriptionForeground)",
    fontSize: "13px",
  },
  gridLine: {
    position: "absolute" as const,
    background: "var(--vscode-panel-border, rgba(255,255,255,0.06))",
  },
};

// ── Helpers ─────────────────────────────────────────────────────────

function keyMetric(result: BenchmarkResult): string {
  switch (result.model_type) {
    case "vision":
      return result.map50 !== undefined ? `mAP50: ${result.map50.toFixed(4)}` : "--";
    case "llm":
      return result.tokens_per_sec !== undefined ? `${result.tokens_per_sec.toFixed(1)} TPS` : "--";
    case "rl":
      return result.mean_reward !== undefined ? `Reward: ${result.mean_reward.toFixed(2)}` : "--";
    default:
      return "--";
  }
}

function keyMetricValue(result: BenchmarkResult): number {
  switch (result.model_type) {
    case "vision":
      return result.map50 ?? 0;
    case "llm":
      return result.tokens_per_sec ?? 0;
    case "rl":
      return result.mean_reward ?? 0;
    default:
      return 0;
  }
}

function computeDelta(current: BenchmarkResult, baseline: BenchmarkResult | null): string {
  if (!baseline) { return "--"; }
  const curVal = keyMetricValue(current);
  const baseVal = keyMetricValue(baseline);
  if (baseVal === 0) { return "--"; }
  const pct = ((curVal - baseVal) / Math.abs(baseVal)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function isDeltaPositive(current: BenchmarkResult, baseline: BenchmarkResult | null): boolean {
  if (!baseline) { return true; }
  // For LLM perplexity, lower is better — but we track TPS as key metric, so higher is better
  return keyMetricValue(current) >= keyMetricValue(baseline);
}

const TYPE_COLORS: Record<BenchmarkModelType, string> = {
  vision: "#4da6ff",
  llm: "#c39bd3",
  rl: "#2ecc71",
};

// ── BenchmarkPage Component ─────────────────────────────────────────

const BenchmarkPage: React.FC = () => {
  const [history, setHistory] = useState<BenchmarkResult[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [baselineId, setBaselineId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState<BenchmarkModelType>("vision");
  const [dialogModelPath, setDialogModelPath] = useState("");
  const [dialogDataPath, setDialogDataPath] = useState("");
  const [running, setRunning] = useState(false);

  // Listen for benchmark results from the extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg.type !== "string") { return; }

      switch (msg.type) {
        case "benchmarkHistory":
          setHistory(msg.results ?? []);
          break;
        case "benchmarkResult":
          setHistory((prev) => [msg.result, ...prev]);
          setRunning(false);
          break;
        case "benchmarkError":
          setRunning(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", handler);

    // Request history on mount
    vscode.postMessage({ type: "getBenchmarkHistory" });

    return () => window.removeEventListener("message", handler);
  }, []);

  const baseline = baselineId
    ? history.find((r) => r.run_id === baselineId) ?? history[history.length - 1] ?? null
    : history[history.length - 1] ?? null;

  const handleRunBenchmark = () => {
    if (!dialogModelPath.trim()) { return; }
    setRunning(true);
    setShowDialog(false);

    vscode.postMessage({
      type: "runBenchmark",
      benchmarkType: dialogType,
      modelPath: dialogModelPath.trim(),
      dataPath: dialogDataPath.trim(),
    });
  };

  // Scatter plot data — normalize X (latency/size) and Y (accuracy)
  const scatterData = history.map((r) => {
    let x = 0;
    let y = 0;

    switch (r.model_type) {
      case "vision":
        x = r.fps_onnx ? Math.min(100, (r.fps_onnx / 200) * 100) : 50;
        y = (r.map50 ?? 0) * 100;
        break;
      case "llm":
        x = r.tokens_per_sec ? Math.min(100, (r.tokens_per_sec / 50) * 100) : 50;
        y = r.perplexity ? Math.max(0, 100 - r.perplexity) : 50;
        break;
      case "rl":
        x = r.mean_episode_length ? Math.min(100, (r.mean_episode_length / 1000) * 100) : 50;
        y = r.mean_reward ? Math.min(100, Math.max(0, ((r.mean_reward + 500) / 1000) * 100)) : 50;
        break;
    }

    return { ...r, x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
  });

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--vscode-foreground)" }}>
          Benchmark Results
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            style={styles.button}
            onClick={() => {
              setDialogModelPath("");
              setDialogDataPath("");
              setShowDialog(true);
            }}
            disabled={running}
          >
            {running ? "Running..." : "Run Benchmark"}
          </button>
          <button
            style={styles.buttonSecondary}
            onClick={() => vscode.postMessage({ type: "getBenchmarkHistory" })}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Scatter plot */}
      {scatterData.length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Performance Overview</div>
          <div style={styles.scatter}>
            {/* Grid lines */}
            {[25, 50, 75].map((pct) => (
              <React.Fragment key={`grid-${pct}`}>
                <div
                  style={{
                    ...styles.gridLine,
                    left: `${pct}%`,
                    top: 0,
                    bottom: 0,
                    width: "1px",
                  }}
                />
                <div
                  style={{
                    ...styles.gridLine,
                    bottom: `${pct}%`,
                    left: 0,
                    right: 0,
                    height: "1px",
                  }}
                />
              </React.Fragment>
            ))}
            {/* Axis labels */}
            <div style={{ ...styles.scatterAxis, bottom: "2px", left: "50%", transform: "translateX(-50%)" }}>
              Speed / Throughput
            </div>
            <div
              style={{
                ...styles.scatterAxis,
                left: "4px",
                top: "50%",
                transform: "rotate(-90deg) translateX(-50%)",
                transformOrigin: "left center",
              }}
            >
              Accuracy
            </div>
            {/* Dots */}
            {scatterData.map((d) => (
              <div
                key={d.run_id}
                style={styles.scatterDot(d.x, d.y, TYPE_COLORS[d.model_type])}
                title={`${d.model_name} (${d.model_type})`}
                onClick={() => setExpandedId(expandedId === d.run_id ? null : d.run_id)}
              />
            ))}
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
            {(["vision", "llm", "rl"] as BenchmarkModelType[]).map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px" }}>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: TYPE_COLORS[t],
                  }}
                />
                <span style={{ color: "var(--vscode-descriptionForeground)" }}>
                  {t.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History table */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Run History</div>

        {history.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "24px", opacity: 0.3 }}>{"\u2261"}</div>
            <div>No benchmark results yet.</div>
            <div style={{ fontSize: "12px" }}>Run a benchmark to see results here.</div>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Run ID</th>
                <th style={styles.th}>Model</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Key Metric</th>
                <th style={styles.th}>Delta</th>
                <th style={styles.th}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {history.map((result) => {
                const isExpanded = expandedId === result.run_id;
                const isBaseline = baseline?.run_id === result.run_id;
                const delta = isBaseline ? "baseline" : computeDelta(result, baseline);
                const positive = isDeltaPositive(result, baseline);

                return (
                  <React.Fragment key={result.run_id}>
                    <tr
                      style={styles.row(isExpanded)}
                      onClick={() => setExpandedId(isExpanded ? null : result.run_id)}
                      onMouseOver={(e) => {
                        if (!isExpanded) {
                          e.currentTarget.style.background =
                            "var(--vscode-list-hoverBackground, rgba(255,255,255,0.04))";
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isExpanded) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <td style={{ ...styles.td, fontFamily: "monospace", fontSize: "11px" }}>
                        {result.run_id.slice(0, 16)}
                      </td>
                      <td style={styles.td}>{result.model_name}</td>
                      <td style={styles.td}>
                        <span style={styles.badge(result.model_type)}>
                          {result.model_type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{keyMetric(result)}</td>
                      <td style={styles.td}>
                        {isBaseline ? (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              padding: "1px 6px",
                              borderRadius: "8px",
                              background: "rgba(255,255,255,0.08)",
                              color: "var(--vscode-descriptionForeground)",
                            }}
                          >
                            BASELINE
                          </span>
                        ) : (
                          <span style={styles.delta(positive)}>{delta}</span>
                        )}
                      </td>
                      <td style={{ ...styles.td, fontSize: "11px", color: "var(--vscode-descriptionForeground)" }}>
                        {new Date(result.timestamp).toLocaleString()}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <div style={styles.expandedRow}>
                            {result.model_type === "vision" && (
                              <>
                                <div style={styles.metricBox}>
                                  <div style={styles.metricLabel}>mAP@50</div>
                                  <div style={styles.metricValue}>{result.map50?.toFixed(4) ?? "--"}</div>
                                </div>
                                <div style={styles.metricBox}>
                                  <div style={styles.metricLabel}>mAP@50:95</div>
                                  <div style={styles.metricValue}>{result.map50_95?.toFixed(4) ?? "--"}</div>
                                </div>
                                <div style={styles.metricBox}>
                                  <div style={styles.metricLabel}>ONNX FPS</div>
                                  <div style={styles.metricValue}>{result.fps_onnx?.toFixed(1) ?? "--"}</div>
                                </div>
                              </>
                            )}
                            {result.model_type === "llm" && (
                              <>
                                <div style={styles.metricBox}>
                                  <div style={styles.metricLabel}>Perplexity</div>
                                  <div style={styles.metricValue}>{result.perplexity?.toFixed(4) ?? "--"}</div>
                                </div>
                                <div style={styles.metricBox}>
                                  <div style={styles.metricLabel}>Tokens/sec</div>
                                  <div style={styles.metricValue}>{result.tokens_per_sec?.toFixed(1) ?? "--"}</div>
                                </div>
                                <div style={styles.metricBox}>
                                  <div style={styles.metricLabel}>TTFT (ms)</div>
                                  <div style={styles.metricValue}>{result.ttft_ms?.toFixed(0) ?? "--"}</div>
                                </div>
                              </>
                            )}
                            {result.model_type === "rl" && (
                              <>
                                <div style={styles.metricBox}>
                                  <div style={styles.metricLabel}>Mean Reward</div>
                                  <div style={styles.metricValue}>{result.mean_reward?.toFixed(2) ?? "--"}</div>
                                </div>
                                <div style={styles.metricBox}>
                                  <div style={styles.metricLabel}>Std Reward</div>
                                  <div style={styles.metricValue}>{result.std_reward?.toFixed(2) ?? "--"}</div>
                                </div>
                                <div style={styles.metricBox}>
                                  <div style={styles.metricLabel}>Ep Length</div>
                                  <div style={styles.metricValue}>{result.mean_episode_length?.toFixed(1) ?? "--"}</div>
                                </div>
                              </>
                            )}
                            <div style={styles.metricBox}>
                              <div style={styles.metricLabel}>Duration</div>
                              <div style={styles.metricValue}>
                                {result.duration_seconds ? `${result.duration_seconds.toFixed(1)}s` : "--"}
                              </div>
                            </div>
                            <div style={styles.metricBox}>
                              <div style={styles.metricLabel}>Model Path</div>
                              <div style={{ fontSize: "11px", color: "var(--vscode-foreground)", wordBreak: "break-all" }}>
                                {result.model_path}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-end" }}>
                              <button
                                style={styles.buttonSecondary}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBaselineId(result.run_id);
                                }}
                              >
                                Set as Baseline
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Run Benchmark Dialog */}
      {showDialog && (
        <div style={styles.dialogOverlay} onClick={() => setShowDialog(false)}>
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div style={styles.dialogTitle}>Run Benchmark</div>

            <div style={styles.dialogRow}>
              <div style={styles.dialogLabel}>Model Type</div>
              <select
                style={styles.select}
                value={dialogType}
                onChange={(e) => setDialogType(e.target.value as BenchmarkModelType)}
              >
                <option value="vision">Vision (YOLO/ONNX)</option>
                <option value="llm">LLM (GGUF)</option>
                <option value="rl">RL (SB3)</option>
              </select>
            </div>

            <div style={styles.dialogRow}>
              <div style={styles.dialogLabel}>Model Path</div>
              <input
                style={styles.input}
                placeholder="Path to model file..."
                value={dialogModelPath}
                onChange={(e) => setDialogModelPath(e.target.value)}
              />
            </div>

            <div style={styles.dialogRow}>
              <div style={styles.dialogLabel}>
                {dialogType === "vision"
                  ? "Dataset Path"
                  : dialogType === "llm"
                    ? "Eval JSONL Path (optional)"
                    : "Environment ID"}
              </div>
              <input
                style={styles.input}
                placeholder={
                  dialogType === "vision"
                    ? "Path to YOLO dataset..."
                    : dialogType === "llm"
                      ? "Path to eval.jsonl (optional)..."
                      : "e.g., CartPole-v1"
                }
                value={dialogDataPath}
                onChange={(e) => setDialogDataPath(e.target.value)}
              />
            </div>

            <div style={styles.dialogActions}>
              <button
                style={styles.buttonSecondary}
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </button>
              <button
                style={styles.button}
                onClick={handleRunBenchmark}
                disabled={!dialogModelPath.trim()}
              >
                Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BenchmarkPage;
