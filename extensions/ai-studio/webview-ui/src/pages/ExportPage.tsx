// Copyright 2026 VirtusCo
// Export page — model conversion pipeline (HEF, GGUF, ONNX, TorchScript)

import React, { useState, useEffect } from "react";
import { vscode } from "../vscodeApi";
import ExportStepper, { type ExportStepData } from "../components/ExportStepper";

// ── Types ───────────────────────────────────────────────────────────

type ExportFormat = "hef-vision" | "hef-llm" | "gguf" | "onnx" | "torchscript";

interface ExportFormatInfo {
  id: ExportFormat;
  label: string;
  description: string;
}

const EXPORT_FORMATS: ExportFormatInfo[] = [
  { id: "hef-vision", label: "HEF (Vision)", description: "Hailo HEF for Hailo-10H accelerator" },
  { id: "hef-llm", label: "HEF (LLM)", description: "Hailo HEF for LLM inference" },
  { id: "gguf", label: "GGUF", description: "Quantized GGUF for llama.cpp / RPi CPU" },
  { id: "onnx", label: "ONNX", description: "ONNX for portable inference" },
  { id: "torchscript", label: "TorchScript", description: "Traced PyTorch for RL deployment" },
];

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
  formatGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "8px",
  },
  formatCard: (selected: boolean) => ({
    padding: "12px",
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
    transition: "border-color 0.15s ease, background 0.15s ease",
  }),
  formatLabel: {
    fontSize: "13px",
    fontWeight: 600 as const,
    color: "var(--vscode-foreground)",
  },
  formatDesc: {
    fontSize: "11px",
    color: "var(--vscode-descriptionForeground)",
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
    width: "100%",
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
    width: "100%",
  },
  button: {
    padding: "8px 20px",
    fontSize: "13px",
    fontWeight: 600 as const,
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    background: "var(--vscode-button-background)",
    color: "var(--vscode-button-foreground)",
    fontFamily: "inherit",
    alignSelf: "flex-start" as const,
  },
  warningBox: {
    background: "rgba(255, 193, 7, 0.1)",
    border: "1px solid rgba(255, 193, 7, 0.3)",
    borderRadius: "6px",
    padding: "12px 16px",
    fontSize: "12px",
    lineHeight: "1.6",
    color: "#e2b93d",
  },
  warningTitle: {
    fontWeight: 700 as const,
    marginBottom: "6px",
    fontSize: "13px",
  },
  codeBlock: {
    background: "var(--vscode-input-background)",
    borderRadius: "4px",
    padding: "8px 12px",
    fontSize: "12px",
    fontFamily: "monospace",
    color: "var(--vscode-foreground)",
    marginTop: "6px",
    overflowX: "auto" as const,
  },
};

// ── Detect Windows ──────────────────────────────────────────────────

function isWindows(): boolean {
  return navigator.userAgent.indexOf("Windows") !== -1 ||
    navigator.platform.indexOf("Win") !== -1;
}

// ── ExportPage Component ────────────────────────────────────────────

const ExportPage: React.FC = () => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("gguf");
  const [modelPath, setModelPath] = useState("");
  const [outputPath, setOutputPath] = useState("");
  const [quantMethod, setQuantMethod] = useState("Q4_K_M");
  const [calibrationDir, setCalibrationDir] = useState("");
  const [baseModel, setBaseModel] = useState("Qwen/Qwen2.5-1.5B-Instruct");
  const [steps, setSteps] = useState<ExportStepData[]>([]);
  const [exporting, setExporting] = useState(false);

  // Listen for export progress from extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg.type !== "string") { return; }

      switch (msg.type) {
        case "exportSteps":
          setSteps(msg.steps ?? []);
          break;
        case "exportDone":
          setExporting(false);
          break;
        case "exportError":
          setExporting(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleExport = () => {
    if (!modelPath.trim() || !outputPath.trim()) { return; }
    setExporting(true);
    setSteps([]);

    vscode.postMessage({
      type: "startExport",
      format: selectedFormat,
      modelPath: modelPath.trim(),
      outputPath: outputPath.trim(),
      quantMethod,
      calibrationDir: calibrationDir.trim(),
      baseModel: baseModel.trim(),
    });
  };

  const showHailoWarning = isWindows() && (selectedFormat === "hef-vision" || selectedFormat === "hef-llm");

  return (
    <div style={styles.container}>
      {/* Format selector */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Export Format</div>
        <div style={styles.formatGrid}>
          {EXPORT_FORMATS.map((fmt) => (
            <div
              key={fmt.id}
              style={styles.formatCard(selectedFormat === fmt.id)}
              onClick={() => {
                setSelectedFormat(fmt.id);
                setSteps([]);
              }}
            >
              <div style={styles.formatLabel}>{fmt.label}</div>
              <div style={styles.formatDesc}>{fmt.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Hailo DFC warning for Windows */}
      {showHailoWarning && (
        <div style={styles.warningBox}>
          <div style={styles.warningTitle}>
            {"\u26A0"} Hailo DFC requires Linux
          </div>
          <div>
            The Hailo Data Flow Compiler (DFC) only runs on Linux.
            On Windows, the exporter will attempt to use WSL2.
            If WSL2 is not available, the export will fall back to ONNX/GGUF format.
          </div>
          <div style={{ marginTop: "8px", fontWeight: 600 }}>WSL2 Setup:</div>
          <div style={styles.codeBlock}>
            {"wsl --install -d Ubuntu-22.04\n"}
            {"wsl -d Ubuntu-22.04\n"}
            {"pip install hailo_sdk_client hailo_model_zoo"}
          </div>
        </div>
      )}

      {/* Config form */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Configuration</div>

        {/* Model path — always shown */}
        <div>
          <div style={styles.fieldLabel}>
            {selectedFormat === "gguf"
              ? "LoRA Adapter Path"
              : selectedFormat === "torchscript"
                ? "SB3 Model Path (.zip)"
                : selectedFormat === "hef-vision"
                  ? "ONNX Model Path"
                  : selectedFormat === "hef-llm"
                    ? "Merged Model Path"
                    : "PyTorch Model Path (.pt)"}
          </div>
          <input
            style={styles.input}
            placeholder="Path to model file or directory..."
            value={modelPath}
            onChange={(e) => setModelPath(e.target.value)}
          />
        </div>

        {/* GGUF-specific: base model */}
        {selectedFormat === "gguf" && (
          <div>
            <div style={styles.fieldLabel}>Base Model (HuggingFace ID or path)</div>
            <input
              style={styles.input}
              placeholder="e.g., Qwen/Qwen2.5-1.5B-Instruct"
              value={baseModel}
              onChange={(e) => setBaseModel(e.target.value)}
            />
          </div>
        )}

        {/* GGUF-specific: quantization method */}
        {selectedFormat === "gguf" && (
          <div>
            <div style={styles.fieldLabel}>Quantization Method</div>
            <select
              style={styles.select}
              value={quantMethod}
              onChange={(e) => setQuantMethod(e.target.value)}
            >
              <option value="Q4_K_M">Q4_K_M (recommended for RPi)</option>
              <option value="Q4_K_S">Q4_K_S (smaller, slightly less accurate)</option>
              <option value="Q5_K_M">Q5_K_M (balanced)</option>
              <option value="Q5_K_S">Q5_K_S</option>
              <option value="Q8_0">Q8_0 (highest quality quantized)</option>
              <option value="F16">F16 (no quantization)</option>
            </select>
          </div>
        )}

        {/* HEF Vision-specific: calibration directory */}
        {selectedFormat === "hef-vision" && (
          <div>
            <div style={styles.fieldLabel}>Calibration Images Directory</div>
            <input
              style={styles.input}
              placeholder="Path to directory with calibration images..."
              value={calibrationDir}
              onChange={(e) => setCalibrationDir(e.target.value)}
            />
          </div>
        )}

        {/* Output path — always shown */}
        <div>
          <div style={styles.fieldLabel}>Output Path</div>
          <input
            style={styles.input}
            placeholder={
              selectedFormat === "gguf"
                ? "e.g., ./exports/model-Q4_K_M.gguf"
                : selectedFormat === "hef-vision" || selectedFormat === "hef-llm"
                  ? "e.g., ./exports/model.hef"
                  : selectedFormat === "onnx"
                    ? "e.g., ./exports/model.onnx"
                    : "e.g., ./exports/policy.pt"
            }
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
          />
        </div>

        <button
          style={{
            ...styles.button,
            opacity: exporting || !modelPath.trim() || !outputPath.trim() ? 0.5 : 1,
            cursor: exporting || !modelPath.trim() || !outputPath.trim() ? "not-allowed" : "pointer",
          }}
          onClick={handleExport}
          disabled={exporting || !modelPath.trim() || !outputPath.trim()}
        >
          {exporting ? "Exporting..." : "Export"}
        </button>
      </div>

      {/* Progress stepper */}
      {steps.length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Export Progress</div>
          <ExportStepper steps={steps} />
        </div>
      )}
    </div>
  );
};

export default ExportPage;
