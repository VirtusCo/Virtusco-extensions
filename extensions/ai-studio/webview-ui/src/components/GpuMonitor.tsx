// Copyright 2026 VirtusCo
// Reusable GPU status monitor component

import React from "react";
import type { GpuState } from "../store/aiStudioStore";

interface GpuMonitorProps {
  gpuState: GpuState | null;
}

function barColor(pct: number): string {
  if (pct < 70) return "#4caf50";
  if (pct < 90) return "#ff9800";
  return "#f44336";
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  spinner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "var(--vscode-descriptionForeground)",
    fontSize: "13px",
  },
  gpuName: {
    fontSize: "14px",
    fontWeight: 600 as const,
    color: "var(--vscode-foreground)",
    margin: 0,
  },
  label: {
    fontSize: "12px",
    color: "var(--vscode-descriptionForeground)",
    marginBottom: "4px",
  },
  barOuter: {
    width: "100%",
    height: "16px",
    background: "var(--vscode-input-background)",
    borderRadius: "4px",
    overflow: "hidden" as const,
    position: "relative" as const,
  },
  barText: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: 600 as const,
    color: "#fff",
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
  },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "var(--vscode-foreground)",
  },
  throttleBanner: {
    background: "rgba(244, 67, 54, 0.15)",
    border: "1px solid #f44336",
    borderRadius: "4px",
    padding: "6px 10px",
    fontSize: "12px",
    color: "#f44336",
    fontWeight: 600 as const,
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
};

const GpuMonitor: React.FC<GpuMonitorProps> = ({ gpuState }) => {
  if (!gpuState) {
    return (
      <div style={styles.spinner}>
        <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>
          &#x21BB;
        </span>
        Probing GPU...
      </div>
    );
  }

  const vramPct = (gpuState.vram_used_mb / gpuState.vram_total_mb) * 100;
  const powerPct = (gpuState.power_draw_w / gpuState.power_limit_w) * 100;

  return (
    <div style={styles.container}>
      <p style={styles.gpuName}>{gpuState.name}</p>

      {/* VRAM bar */}
      <div>
        <div style={styles.label}>
          VRAM: {gpuState.vram_used_mb.toFixed(0)} / {gpuState.vram_total_mb.toFixed(0)} MB
        </div>
        <div style={styles.barOuter}>
          <div
            style={{
              width: `${Math.min(vramPct, 100)}%`,
              height: "100%",
              background: barColor(vramPct),
              borderRadius: "4px",
              transition: "width 0.3s ease",
            }}
          />
          <div style={styles.barText}>{vramPct.toFixed(1)}%</div>
        </div>
      </div>

      {/* Power bar */}
      <div>
        <div style={styles.label}>
          Power: {gpuState.power_draw_w.toFixed(0)}W / {gpuState.power_limit_w.toFixed(0)}W
        </div>
        <div style={styles.barOuter}>
          <div
            style={{
              width: `${Math.min(powerPct, 100)}%`,
              height: "100%",
              background: barColor(powerPct),
              borderRadius: "4px",
              transition: "width 0.3s ease",
            }}
          />
          <div style={styles.barText}>{powerPct.toFixed(1)}%</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={styles.statRow}>
        <span>Temp: {gpuState.temperature_c}&deg;C</span>
        <span>Utilization: {gpuState.gpu_util_pct}%</span>
      </div>

      {/* Throttle warning */}
      {gpuState.is_throttled && (
        <div style={styles.throttleBanner}>
          <span>&#x26A0;</span>
          GPU throttling detected — power draw exceeds 92% of limit
        </div>
      )}
    </div>
  );
};

export default GpuMonitor;
