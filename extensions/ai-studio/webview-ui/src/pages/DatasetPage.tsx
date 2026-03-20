// Copyright 2026 VirtusCo
// Dataset management page — Vision (YOLO) and LLM (ShareGPT JSONL) datasets

import React, { useState } from "react";
import { useAIStudioStore } from "../store/aiStudioStore";
import { vscode } from "../vscodeApi";
import type {
  VisionDatasetStats,
  ValidationResult,
  LLMPair,
  LLMMode,
  QualityIssue,
  DatasetBuildResult,
} from "../store/aiStudioStore";

// ── System prompts (mirrored from LLMDatasetBuilder for display) ──

const SYSTEM_PROMPTS: Record<LLMMode, string> = {
  passenger:
    "You are Virtue, the AI assistant aboard Porter, an autonomous luggage-carrying robot at the airport. " +
    "You help passengers with directions, flight information, gate locations, amenities, and general airport questions. " +
    "Be friendly, concise, and helpful. Always prioritize passenger safety. " +
    "If you do not know something, say so honestly and suggest asking airport staff.",
  voice_command:
    "You are Virtue, the voice-controlled AI aboard Porter, an autonomous airport robot. " +
    "You interpret short spoken commands and respond with brief confirmations or clarifications. " +
    "Commands may include: follow me, stop, go to gate, carry luggage, find restroom, call assistance. " +
    "Keep responses under 2 sentences. Use clear, simple language.",
  multilingual:
    "You are Virtue, a multilingual AI assistant aboard Porter, an autonomous airport robot. " +
    "You detect the passenger's language and respond in the same language. " +
    "You support English, Spanish, French, Mandarin, Japanese, Korean, Arabic, Hindi, and Portuguese. " +
    "Provide the same helpful airport assistance regardless of language.",
  operator:
    "You are Virtue, the AI assistant aboard Porter, in operator/maintenance mode. " +
    "You respond to technical queries about the robot's systems: battery, motors, LIDAR, sensors, " +
    "navigation status, error logs, and diagnostics. " +
    "Use precise technical language. Report exact values when available.",
};

const MODE_LABELS: Record<LLMMode, string> = {
  passenger: "Passenger",
  voice_command: "Voice",
  multilingual: "Multilingual",
  operator: "Operator",
};

// ── Styles ──────────────────────────────────────────────────────────

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    maxWidth: "1100px",
  },
  tabBar: {
    display: "flex",
    gap: "0px",
    borderBottom: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.1))",
  },
  tab: (active: boolean) => ({
    padding: "10px 24px",
    fontSize: "13px",
    fontWeight: 600 as const,
    cursor: "pointer",
    border: "none",
    borderBottom: active ? "2px solid var(--vscode-focusBorder, #007acc)" : "2px solid transparent",
    background: "transparent",
    color: active ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)",
    fontFamily: "inherit",
  }),
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
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 600 as const,
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    background: "#c0392b",
    color: "#fff",
    fontFamily: "inherit",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "12px",
  },
  statBox: {
    background: "var(--vscode-sideBar-background, rgba(255,255,255,0.03))",
    borderRadius: "4px",
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  statLabel: {
    fontSize: "11px",
    color: "var(--vscode-descriptionForeground)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  statValue: {
    fontSize: "20px",
    fontWeight: 700 as const,
    color: "var(--vscode-foreground)",
  },
  barContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  barRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  barLabel: {
    fontSize: "12px",
    color: "var(--vscode-foreground)",
    width: "120px",
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    whiteSpace: "nowrap" as const,
  },
  barOuter: {
    flex: 1,
    height: "16px",
    background: "var(--vscode-input-background)",
    borderRadius: "4px",
    overflow: "hidden" as const,
  },
  barCount: {
    fontSize: "11px",
    color: "var(--vscode-descriptionForeground)",
    width: "50px",
    textAlign: "right" as const,
  },
  warningList: {
    maxHeight: "160px",
    overflowY: "auto" as const,
    fontSize: "12px",
    background: "var(--vscode-input-background)",
    borderRadius: "4px",
    padding: "8px 12px",
  },
  warningItem: {
    padding: "2px 0",
    color: "#e2b93d",
    wordBreak: "break-word" as const,
  },
  errorItem: {
    padding: "2px 0",
    color: "#e74c3c",
    wordBreak: "break-word" as const,
  },
  successBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 14px",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: 600 as const,
    background: "rgba(76, 175, 80, 0.15)",
    color: "#4caf50",
  },
  failBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 14px",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: 600 as const,
    background: "rgba(231, 76, 60, 0.15)",
    color: "#e74c3c",
  },
  textarea: {
    width: "100%",
    padding: "8px 10px",
    fontSize: "13px",
    border: "1px solid var(--vscode-input-border, rgba(255,255,255,0.15))",
    borderRadius: "4px",
    background: "var(--vscode-input-background)",
    color: "var(--vscode-input-foreground, var(--vscode-foreground))",
    fontFamily: "inherit",
    outline: "none",
    resize: "vertical" as const,
    minHeight: "60px",
  },
  pairCard: {
    background: "var(--vscode-sideBar-background, rgba(255,255,255,0.03))",
    border: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.08))",
    borderRadius: "6px",
    padding: "12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  pairHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pairIndex: {
    fontSize: "11px",
    fontWeight: 600 as const,
    color: "var(--vscode-descriptionForeground)",
    textTransform: "uppercase" as const,
  },
  pairFieldLabel: {
    fontSize: "11px",
    fontWeight: 600 as const,
    color: "var(--vscode-descriptionForeground)",
    marginBottom: "2px",
  },
  systemPromptDisplay: {
    fontSize: "12px",
    color: "var(--vscode-descriptionForeground)",
    background: "var(--vscode-input-background)",
    borderRadius: "4px",
    padding: "10px 12px",
    lineHeight: "1.5",
    maxHeight: "120px",
    overflowY: "auto" as const,
  },
  modeTabBar: {
    display: "flex",
    gap: "0px",
    borderBottom: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.08))",
    marginBottom: "8px",
  },
  modeTab: (active: boolean) => ({
    padding: "6px 16px",
    fontSize: "12px",
    fontWeight: 600 as const,
    cursor: "pointer",
    border: "none",
    borderBottom: active ? "2px solid var(--vscode-focusBorder, #007acc)" : "2px solid transparent",
    background: "transparent",
    color: active ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)",
    fontFamily: "inherit",
  }),
  pairList: {
    maxHeight: "500px",
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
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
  actionsRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
};

// ── Bar chart colors ────────────────────────────────────────────────

const BAR_COLORS = [
  "#007acc", "#2ecc71", "#e74c3c", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#3498db", "#e91e63", "#00bcd4",
];

// ── Vision Dataset Tab ──────────────────────────────────────────────

const VisionDatasetTab: React.FC = () => {
  const visionStats = useAIStudioStore((s) => s.visionStats);
  const visionValidation = useAIStudioStore((s) => s.visionValidation);
  const [datasetPath, setDatasetPath] = useState("");
  const [scanning, setScanning] = useState(false);
  const [validating, setValidating] = useState(false);

  const handleScan = () => {
    if (!datasetPath.trim()) return;
    setScanning(true);
    vscode.postMessage({ type: "scanDataset", datasetPath: datasetPath.trim() });
    // scanning state cleared when visionStats arrives
  };

  const handleValidate = () => {
    if (!datasetPath.trim()) return;
    setValidating(true);
    vscode.postMessage({ type: "validateDataset", datasetPath: datasetPath.trim() });
  };

  // Reset loading states when results arrive (via useEffect-like pattern: check store changes)
  React.useEffect(() => {
    if (visionStats !== null) setScanning(false);
  }, [visionStats]);

  React.useEffect(() => {
    if (visionValidation !== null) setValidating(false);
  }, [visionValidation]);

  const maxInstances = visionStats
    ? Math.max(1, ...Object.values(visionStats.instancesPerClass))
    : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Path input */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>YOLO Dataset Path</div>
        <div style={styles.inputRow}>
          <input
            style={styles.input}
            placeholder="Enter path to YOLO dataset directory..."
            value={datasetPath}
            onChange={(e) => setDatasetPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
          />
          <button
            style={styles.button}
            onClick={handleScan}
            disabled={scanning || !datasetPath.trim()}
          >
            {scanning ? "Scanning..." : "Scan"}
          </button>
          <button
            style={styles.buttonSecondary}
            onClick={handleValidate}
            disabled={validating || !datasetPath.trim()}
          >
            {validating ? "Validating..." : "Validate"}
          </button>
        </div>
      </div>

      {/* Stats display */}
      {visionStats && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Dataset Statistics</div>

          <div style={styles.statsGrid}>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Total Images</div>
              <div style={styles.statValue}>{visionStats.totalImages.toLocaleString()}</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Classes</div>
              <div style={styles.statValue}>{visionStats.numClasses}</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Total Instances</div>
              <div style={styles.statValue}>{visionStats.totalInstances.toLocaleString()}</div>
            </div>
          </div>

          {/* Split breakdown */}
          <div style={styles.statsGrid}>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Train</div>
              <div style={{ ...styles.statValue, fontSize: "16px" }}>
                {visionStats.splits.train.toLocaleString()} images
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Val</div>
              <div style={{ ...styles.statValue, fontSize: "16px" }}>
                {visionStats.splits.val.toLocaleString()} images
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Test</div>
              <div style={{ ...styles.statValue, fontSize: "16px" }}>
                {visionStats.splits.test.toLocaleString()} images
              </div>
            </div>
          </div>

          {/* Class distribution chart */}
          {visionStats.classNames.length > 0 && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px", color: "var(--vscode-foreground)" }}>
                Class Distribution
              </div>
              <div style={styles.barContainer}>
                {visionStats.classNames.map((cls, i) => {
                  const count = visionStats.instancesPerClass[cls] ?? 0;
                  const pct = (count / maxInstances) * 100;
                  return (
                    <div key={cls} style={styles.barRow}>
                      <div style={styles.barLabel} title={cls}>{cls}</div>
                      <div style={styles.barOuter}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: BAR_COLORS[i % BAR_COLORS.length],
                            borderRadius: "4px",
                            transition: "width 0.3s ease",
                            minWidth: count > 0 ? "2px" : "0",
                          }}
                        />
                      </div>
                      <div style={styles.barCount}>{count.toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Missing labels */}
          {visionStats.missingLabels.length > 0 && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: "#e2b93d" }}>
                Missing Labels ({visionStats.missingLabels.length})
              </div>
              <div style={styles.warningList}>
                {visionStats.missingLabels.slice(0, 50).map((f, i) => (
                  <div key={i} style={styles.warningItem}>{f}</div>
                ))}
                {visionStats.missingLabels.length > 50 && (
                  <div style={{ ...styles.warningItem, fontStyle: "italic" }}>
                    ...and {visionStats.missingLabels.length - 50} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Errors */}
          {visionStats.errors.length > 0 && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: "#e74c3c" }}>
                Errors ({visionStats.errors.length})
              </div>
              <div style={styles.warningList}>
                {visionStats.errors.map((e, i) => (
                  <div key={i} style={styles.errorItem}>{e}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Validation results */}
      {visionValidation && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Validation Results</div>
          <div>
            {visionValidation.valid ? (
              <div style={styles.successBadge}>
                <span>&#10003;</span> Dataset is valid
              </div>
            ) : (
              <div style={styles.failBadge}>
                <span>&#10007;</span> Validation failed ({visionValidation.errors.length} errors)
              </div>
            )}
          </div>

          {visionValidation.errors.length > 0 && (
            <div style={styles.warningList}>
              {visionValidation.errors.slice(0, 100).map((e, i) => (
                <div key={i} style={styles.errorItem}>{e}</div>
              ))}
              {visionValidation.errors.length > 100 && (
                <div style={{ ...styles.errorItem, fontStyle: "italic" }}>
                  ...and {visionValidation.errors.length - 100} more
                </div>
              )}
            </div>
          )}

          {visionValidation.warnings.length > 0 && (
            <div style={styles.warningList}>
              {visionValidation.warnings.slice(0, 100).map((w, i) => (
                <div key={i} style={styles.warningItem}>{w}</div>
              ))}
              {visionValidation.warnings.length > 100 && (
                <div style={{ ...styles.warningItem, fontStyle: "italic" }}>
                  ...and {visionValidation.warnings.length - 100} more
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── LLM Dataset Tab ─────────────────────────────────────────────────

const LLMDatasetTab: React.FC = () => {
  const llmPairs = useAIStudioStore((s) => s.llmPairs);
  const llmBuildResult = useAIStudioStore((s) => s.llmBuildResult);
  const activeLlmMode = useAIStudioStore((s) => s.activeLlmMode);
  const setActiveLlmMode = useAIStudioStore((s) => s.setActiveLlmMode);
  const addLlmPair = useAIStudioStore((s) => s.addLlmPair);
  const removeLlmPair = useAIStudioStore((s) => s.removeLlmPair);
  const updateLlmPair = useAIStudioStore((s) => s.updateLlmPair);

  const [newUser, setNewUser] = useState("");
  const [newAssistant, setNewAssistant] = useState("");
  const [outputPath, setOutputPath] = useState("");
  const [building, setBuilding] = useState(false);

  React.useEffect(() => {
    if (llmBuildResult !== null) setBuilding(false);
  }, [llmBuildResult]);

  // Filter pairs by active mode
  const filteredPairs = llmPairs
    .map((pair, index) => ({ pair, index }))
    .filter(({ pair }) => pair.mode === activeLlmMode);

  const handleAddPair = () => {
    if (!newUser.trim() || !newAssistant.trim()) return;
    addLlmPair({
      mode: activeLlmMode,
      userMessage: newUser.trim(),
      assistantResponse: newAssistant.trim(),
    });
    setNewUser("");
    setNewAssistant("");
  };

  const handleExport = () => {
    if (llmPairs.length === 0 || !outputPath.trim()) return;
    setBuilding(true);
    vscode.postMessage({
      type: "buildJsonl",
      pairs: llmPairs,
      outputPath: outputPath.trim(),
    });
  };

  const handleImportCsv = () => {
    // Request file picker from the extension host
    vscode.postMessage({ type: "importCsvDataset" });
  };

  // Per-mode counts
  const modeCounts: Record<string, number> = {};
  for (const mode of ["passenger", "voice_command", "multilingual", "operator"]) {
    modeCounts[mode] = llmPairs.filter((p) => p.mode === mode).length;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Mode tabs */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Interaction Mode</div>
        <div style={styles.modeTabBar}>
          {(["passenger", "voice_command", "multilingual", "operator"] as LLMMode[]).map((mode) => (
            <button
              key={mode}
              style={styles.modeTab(activeLlmMode === mode)}
              onClick={() => setActiveLlmMode(mode)}
            >
              {MODE_LABELS[mode]} ({modeCounts[mode] ?? 0})
            </button>
          ))}
        </div>

        {/* System prompt display */}
        <div>
          <div style={styles.pairFieldLabel}>System Prompt ({MODE_LABELS[activeLlmMode]})</div>
          <div style={styles.systemPromptDisplay}>
            {SYSTEM_PROMPTS[activeLlmMode]}
          </div>
        </div>
      </div>

      {/* Add pair form */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Add Pair</div>
        <div>
          <div style={styles.pairFieldLabel}>User Message</div>
          <textarea
            style={styles.textarea}
            placeholder="Enter the user's message..."
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
            rows={2}
          />
        </div>
        <div>
          <div style={styles.pairFieldLabel}>Assistant Response</div>
          <textarea
            style={styles.textarea}
            placeholder="Enter Virtue's response..."
            value={newAssistant}
            onChange={(e) => setNewAssistant(e.target.value)}
            rows={3}
          />
        </div>
        <div style={styles.actionsRow}>
          <button
            style={styles.button}
            onClick={handleAddPair}
            disabled={!newUser.trim() || !newAssistant.trim()}
          >
            Add Pair
          </button>
          <button style={styles.buttonSecondary} onClick={handleImportCsv}>
            Import CSV
          </button>
        </div>
      </div>

      {/* Pair list */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>
          Pairs - {MODE_LABELS[activeLlmMode]} ({filteredPairs.length})
        </div>
        {filteredPairs.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "24px", opacity: 0.3 }}>&#9998;</div>
            <div>No pairs for {MODE_LABELS[activeLlmMode]} mode yet.</div>
            <div style={{ fontSize: "12px" }}>Add pairs above or import from CSV.</div>
          </div>
        ) : (
          <div style={styles.pairList}>
            {filteredPairs.map(({ pair, index }) => (
              <div key={index} style={styles.pairCard}>
                <div style={styles.pairHeader}>
                  <div style={styles.pairIndex}>Pair #{index}</div>
                  <button
                    style={styles.buttonDanger}
                    onClick={() => removeLlmPair(index)}
                  >
                    Delete
                  </button>
                </div>
                <div>
                  <div style={styles.pairFieldLabel}>User</div>
                  <textarea
                    style={{ ...styles.textarea, minHeight: "40px" }}
                    value={pair.userMessage}
                    onChange={(e) =>
                      updateLlmPair(index, { ...pair, userMessage: e.target.value })
                    }
                    rows={2}
                  />
                </div>
                <div>
                  <div style={styles.pairFieldLabel}>Assistant</div>
                  <textarea
                    style={{ ...styles.textarea, minHeight: "40px" }}
                    value={pair.assistantResponse}
                    onChange={(e) =>
                      updateLlmPair(index, {
                        ...pair,
                        assistantResponse: e.target.value,
                      })
                    }
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export & Stats */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Export</div>
        <div style={styles.inputRow}>
          <input
            style={styles.input}
            placeholder="Output JSONL path (e.g., ./data/porter_train.jsonl)"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
          />
          <button
            style={styles.button}
            onClick={handleExport}
            disabled={building || llmPairs.length === 0 || !outputPath.trim()}
          >
            {building ? "Building..." : "Export JSONL"}
          </button>
        </div>

        {/* Summary stats */}
        <div style={styles.statsGrid}>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Total Pairs</div>
            <div style={styles.statValue}>{llmPairs.length}</div>
          </div>
          {(["passenger", "voice_command", "multilingual", "operator"] as const).map((mode) => (
            <div key={mode} style={styles.statBox}>
              <div style={styles.statLabel}>{MODE_LABELS[mode]}</div>
              <div style={{ ...styles.statValue, fontSize: "16px" }}>
                {modeCounts[mode] ?? 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Build result */}
      {llmBuildResult && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Build Result</div>
          <div style={styles.statsGrid}>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Total Pairs</div>
              <div style={styles.statValue}>{llmBuildResult.totalPairs}</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Avg Response Tokens</div>
              <div style={styles.statValue}>{llmBuildResult.avgResponseTokens}</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Output</div>
              <div style={{ fontSize: "12px", color: "var(--vscode-foreground)", wordBreak: "break-all" }}>
                {llmBuildResult.outputPath}
              </div>
            </div>
          </div>

          {/* Quality issues */}
          {llmBuildResult.qualityIssues.length > 0 && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: "#e2b93d" }}>
                Quality Issues ({llmBuildResult.qualityIssues.length})
              </div>
              <div style={styles.warningList}>
                {llmBuildResult.qualityIssues.map((issue: QualityIssue, i: number) => (
                  <div
                    key={i}
                    style={issue.severity === "error" ? styles.errorItem : styles.warningItem}
                  >
                    [{issue.severity}] {issue.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main DatasetPage ────────────────────────────────────────────────

const DatasetPage: React.FC = () => {
  const activeDatasetTab = useAIStudioStore((s) => s.activeDatasetTab);
  const setActiveDatasetTab = useAIStudioStore((s) => s.setActiveDatasetTab);

  return (
    <div style={styles.container}>
      <div style={styles.tabBar}>
        <button
          style={styles.tab(activeDatasetTab === "vision")}
          onClick={() => setActiveDatasetTab("vision")}
        >
          Vision Dataset
        </button>
        <button
          style={styles.tab(activeDatasetTab === "llm")}
          onClick={() => setActiveDatasetTab("llm")}
        >
          LLM Dataset
        </button>
      </div>

      {activeDatasetTab === "vision" ? <VisionDatasetTab /> : <LLMDatasetTab />}
    </div>
  );
};

export default DatasetPage;
