// Copyright 2026 VirtusCo
// Training page — Vision, LLM, and RL training tabs with live metrics

import React, { useState, useMemo } from "react";
import { useAIStudioStore } from "../store/aiStudioStore";
import { vscode } from "../vscodeApi";
import LiveLossChart from "../components/LiveLossChart";

// ── Model options from registry ────────────────────────────────────

const VISION_MODELS = [
  { id: "yolov8n.pt", label: "YOLOv8n (3.2M)" },
  { id: "yolov8s.pt", label: "YOLOv8s (11.2M)" },
  { id: "yolov10n.pt", label: "YOLOv10n (2.7M)" },
];

const LLM_MODELS = [
  { id: "unsloth/Qwen2.5-1.5B-Instruct", label: "Qwen2.5-1.5B" },
  { id: "unsloth/Qwen2-1.5B-Instruct", label: "Qwen2-1.5B" },
  { id: "unsloth/DeepSeek-R1-Distill-Qwen-1.5B", label: "DeepSeek-R1-1.5B" },
  { id: "unsloth/Llama-3.2-1B-Instruct", label: "Llama 3.2 1B" },
];

// ── Metric types ───────────────────────────────────────────────────

interface VisionMetric {
  epoch: number;
  box_loss: number;
  cls_loss: number;
  map50: number;
  map50_95: number;
  precision: number;
  recall: number;
  lr: number;
}

interface LLMMetric {
  step: number;
  loss: number;
  eval_loss: number;
  learning_rate: number;
  epoch: number;
  adapter_size_mb: number;
}

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
    borderBottom: active
      ? "2px solid var(--vscode-focusBorder, #007acc)"
      : "2px solid transparent",
    background: "transparent",
    color: active
      ? "var(--vscode-foreground)"
      : "var(--vscode-descriptionForeground)",
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
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  label: {
    fontSize: "11px",
    fontWeight: 600 as const,
    color: "var(--vscode-descriptionForeground)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  input: {
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
    cursor: "pointer",
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "var(--vscode-foreground)",
    cursor: "pointer",
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
    whiteSpace: "nowrap" as const,
  },
  buttonDisabled: {
    padding: "8px 20px",
    fontSize: "13px",
    fontWeight: 600 as const,
    border: "none",
    borderRadius: "4px",
    cursor: "not-allowed",
    background: "var(--vscode-button-background)",
    color: "var(--vscode-button-foreground)",
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
    opacity: 0.5,
  },
  buttonDanger: {
    padding: "8px 20px",
    fontSize: "13px",
    fontWeight: 600 as const,
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    background: "#c0392b",
    color: "#fff",
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
  },
  actionsRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
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
    fontFamily: "monospace",
  },
  progressOuter: {
    width: "100%",
    height: "20px",
    background: "var(--vscode-input-background)",
    borderRadius: "4px",
    overflow: "hidden" as const,
    position: "relative" as const,
  },
  progressText: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: 600 as const,
    color: "#fff",
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
  },
  gpuStrip: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    padding: "8px 12px",
    background: "var(--vscode-sideBar-background, rgba(255,255,255,0.03))",
    borderRadius: "4px",
    fontSize: "12px",
    color: "var(--vscode-foreground)",
  },
  gpuStripLabel: {
    color: "var(--vscode-descriptionForeground)",
    fontSize: "11px",
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
  advisorBox: {
    background: "rgba(33, 150, 243, 0.08)",
    border: "1px solid rgba(33, 150, 243, 0.3)",
    borderRadius: "6px",
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  advisorTitle: {
    fontSize: "12px",
    fontWeight: 700 as const,
    color: "#2196f3",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  advisorText: {
    fontSize: "12px",
    color: "var(--vscode-foreground)",
    lineHeight: "1.5",
  },
  placeholder: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    height: "300px",
    gap: "12px",
    color: "var(--vscode-descriptionForeground)",
  },
};

// ── Vision Training Tab ────────────────────────────────────────────

const VisionTab: React.FC = () => {
  const trainingStatus = useAIStudioStore((s) => s.trainingStatus);
  const trainingMetrics = useAIStudioStore((s) => s.trainingMetrics);
  const gpuState = useAIStudioStore((s) => s.gpuState);
  const activeJobId = useAIStudioStore((s) => s.activeJobId);
  const setTrainingStatus = useAIStudioStore((s) => s.setTrainingStatus);
  const setActiveJobId = useAIStudioStore((s) => s.setActiveJobId);

  const [model, setModel] = useState("yolov8n.pt");
  const [datasetPath, setDatasetPath] = useState("");
  const [epochs, setEpochs] = useState(100);
  const [batchSize, setBatchSize] = useState(16);
  const [imgsz, setImgsz] = useState(640);
  const [lr, setLr] = useState(0.01);
  const [earlyStopping, setEarlyStopping] = useState(50);
  const [exportOnnx, setExportOnnx] = useState(false);

  // Parse vision-specific metrics from the generic training metrics
  const visionMetrics: VisionMetric[] = useMemo(() => {
    return trainingMetrics
      .filter((m) => typeof (m as unknown as VisionMetric).box_loss === "number")
      .map((m) => m as unknown as VisionMetric);
  }, [trainingMetrics]);

  const latestMetric = visionMetrics.length > 0 ? visionMetrics[visionMetrics.length - 1] : null;
  const isRunning = trainingStatus === "running";

  const lossHistory = useMemo(
    () => visionMetrics.map((m) => ({ epoch: m.epoch, value: m.box_loss + m.cls_loss })),
    [visionMetrics]
  );

  const handleStart = () => {
    if (!datasetPath.trim()) return;
    setTrainingStatus("running");
    vscode.postMessage({
      type: "startTraining",
      config: {
        model_name: model,
        run_type: "vision",
        dataset_path: datasetPath.trim(),
        epochs,
        batch_size: batchSize,
        learning_rate: lr,
        method: "full",
        dtype: "fp32",
        lora_r: null,
        // Vision-specific fields sent via extended config
        imgsz,
        early_stopping_patience: earlyStopping,
        export_onnx_after: exportOnnx,
        project_name: "porter_vision",
        augmentation: true,
      },
    });
  };

  const handleCancel = () => {
    if (activeJobId) {
      vscode.postMessage({ type: "cancelTraining", run_id: activeJobId });
      setTrainingStatus("cancelled");
      setActiveJobId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Config form */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Vision Training Configuration</div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Model</label>
            <select
              style={styles.select}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isRunning}
            >
              {VISION_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Dataset Path</label>
            <input
              style={styles.input}
              placeholder="Path to YOLO dataset (data.yaml)"
              value={datasetPath}
              onChange={(e) => setDatasetPath(e.target.value)}
              disabled={isRunning}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Epochs</label>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={1000}
              value={epochs}
              onChange={(e) => setEpochs(Number(e.target.value))}
              disabled={isRunning}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Batch Size</label>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={128}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              disabled={isRunning}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Image Size</label>
            <select
              style={styles.select}
              value={imgsz}
              onChange={(e) => setImgsz(Number(e.target.value))}
              disabled={isRunning}
            >
              <option value={320}>320</option>
              <option value={416}>416</option>
              <option value={640}>640</option>
              <option value={1280}>1280</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Learning Rate</label>
            <input
              style={styles.input}
              type="number"
              step={0.001}
              min={0.0001}
              max={0.1}
              value={lr}
              onChange={(e) => setLr(Number(e.target.value))}
              disabled={isRunning}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Early Stopping (patience)</label>
            <input
              style={styles.input}
              type="number"
              min={0}
              max={500}
              value={earlyStopping}
              onChange={(e) => setEarlyStopping(Number(e.target.value))}
              disabled={isRunning}
            />
          </div>

          <div style={{ ...styles.formGroup, justifyContent: "flex-end" }}>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={exportOnnx}
                onChange={(e) => setExportOnnx(e.target.checked)}
                disabled={isRunning}
              />
              Export ONNX after training
            </label>
          </div>
        </div>

        <div style={styles.actionsRow}>
          <button
            style={isRunning || !datasetPath.trim() ? styles.buttonDisabled : styles.button}
            onClick={handleStart}
            disabled={isRunning || !datasetPath.trim()}
          >
            {isRunning ? "Training..." : "Start Training"}
          </button>
          {isRunning && (
            <button style={styles.buttonDanger} onClick={handleCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Live metrics */}
      {visionMetrics.length > 0 && (
        <>
          {/* Stat cards */}
          <div style={styles.statsGrid}>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Loss</div>
              <div style={styles.statValue}>
                {latestMetric
                  ? (latestMetric.box_loss + latestMetric.cls_loss).toFixed(4)
                  : "--"}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>mAP50</div>
              <div style={styles.statValue}>
                {latestMetric ? latestMetric.map50.toFixed(4) : "--"}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Precision</div>
              <div style={styles.statValue}>
                {latestMetric ? latestMetric.precision.toFixed(4) : "--"}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Recall</div>
              <div style={styles.statValue}>
                {latestMetric ? latestMetric.recall.toFixed(4) : "--"}
              </div>
            </div>
          </div>

          {/* Loss trend chart */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Loss Trend</div>
            <LiveLossChart data={lossHistory} color="#e74c3c" label="Total Loss" />
          </div>

          {/* Progress bar */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Progress</div>
            <div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--vscode-descriptionForeground)",
                  marginBottom: "6px",
                }}
              >
                Epoch {latestMetric ? latestMetric.epoch : 0} / {epochs}
              </div>
              <div style={styles.progressOuter}>
                <div
                  style={{
                    width: `${latestMetric ? (latestMetric.epoch / epochs) * 100 : 0}%`,
                    height: "100%",
                    background: "#007acc",
                    borderRadius: "4px",
                    transition: "width 0.3s ease",
                  }}
                />
                <div style={styles.progressText}>
                  {latestMetric ? ((latestMetric.epoch / epochs) * 100).toFixed(1) : "0.0"}%
                </div>
              </div>
            </div>
          </div>

          {/* GPU monitor strip */}
          {gpuState && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>GPU Monitor</div>
              <div style={styles.gpuStrip}>
                <span>
                  <span style={styles.gpuStripLabel}>VRAM: </span>
                  {gpuState.vram_used_mb.toFixed(0)} / {gpuState.vram_total_mb.toFixed(0)} MB
                </span>
                <span>
                  <span style={styles.gpuStripLabel}>Power: </span>
                  {gpuState.power_draw_w.toFixed(0)}W / {gpuState.power_limit_w.toFixed(0)}W
                </span>
                <span>
                  <span style={styles.gpuStripLabel}>Temp: </span>
                  {gpuState.temperature_c}&deg;C
                </span>
                <span>
                  <span style={styles.gpuStripLabel}>Util: </span>
                  {gpuState.gpu_util_pct}%
                </span>
              </div>
              {gpuState.is_throttled && (
                <div style={styles.throttleBanner}>
                  <span>&#x26A0;</span>
                  GPU throttling detected — consider reducing batch size
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── LLM Fine-Tuning Tab ────────────────────────────────────────────

const LLMTab: React.FC = () => {
  const trainingStatus = useAIStudioStore((s) => s.trainingStatus);
  const trainingMetrics = useAIStudioStore((s) => s.trainingMetrics);
  const gpuState = useAIStudioStore((s) => s.gpuState);
  const vramRecommendation = useAIStudioStore((s) => s.vramRecommendation);
  const activeJobId = useAIStudioStore((s) => s.activeJobId);
  const setTrainingStatus = useAIStudioStore((s) => s.setTrainingStatus);
  const setActiveJobId = useAIStudioStore((s) => s.setActiveJobId);

  const [baseModel, setBaseModel] = useState("unsloth/Qwen2.5-1.5B-Instruct");
  const [datasetPath, setDatasetPath] = useState("");
  const [method, setMethod] = useState<"full" | "lora" | "qlora">("lora");
  const [loraR, setLoraR] = useState(16);
  const [loraAlpha, setLoraAlpha] = useState(32);
  const [loraDropout, setLoraDropout] = useState(0.05);
  const [llmEpochs, setLlmEpochs] = useState(3);
  const [batchSize, setBatchSize] = useState(4);
  const [gradAccum, setGradAccum] = useState(4);
  const [learningRate, setLearningRate] = useState(0.0002);
  const [maxSeqLen, setMaxSeqLen] = useState(1024);

  // Parse LLM-specific metrics from the generic training metrics
  const llmMetrics: LLMMetric[] = useMemo(() => {
    return trainingMetrics
      .filter(
        (m) =>
          typeof (m as unknown as LLMMetric).adapter_size_mb === "number" ||
          (typeof (m as unknown as LLMMetric).step === "number" &&
            typeof (m as unknown as LLMMetric).eval_loss === "number")
      )
      .map((m) => m as unknown as LLMMetric);
  }, [trainingMetrics]);

  const latestMetric = llmMetrics.length > 0 ? llmMetrics[llmMetrics.length - 1] : null;
  const isRunning = trainingStatus === "running";

  const lossHistory = useMemo(
    () => llmMetrics.map((m) => ({ epoch: m.step, value: m.loss })),
    [llmMetrics]
  );

  // Compute perplexity
  const perplexity = latestMetric && latestMetric.eval_loss > 0
    ? Math.exp(latestMetric.eval_loss)
    : null;

  // Compute total steps estimate
  const totalStepsEstimate = llmEpochs * 100; // rough estimate, actual depends on dataset

  // VRAM advisor recommendation
  const advisorMethod = vramRecommendation?.method ?? "lora";
  const advisorReason = vramRecommendation?.reason ?? "Connect GPU to get recommendation";

  const handleStart = () => {
    if (!datasetPath.trim()) return;
    setTrainingStatus("running");
    vscode.postMessage({
      type: "startTraining",
      config: {
        model_name: baseModel,
        run_type: "llm",
        dataset_path: datasetPath.trim(),
        epochs: llmEpochs,
        batch_size: batchSize,
        learning_rate: learningRate,
        method,
        dtype: method === "qlora" ? "nf4" : "bf16",
        lora_r: method !== "full" ? loraR : null,
        // LLM-specific fields
        lora_alpha: loraAlpha,
        lora_dropout: loraDropout,
        grad_accumulation: gradAccum,
        max_seq_length: maxSeqLen,
        warmup_ratio: 0.03,
        eval_steps: 50,
        save_steps: 100,
        output_dir: "./runs/llm",
        target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"],
        export_after: { merge_weights: false, export_gguf: false },
      },
    });
  };

  const handleCancel = () => {
    if (activeJobId) {
      vscode.postMessage({ type: "cancelTraining", run_id: activeJobId });
      setTrainingStatus("cancelled");
      setActiveJobId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* VRAM Advisor */}
      <div style={styles.advisorBox}>
        <div style={styles.advisorTitle}>VRAM Advisor</div>
        <div style={styles.advisorText}>
          <strong>Recommended method: </strong>
          <span
            style={{
              fontWeight: 700,
              color:
                advisorMethod === "full"
                  ? "#4caf50"
                  : advisorMethod === "lora"
                    ? "#2196f3"
                    : "#ff9800",
            }}
          >
            {advisorMethod.toUpperCase()}
          </span>
          {vramRecommendation && vramRecommendation.lora_r !== null && (
            <span> (r={vramRecommendation.lora_r})</span>
          )}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--vscode-descriptionForeground)",
            fontStyle: "italic",
          }}
        >
          {advisorReason}
        </div>
      </div>

      {/* Config form */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>LLM Fine-Tuning Configuration</div>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Base Model</label>
            <select
              style={styles.select}
              value={baseModel}
              onChange={(e) => setBaseModel(e.target.value)}
              disabled={isRunning}
            >
              {LLM_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Dataset (JSONL)</label>
            <input
              style={styles.input}
              placeholder="Path to ShareGPT JSONL file"
              value={datasetPath}
              onChange={(e) => setDatasetPath(e.target.value)}
              disabled={isRunning}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Method</label>
            <select
              style={styles.select}
              value={method}
              onChange={(e) => setMethod(e.target.value as "full" | "lora" | "qlora")}
              disabled={isRunning}
            >
              <option value="full">Full Fine-Tuning</option>
              <option value="lora">LoRA</option>
              <option value="qlora">QLoRA (4-bit)</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Epochs</label>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={50}
              value={llmEpochs}
              onChange={(e) => setLlmEpochs(Number(e.target.value))}
              disabled={isRunning}
            />
          </div>

          {/* LoRA params — only shown for lora/qlora */}
          {method !== "full" && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>LoRA Rank (r)</label>
                <select
                  style={styles.select}
                  value={loraR}
                  onChange={(e) => setLoraR(Number(e.target.value))}
                  disabled={isRunning}
                >
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                  <option value={16}>16</option>
                  <option value={32}>32</option>
                  <option value={64}>64</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>LoRA Alpha</label>
                <input
                  style={styles.input}
                  type="number"
                  min={1}
                  max={128}
                  value={loraAlpha}
                  onChange={(e) => setLoraAlpha(Number(e.target.value))}
                  disabled={isRunning}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>LoRA Dropout</label>
                <input
                  style={styles.input}
                  type="number"
                  step={0.01}
                  min={0}
                  max={0.5}
                  value={loraDropout}
                  onChange={(e) => setLoraDropout(Number(e.target.value))}
                  disabled={isRunning}
                />
              </div>
            </>
          )}

          <div style={styles.formGroup}>
            <label style={styles.label}>Batch Size</label>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={32}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              disabled={isRunning}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Gradient Accumulation</label>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={64}
              value={gradAccum}
              onChange={(e) => setGradAccum(Number(e.target.value))}
              disabled={isRunning}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Learning Rate</label>
            <input
              style={styles.input}
              type="number"
              step={0.00001}
              min={0.000001}
              max={0.01}
              value={learningRate}
              onChange={(e) => setLearningRate(Number(e.target.value))}
              disabled={isRunning}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Max Sequence Length</label>
            <select
              style={styles.select}
              value={maxSeqLen}
              onChange={(e) => setMaxSeqLen(Number(e.target.value))}
              disabled={isRunning}
            >
              <option value={512}>512</option>
              <option value={1024}>1024</option>
              <option value={2048}>2048</option>
              <option value={4096}>4096</option>
            </select>
          </div>
        </div>

        <div style={styles.actionsRow}>
          <button
            style={isRunning || !datasetPath.trim() ? styles.buttonDisabled : styles.button}
            onClick={handleStart}
            disabled={isRunning || !datasetPath.trim()}
          >
            {isRunning ? "Fine-Tuning..." : "Start Fine-Tuning"}
          </button>
          {isRunning && (
            <button style={styles.buttonDanger} onClick={handleCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Live metrics */}
      {llmMetrics.length > 0 && (
        <>
          {/* Stat cards */}
          <div style={styles.statsGrid}>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Loss</div>
              <div style={styles.statValue}>
                {latestMetric ? latestMetric.loss.toFixed(4) : "--"}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Eval Loss</div>
              <div style={styles.statValue}>
                {latestMetric ? latestMetric.eval_loss.toFixed(4) : "--"}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Perplexity</div>
              <div style={styles.statValue}>
                {perplexity !== null ? perplexity.toFixed(2) : "--"}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Learning Rate</div>
              <div style={{ ...styles.statValue, fontSize: "14px" }}>
                {latestMetric ? latestMetric.learning_rate.toExponential(2) : "--"}
              </div>
            </div>
          </div>

          {/* Loss trend chart */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Loss Trend</div>
            <LiveLossChart data={lossHistory} color="#2196f3" label="Training Loss" />
          </div>

          {/* Progress */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Progress</div>
            <div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--vscode-descriptionForeground)",
                  marginBottom: "6px",
                }}
              >
                Step {latestMetric ? latestMetric.step : 0} / ~{totalStepsEstimate}
                {latestMetric && (
                  <span style={{ marginLeft: "12px" }}>
                    Epoch {latestMetric.epoch.toFixed(2)}
                    {latestMetric.adapter_size_mb > 0 && (
                      <span style={{ marginLeft: "12px" }}>
                        Adapter: {latestMetric.adapter_size_mb.toFixed(1)} MB
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div style={styles.progressOuter}>
                <div
                  style={{
                    width: `${latestMetric ? Math.min((latestMetric.step / totalStepsEstimate) * 100, 100) : 0}%`,
                    height: "100%",
                    background: "#2196f3",
                    borderRadius: "4px",
                    transition: "width 0.3s ease",
                  }}
                />
                <div style={styles.progressText}>
                  {latestMetric
                    ? Math.min((latestMetric.step / totalStepsEstimate) * 100, 100).toFixed(1)
                    : "0.0"}
                  %
                </div>
              </div>
            </div>
          </div>

          {/* GPU monitor strip */}
          {gpuState && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>GPU Monitor</div>
              <div style={styles.gpuStrip}>
                <span>
                  <span style={styles.gpuStripLabel}>VRAM: </span>
                  {gpuState.vram_used_mb.toFixed(0)} / {gpuState.vram_total_mb.toFixed(0)} MB
                </span>
                <span>
                  <span style={styles.gpuStripLabel}>Power: </span>
                  {gpuState.power_draw_w.toFixed(0)}W / {gpuState.power_limit_w.toFixed(0)}W
                </span>
                <span>
                  <span style={styles.gpuStripLabel}>Temp: </span>
                  {gpuState.temperature_c}&deg;C
                </span>
                <span>
                  <span style={styles.gpuStripLabel}>Util: </span>
                  {gpuState.gpu_util_pct}%
                </span>
              </div>
              {gpuState.is_throttled && (
                <div style={styles.throttleBanner}>
                  <span>&#x26A0;</span>
                  GPU throttling detected — consider reducing batch size or max_seq_length
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── RL Placeholder Tab ─────────────────────────────────────────────

const RLTab: React.FC = () => (
  <div style={styles.placeholder}>
    <div style={{ fontSize: "32px", opacity: 0.4 }}>&#x1F916;</div>
    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--vscode-foreground)" }}>
      Reinforcement Learning
    </div>
    <div style={{ fontSize: "12px" }}>Coming in Phase 6</div>
    <div style={{ fontSize: "11px", maxWidth: "400px", textAlign: "center", lineHeight: "1.6" }}>
      SAC/PPO navigation training for Porter autonomous movement in airport environments.
    </div>
  </div>
);

// ── Main TrainingPage ──────────────────────────────────────────────

type TrainingTab = "vision" | "llm" | "rl";

const TrainingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TrainingTab>("vision");

  return (
    <div style={styles.container}>
      <div style={styles.tabBar}>
        <button
          style={styles.tab(activeTab === "vision")}
          onClick={() => setActiveTab("vision")}
        >
          Vision
        </button>
        <button
          style={styles.tab(activeTab === "llm")}
          onClick={() => setActiveTab("llm")}
        >
          LLM
        </button>
        <button
          style={styles.tab(activeTab === "rl")}
          onClick={() => setActiveTab("rl")}
        >
          RL
        </button>
      </div>

      {activeTab === "vision" && <VisionTab />}
      {activeTab === "llm" && <LLMTab />}
      {activeTab === "rl" && <RLTab />}
    </div>
  );
};

export default TrainingPage;
