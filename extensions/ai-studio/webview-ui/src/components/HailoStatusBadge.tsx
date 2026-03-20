// Copyright 2026 VirtusCo
// Hailo accelerator status indicator component

import React from "react";
import type { HailoState } from "../store/aiStudioStore";

interface HailoStatusBadgeProps {
  hailoState: HailoState | null;
  rpiConnected: boolean;
}

type StatusLevel = "ready" | "busy" | "unavailable";

function getStatus(
  hailoState: HailoState | null,
  rpiConnected: boolean
): { level: StatusLevel; text: string } {
  if (!rpiConnected || !hailoState || !hailoState.hailo_rt_version) {
    return { level: "unavailable", text: "Unavailable" };
  }
  if (hailoState.hailo_ollama_running && hailoState.tops_available > 0) {
    return { level: "ready", text: "Ready" };
  }
  if (hailoState.hailo_ollama_running) {
    return { level: "busy", text: "Busy" };
  }
  return { level: "unavailable", text: "Unavailable" };
}

const DOT_COLORS: Record<StatusLevel, string> = {
  ready: "#4caf50",
  busy: "#ff9800",
  unavailable: "#888",
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  dot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  statusText: {
    fontSize: "13px",
    fontWeight: 600 as const,
    color: "var(--vscode-foreground)",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "var(--vscode-foreground)",
  },
  label: {
    color: "var(--vscode-descriptionForeground)",
  },
  modelList: {
    fontSize: "12px",
    color: "var(--vscode-foreground)",
    paddingLeft: "16px",
    margin: "4px 0 0 0",
  },
  muted: {
    fontSize: "12px",
    color: "var(--vscode-descriptionForeground)",
    fontStyle: "italic" as const,
  },
};

const HailoStatusBadge: React.FC<HailoStatusBadgeProps> = ({
  hailoState,
  rpiConnected,
}) => {
  const { level, text } = getStatus(hailoState, rpiConnected);
  const dotColor = DOT_COLORS[level];

  return (
    <div style={styles.container}>
      {/* Status badge */}
      <div style={styles.statusRow}>
        <div style={{ ...styles.dot, background: dotColor }} />
        <span style={styles.statusText}>{text}</span>
      </div>

      {!rpiConnected && (
        <div style={styles.muted}>Connect RPi first to view Hailo status</div>
      )}

      {rpiConnected && hailoState && (
        <>
          {/* Version & TOPS */}
          {hailoState.hailo_rt_version && (
            <div style={styles.infoRow}>
              <span>
                <span style={styles.label}>HailoRT: </span>
                {hailoState.hailo_rt_version}
              </span>
              <span>
                <span style={styles.label}>TOPS: </span>
                {hailoState.tops_available}
              </span>
            </div>
          )}

          {/* Performance metrics */}
          {(hailoState.llm_tps !== null || hailoState.vision_fps !== null) && (
            <div style={styles.infoRow}>
              {hailoState.llm_tps !== null && (
                <span>
                  <span style={styles.label}>LLM: </span>
                  {hailoState.llm_tps.toFixed(1)} tok/s
                </span>
              )}
              {hailoState.vision_fps !== null && (
                <span>
                  <span style={styles.label}>Vision: </span>
                  {hailoState.vision_fps.toFixed(1)} FPS
                </span>
              )}
            </div>
          )}

          {/* Loaded models */}
          {hailoState.loaded_models.length > 0 && (
            <div>
              <div style={styles.label}>Loaded models:</div>
              <ul style={styles.modelList}>
                {hailoState.loaded_models.map((model) => (
                  <li key={model}>{model}</li>
                ))}
              </ul>
            </div>
          )}

          {!hailoState.hailo_rt_version && (
            <div style={styles.muted}>HailoRT not detected on RPi</div>
          )}
        </>
      )}
    </div>
  );
};

export default HailoStatusBadge;
