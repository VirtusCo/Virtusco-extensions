// Copyright 2026 VirtusCo
// Export stepper component — multi-step progress display with expandable logs

import React, { useState } from "react";

// ── Types ───────────────────────────────────────────────────────────

export interface ExportStepData {
  name: string;
  status: "pending" | "running" | "done" | "error";
  log: string;
}

interface ExportStepperProps {
  steps: ExportStepData[];
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  progressBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  },
  progressOuter: {
    flex: 1,
    height: "6px",
    background: "var(--vscode-input-background)",
    borderRadius: "3px",
    overflow: "hidden" as const,
  },
  progressInner: (pct: number) => ({
    width: `${pct}%`,
    height: "100%",
    background: "var(--vscode-focusBorder, #007acc)",
    borderRadius: "3px",
    transition: "width 0.3s ease",
  }),
  progressText: {
    fontSize: "12px",
    fontWeight: 600 as const,
    color: "var(--vscode-foreground)",
    minWidth: "40px",
    textAlign: "right" as const,
  },
  stepRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    position: "relative" as const,
  },
  stepIndicator: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    minWidth: "28px",
  },
  stepCircle: (status: ExportStepData["status"]) => {
    const colors: Record<ExportStepData["status"], { bg: string; border: string }> = {
      pending: { bg: "transparent", border: "var(--vscode-descriptionForeground)" },
      running: { bg: "var(--vscode-focusBorder, #007acc)", border: "var(--vscode-focusBorder, #007acc)" },
      done: { bg: "#2ecc71", border: "#2ecc71" },
      error: { bg: "#e74c3c", border: "#e74c3c" },
    };
    const c = colors[status];
    return {
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      border: `2px solid ${c.border}`,
      background: c.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "12px",
      fontWeight: 700 as const,
      color: status === "pending" ? "var(--vscode-descriptionForeground)" : "#fff",
      position: "relative" as const,
      flexShrink: 0,
    };
  },
  connector: (isLast: boolean, status: ExportStepData["status"]) => ({
    width: "2px",
    flex: 1,
    minHeight: isLast ? "0px" : "16px",
    background:
      status === "done" || status === "error"
        ? status === "done"
          ? "#2ecc71"
          : "#e74c3c"
        : "var(--vscode-panel-border, rgba(255,255,255,0.1))",
    display: isLast ? "none" : ("block" as const),
  }),
  stepContent: {
    flex: 1,
    paddingBottom: "12px",
  },
  stepName: (status: ExportStepData["status"]) => ({
    fontSize: "13px",
    fontWeight: 600 as const,
    color:
      status === "error"
        ? "#e74c3c"
        : status === "running"
          ? "var(--vscode-foreground)"
          : status === "done"
            ? "#2ecc71"
            : "var(--vscode-descriptionForeground)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  }),
  logViewer: {
    marginTop: "6px",
    maxHeight: "120px",
    overflowY: "auto" as const,
    fontSize: "11px",
    fontFamily: "monospace",
    background: "var(--vscode-input-background)",
    borderRadius: "4px",
    padding: "8px 10px",
    color: "var(--vscode-foreground)",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    lineHeight: "1.5",
  },
  spinnerKeyframes: `
    @keyframes export-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
  spinner: {
    width: "14px",
    height: "14px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "export-spin 0.8s linear infinite",
  },
};

// ── Status Icons ────────────────────────────────────────────────────

function StepIcon({ status, index }: { status: ExportStepData["status"]; index: number }) {
  switch (status) {
    case "done":
      return <span>{"\u2713"}</span>;
    case "error":
      return <span>{"\u2717"}</span>;
    case "running":
      return <div style={styles.spinner} />;
    case "pending":
    default:
      return <span>{index + 1}</span>;
  }
}

// ── ExportStepper Component ─────────────────────────────────────────

const ExportStepper: React.FC<ExportStepperProps> = ({ steps }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Calculate progress percentage
  const doneCount = steps.filter((s) => s.status === "done").length;
  const runningCount = steps.filter((s) => s.status === "running").length;
  const errorCount = steps.filter((s) => s.status === "error").length;
  const total = steps.length;
  const progressPct = total > 0 ? Math.round(((doneCount + runningCount * 0.5) / total) * 100) : 0;

  // Auto-expand the running or errored step
  const activeIndex = steps.findIndex((s) => s.status === "running" || s.status === "error");

  return (
    <div style={styles.container}>
      <style>{styles.spinnerKeyframes}</style>

      {/* Progress bar */}
      <div style={styles.progressBar}>
        <div style={styles.progressOuter}>
          <div style={styles.progressInner(errorCount > 0 ? progressPct : progressPct)} />
        </div>
        <div style={styles.progressText as React.CSSProperties}>
          {errorCount > 0 ? "Error" : doneCount === total ? "Done" : `${progressPct}%`}
        </div>
      </div>

      {/* Steps */}
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isExpanded =
          expandedIndex === index ||
          (expandedIndex === null && activeIndex === index && step.log.trim().length > 0);
        const hasLog = step.log.trim().length > 0;

        return (
          <div key={index} style={styles.stepRow}>
            {/* Circle + connector */}
            <div style={styles.stepIndicator}>
              <div style={styles.stepCircle(step.status)}>
                <StepIcon status={step.status} index={index} />
              </div>
              <div style={styles.connector(isLast, step.status)} />
            </div>

            {/* Step content */}
            <div style={styles.stepContent}>
              <div
                style={styles.stepName(step.status)}
                onClick={() => {
                  if (hasLog) {
                    setExpandedIndex(isExpanded ? null : index);
                  }
                }}
              >
                {step.name}
                {hasLog && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--vscode-descriptionForeground)",
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s ease",
                      display: "inline-block",
                    }}
                  >
                    {"\u25B6"}
                  </span>
                )}
              </div>

              {isExpanded && hasLog && (
                <div style={styles.logViewer}>{step.log.trimEnd()}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ExportStepper;
