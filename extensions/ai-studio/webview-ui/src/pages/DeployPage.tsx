// Copyright 2026 VirtusCo
// Deploy page — SSH deploy, service management, runtime mode control

import React, { useState, useEffect } from "react";
import { vscode } from "../vscodeApi";

// ── Types ───────────────────────────────────────────────────────────

type RuntimeMode = "vision_priority" | "llm_priority" | "balanced";

interface ServiceInfo {
  active: boolean;
  uptime: string;
}

interface DeployArtifact {
  name: string;
  localPath: string;
  remotePath: string;
  type: "vision" | "llm" | "nav";
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    maxWidth: "900px",
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
  inputRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: "12px",
    fontWeight: 600 as const,
    color: "var(--vscode-descriptionForeground)",
    marginBottom: "4px",
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
  inputSmall: {
    width: "80px",
    padding: "6px 10px",
    fontSize: "13px",
    border: "1px solid var(--vscode-input-border, rgba(255,255,255,0.15))",
    borderRadius: "4px",
    background: "var(--vscode-input-background)",
    color: "var(--vscode-input-foreground, var(--vscode-foreground))",
    fontFamily: "inherit",
    outline: "none",
    textAlign: "center" as const,
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
  buttonDanger: {
    padding: "4px 12px",
    fontSize: "11px",
    fontWeight: 600 as const,
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    background: "#c0392b",
    color: "#fff",
    fontFamily: "inherit",
  },
  badge: (active: boolean) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600 as const,
    background: active ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)",
    color: active ? "#2ecc71" : "#e74c3c",
  }),
  dot: (active: boolean) => ({
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: active ? "#2ecc71" : "#e74c3c",
  }),
  connectionBadge: (connected: boolean) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 14px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 600 as const,
    background: connected ? "rgba(46,204,113,0.1)" : "rgba(231,76,60,0.1)",
    color: connected ? "#2ecc71" : "#e74c3c",
  }),
  serviceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    background: "var(--vscode-sideBar-background, rgba(255,255,255,0.02))",
    borderRadius: "4px",
  },
  serviceInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  serviceName: {
    fontSize: "13px",
    fontWeight: 600 as const,
    color: "var(--vscode-foreground)",
  },
  serviceUptime: {
    fontSize: "11px",
    color: "var(--vscode-descriptionForeground)",
  },
  serviceActions: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
  },
  artifactRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    background: "var(--vscode-sideBar-background, rgba(255,255,255,0.02))",
    borderRadius: "4px",
  },
  artifactInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
    flex: 1,
    minWidth: 0,
  },
  artifactName: {
    fontSize: "13px",
    fontWeight: 600 as const,
    color: "var(--vscode-foreground)",
  },
  artifactPath: {
    fontSize: "11px",
    color: "var(--vscode-descriptionForeground)",
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    whiteSpace: "nowrap" as const,
  },
  modeCard: (selected: boolean) => ({
    padding: "12px 16px",
    borderRadius: "6px",
    cursor: "pointer",
    border: selected
      ? "2px solid var(--vscode-focusBorder, #007acc)"
      : "1px solid var(--vscode-panel-border, rgba(255,255,255,0.1))",
    background: selected
      ? "rgba(0,122,204,0.08)"
      : "var(--vscode-sideBar-background, rgba(255,255,255,0.02))",
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
    flex: 1,
  }),
  modeLabel: {
    fontSize: "13px",
    fontWeight: 600 as const,
    color: "var(--vscode-foreground)",
  },
  modeDesc: {
    fontSize: "11px",
    color: "var(--vscode-descriptionForeground)",
  },
  progressOuter: {
    width: "100%",
    height: "8px",
    background: "var(--vscode-input-background)",
    borderRadius: "4px",
    overflow: "hidden" as const,
  },
  progressInner: (pct: number) => ({
    width: `${pct}%`,
    height: "100%",
    background: "var(--vscode-focusBorder, #007acc)",
    borderRadius: "4px",
    transition: "width 0.3s ease",
  }),
  progressText: {
    fontSize: "12px",
    fontWeight: 600 as const,
    color: "var(--vscode-foreground)",
    textAlign: "center" as const,
    marginTop: "4px",
  },
};

// ── Mode Info ───────────────────────────────────────────────────────

const MODE_INFO: Array<{ id: RuntimeMode; label: string; desc: string }> = [
  {
    id: "vision_priority",
    label: "Vision Priority",
    desc: "3 cores for vision, 1 core for LLM. Best for active navigation.",
  },
  {
    id: "llm_priority",
    label: "LLM Priority",
    desc: "3 cores for LLM, 1 core for vision. Best for conversation-heavy usage.",
  },
  {
    id: "balanced",
    label: "Balanced",
    desc: "2 cores each for vision and LLM. Default for general operation.",
  },
];

// ── DeployPage Component ────────────────────────────────────────────

const DeployPage: React.FC = () => {
  // SSH connection
  const [host, setHost] = useState("192.168.1.100");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("pi");
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);

  // Services
  const [services, setServices] = useState<Record<string, ServiceInfo>>({
    "virtus-vision": { active: false, uptime: "--" },
    "virtus-llm": { active: false, uptime: "--" },
    "virtus-nav": { active: false, uptime: "--" },
  });

  // Runtime mode
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("balanced");
  const [settingMode, setSettingMode] = useState(false);

  // Deploy progress
  const [deployProgress, setDeployProgress] = useState<number | null>(null);
  const [deployingArtifact, setDeployingArtifact] = useState<string | null>(null);

  // Artifacts (populated from extension host)
  const [artifacts, setArtifacts] = useState<DeployArtifact[]>([]);

  // Listen for messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg.type !== "string") { return; }

      switch (msg.type) {
        case "deployConnectionStatus":
          setConnected(msg.connected);
          setTesting(false);
          break;
        case "deployServiceStatus":
          setServices(msg.services ?? {});
          break;
        case "deployProgress":
          setDeployProgress(msg.progress);
          if (msg.progress >= 100) {
            setTimeout(() => {
              setDeployProgress(null);
              setDeployingArtifact(null);
            }, 1000);
          }
          break;
        case "deployDone":
          setDeployProgress(null);
          setDeployingArtifact(null);
          break;
        case "deployError":
          setDeployProgress(null);
          setDeployingArtifact(null);
          break;
        case "deployArtifacts":
          setArtifacts(msg.artifacts ?? []);
          break;
        case "runtimeModeSet":
          setSettingMode(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", handler);

    // Request initial state
    vscode.postMessage({ type: "getDeployState" });

    return () => window.removeEventListener("message", handler);
  }, []);

  const handleTestConnection = () => {
    setTesting(true);
    vscode.postMessage({
      type: "testDeployConnection",
      host: host.trim(),
      port: parseInt(port, 10) || 22,
      username: username.trim(),
    });
  };

  const handleDeploy = (artifact: DeployArtifact) => {
    setDeployingArtifact(artifact.name);
    setDeployProgress(0);
    vscode.postMessage({
      type: "deployArtifact",
      localPath: artifact.localPath,
      remotePath: artifact.remotePath,
      artifactType: artifact.type,
    });
  };

  const handleRestartService = (serviceName: string) => {
    vscode.postMessage({
      type: "restartService",
      serviceName,
    });
  };

  const handleSetMode = (mode: RuntimeMode) => {
    setRuntimeMode(mode);
    setSettingMode(true);
    vscode.postMessage({
      type: "setRuntimeMode",
      mode,
    });
  };

  // Group artifacts by type
  const visionArtifacts = artifacts.filter((a) => a.type === "vision");
  const llmArtifacts = artifacts.filter((a) => a.type === "llm");
  const navArtifacts = artifacts.filter((a) => a.type === "nav");

  return (
    <div style={styles.container}>
      {/* SSH Connection */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>SSH Connection</div>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: "180px" }}>
            <div style={styles.fieldLabel}>Host</div>
            <input
              style={styles.input}
              placeholder="192.168.1.100"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </div>
          <div style={{ width: "80px" }}>
            <div style={styles.fieldLabel}>Port</div>
            <input
              style={styles.inputSmall}
              placeholder="22"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, minWidth: "120px" }}>
            <div style={styles.fieldLabel}>Username</div>
            <input
              style={styles.input}
              placeholder="pi"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <button
            style={{
              ...styles.button,
              opacity: testing ? 0.6 : 1,
              padding: "8px 20px",
            }}
            onClick={handleTestConnection}
            disabled={testing || !host.trim()}
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
        </div>

        {/* Connection status badge */}
        <div style={styles.connectionBadge(connected)}>
          <div style={styles.dot(connected)} />
          {connected ? "Connected" : "Disconnected"}
        </div>
      </div>

      {/* Deploy progress */}
      {deployProgress !== null && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>
            Deploying: {deployingArtifact ?? "..."}
          </div>
          <div style={styles.progressOuter}>
            <div style={styles.progressInner(deployProgress)} />
          </div>
          <div style={styles.progressText as React.CSSProperties}>
            {deployProgress}%
          </div>
        </div>
      )}

      {/* Artifacts: Vision */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Vision Models</div>
        {visionArtifacts.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", padding: "8px 0" }}>
            No vision model artifacts found. Export a model first.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {visionArtifacts.map((artifact) => (
              <div key={artifact.name} style={styles.artifactRow}>
                <div style={styles.artifactInfo}>
                  <div style={styles.artifactName}>{artifact.name}</div>
                  <div style={styles.artifactPath} title={artifact.localPath}>
                    {artifact.localPath}
                  </div>
                </div>
                <button
                  style={{
                    ...styles.button,
                    opacity: !connected || deployingArtifact !== null ? 0.5 : 1,
                  }}
                  onClick={() => handleDeploy(artifact)}
                  disabled={!connected || deployingArtifact !== null}
                >
                  Deploy
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Artifacts: LLM */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>LLM Models</div>
        {llmArtifacts.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", padding: "8px 0" }}>
            No LLM model artifacts found. Export a GGUF model first.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {llmArtifacts.map((artifact) => (
              <div key={artifact.name} style={styles.artifactRow}>
                <div style={styles.artifactInfo}>
                  <div style={styles.artifactName}>{artifact.name}</div>
                  <div style={styles.artifactPath} title={artifact.localPath}>
                    {artifact.localPath}
                  </div>
                </div>
                <button
                  style={{
                    ...styles.button,
                    opacity: !connected || deployingArtifact !== null ? 0.5 : 1,
                  }}
                  onClick={() => handleDeploy(artifact)}
                  disabled={!connected || deployingArtifact !== null}
                >
                  Deploy
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Artifacts: Navigation */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Navigation</div>
        {navArtifacts.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", padding: "8px 0" }}>
            No navigation model artifacts found.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {navArtifacts.map((artifact) => (
              <div key={artifact.name} style={styles.artifactRow}>
                <div style={styles.artifactInfo}>
                  <div style={styles.artifactName}>{artifact.name}</div>
                  <div style={styles.artifactPath} title={artifact.localPath}>
                    {artifact.localPath}
                  </div>
                </div>
                <button
                  style={{
                    ...styles.button,
                    opacity: !connected || deployingArtifact !== null ? 0.5 : 1,
                  }}
                  onClick={() => handleDeploy(artifact)}
                  disabled={!connected || deployingArtifact !== null}
                >
                  Deploy
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Runtime Mode */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Runtime Mode</div>
        <div style={{ display: "flex", gap: "8px" }}>
          {MODE_INFO.map((m) => (
            <div
              key={m.id}
              style={styles.modeCard(runtimeMode === m.id)}
              onClick={() => handleSetMode(m.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="radio"
                  name="runtimeMode"
                  checked={runtimeMode === m.id}
                  onChange={() => handleSetMode(m.id)}
                  style={{ margin: 0 }}
                />
                <div style={styles.modeLabel}>{m.label}</div>
              </div>
              <div style={styles.modeDesc}>{m.desc}</div>
            </div>
          ))}
        </div>
        {settingMode && (
          <div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", fontStyle: "italic" }}>
            Applying runtime mode...
          </div>
        )}
      </div>

      {/* Service Status */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={styles.cardTitle}>Service Status</div>
          <button
            style={styles.buttonSecondary}
            onClick={() => vscode.postMessage({ type: "refreshServiceStatus" })}
            disabled={!connected}
          >
            Refresh
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {Object.entries(services).map(([name, info]) => (
            <div key={name} style={styles.serviceRow}>
              <div style={styles.serviceInfo}>
                <div style={styles.serviceName}>{name}</div>
                <div style={styles.serviceUptime}>
                  {info.active ? `Uptime: ${info.uptime}` : "Not running"}
                </div>
              </div>
              <div style={styles.serviceActions}>
                <div style={styles.badge(info.active)}>
                  <div style={styles.dot(info.active)} />
                  {info.active ? "Active" : "Inactive"}
                </div>
                <button
                  style={{
                    ...styles.buttonDanger,
                    background: "#2c3e50",
                    opacity: !connected ? 0.5 : 1,
                  }}
                  onClick={() => handleRestartService(name)}
                  disabled={!connected}
                >
                  Restart
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DeployPage;
