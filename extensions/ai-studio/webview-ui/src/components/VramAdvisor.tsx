// Copyright 2026 VirtusCo
// VRAM recommendation display component

import React from "react";
import type { FineTuneRecommendation, GpuState } from "../store/aiStudioStore";

interface VramAdvisorProps {
  recommendation: FineTuneRecommendation | null;
  gpuState: GpuState | null;
}

const METHOD_COLORS: Record<string, string> = {
  full: "#4caf50",
  lora: "#2196f3",
  qlora: "#ff9800",
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  empty: {
    fontSize: "13px",
    color: "var(--vscode-descriptionForeground)",
  },
  badge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 700 as const,
    color: "#fff",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "var(--vscode-foreground)",
  },
  label: {
    color: "var(--vscode-descriptionForeground)",
  },
  reason: {
    fontSize: "12px",
    color: "var(--vscode-descriptionForeground)",
    lineHeight: "1.5",
    fontStyle: "italic" as const,
  },
  barOuter: {
    width: "100%",
    height: "14px",
    background: "var(--vscode-input-background)",
    borderRadius: "4px",
    overflow: "hidden" as const,
    display: "flex",
  },
  barLabel: {
    fontSize: "11px",
    color: "var(--vscode-descriptionForeground)",
    marginBottom: "4px",
  },
};

const VramAdvisor: React.FC<VramAdvisorProps> = ({ recommendation, gpuState }) => {
  if (!recommendation) {
    return (
      <div style={styles.empty}>
        {gpuState ? "Waiting for VRAM recommendation..." : "Probe GPU to get recommendations"}
      </div>
    );
  }

  const methodColor = METHOD_COLORS[recommendation.method] ?? "#888";

  // VRAM bar segments
  const vramUsedPct = gpuState
    ? (gpuState.vram_used_mb / gpuState.vram_total_mb) * 100
    : 0;
  const vramFreePct = 100 - vramUsedPct;

  return (
    <div style={styles.container}>
      {/* Method badge */}
      <div>
        <span style={{ ...styles.badge, background: methodColor }}>
          {recommendation.method}
        </span>
      </div>

      {/* Details */}
      <div style={styles.row}>
        <span>
          <span style={styles.label}>dtype: </span>
          {recommendation.dtype}
        </span>
        {recommendation.lora_r !== null && (
          <span>
            <span style={styles.label}>lora_r: </span>
            {recommendation.lora_r}
          </span>
        )}
      </div>

      {/* Reason */}
      <div style={styles.reason}>
        &ldquo;{recommendation.reason}&rdquo;
      </div>

      {/* VRAM breakdown bar */}
      {gpuState && (
        <div>
          <div style={styles.barLabel}>
            VRAM: {gpuState.vram_used_mb.toFixed(0)} MB used /{" "}
            {gpuState.vram_free_mb.toFixed(0)} MB free
          </div>
          <div style={styles.barOuter}>
            <div
              style={{
                width: `${vramUsedPct}%`,
                height: "100%",
                background: "#f44336",
                transition: "width 0.3s ease",
              }}
              title={`Used: ${gpuState.vram_used_mb.toFixed(0)} MB`}
            />
            <div
              style={{
                width: `${vramFreePct}%`,
                height: "100%",
                background: "#4caf50",
                transition: "width 0.3s ease",
              }}
              title={`Free: ${gpuState.vram_free_mb.toFixed(0)} MB`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VramAdvisor;
