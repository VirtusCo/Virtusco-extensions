// Copyright 2026 VirtusCo
// Dashboard page — GPU monitoring, VRAM advisor, RPi and Hailo status

import React from "react";
import { useAIStudioStore } from "../store/aiStudioStore";
import GpuMonitor from "../components/GpuMonitor";
import VramAdvisor from "../components/VramAdvisor";
import HailoStatusBadge from "../components/HailoStatusBadge";
import { vscode } from "../vscodeApi";

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    padding: "4px",
  },
  card: {
    background: "var(--vscode-editor-background)",
    border: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.1))",
    borderRadius: "6px",
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
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
  rpiConnected: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 600 as const,
    color: "#4caf50",
  },
  rpiDisconnected: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 600 as const,
    color: "#f44336",
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    display: "inline-block",
  },
  rpiInfoRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "var(--vscode-foreground)",
  },
  rpiLabel: {
    color: "var(--vscode-descriptionForeground)",
  },
  barOuter: {
    width: "100%",
    height: "14px",
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
  connectBtn: {
    background: "var(--vscode-button-background)",
    color: "var(--vscode-button-foreground)",
    border: "none",
    borderRadius: "4px",
    padding: "6px 14px",
    fontSize: "12px",
    cursor: "pointer",
    fontWeight: 600 as const,
    marginTop: "6px",
    alignSelf: "flex-start" as const,
  },
};

const DashboardPage: React.FC = () => {
  const gpuState = useAIStudioStore((s) => s.gpuState);
  const vramRecommendation = useAIStudioStore((s) => s.vramRecommendation);
  const rpiConnected = useAIStudioStore((s) => s.rpiConnected);
  const rpiInfo = useAIStudioStore((s) => s.rpiInfo);
  const hailoState = useAIStudioStore((s) => s.hailoState);

  const handleConnect = () => {
    vscode.postMessage({ type: "connectRpi" });
  };

  // RPi memory bar
  const memUsedMb = rpiInfo
    ? rpiInfo.mem_total_mb - rpiInfo.mem_available_mb
    : 0;
  const memPct = rpiInfo ? (memUsedMb / rpiInfo.mem_total_mb) * 100 : 0;

  return (
    <div style={styles.grid}>
      {/* Card 1: GPU Status */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>
          GPU Status
        </div>
        <GpuMonitor gpuState={gpuState} />
      </div>

      {/* Card 2: VRAM Advisor */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>
          VRAM Advisor
        </div>
        <VramAdvisor recommendation={vramRecommendation} gpuState={gpuState} />
      </div>

      {/* Card 3: RPi Status */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>
          Raspberry Pi
        </div>
        {rpiConnected && rpiInfo ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={styles.rpiConnected}>
              <span style={{ ...styles.dot, background: "#4caf50" }} />
              Connected
            </div>

            <div style={styles.rpiInfoRow}>
              <span>
                <span style={styles.rpiLabel}>Host: </span>
                {rpiInfo.hostname}
              </span>
              <span>
                <span style={styles.rpiLabel}>CPU Temp: </span>
                {rpiInfo.cpu_temp.toFixed(1)}&deg;C
              </span>
            </div>

            {/* Memory bar */}
            <div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--vscode-descriptionForeground)",
                  marginBottom: "4px",
                }}
              >
                Memory: {memUsedMb.toFixed(0)} / {rpiInfo.mem_total_mb.toFixed(0)} MB
              </div>
              <div style={styles.barOuter}>
                <div
                  style={{
                    width: `${Math.min(memPct, 100)}%`,
                    height: "100%",
                    background: memPct > 90 ? "#f44336" : memPct > 70 ? "#ff9800" : "#4caf50",
                    borderRadius: "4px",
                    transition: "width 0.3s ease",
                  }}
                />
                <div style={styles.barText}>{memPct.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={styles.rpiDisconnected}>
              <span style={{ ...styles.dot, background: "#f44336" }} />
              Disconnected
            </div>
            <button
              style={styles.connectBtn}
              onClick={handleConnect}
              onMouseOver={(e) => {
                (e.target as HTMLButtonElement).style.background =
                  "var(--vscode-button-hoverBackground)";
              }}
              onMouseOut={(e) => {
                (e.target as HTMLButtonElement).style.background =
                  "var(--vscode-button-background)";
              }}
            >
              Connect to RPi
            </button>
          </div>
        )}
      </div>

      {/* Card 4: Hailo Status */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>
          Hailo Accelerator
        </div>
        <HailoStatusBadge hailoState={hailoState} rpiConnected={rpiConnected} />
      </div>
    </div>
  );
};

export default DashboardPage;
