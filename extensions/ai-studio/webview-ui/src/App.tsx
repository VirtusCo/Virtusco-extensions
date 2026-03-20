// Copyright 2026 VirtusCo
// Main app shell — sidebar navigation + page routing

import React, { useEffect } from "react";
import { useAIStudioStore, type PageId } from "./store/aiStudioStore";
import DashboardPage from "./pages/DashboardPage";
import DatasetPage from "./pages/DatasetPage";
import ResearchPage from "./pages/ResearchPage";
import TrainingPage from "./pages/TrainingPage";
import BenchmarkPage from "./pages/BenchmarkPage";
import ExportPage from "./pages/ExportPage";
import InferencePage from "./pages/InferencePage";
import DeployPage from "./pages/DeployPage";
import { vscode } from "./vscodeApi";

// ── Navigation items ────────────────────────────────────────────────

interface NavItem {
  id: PageId;
  icon: string;
  label: string;
  phase: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", icon: "\u2302", label: "Dashboard", phase: 1 },
  { id: "dataset", icon: "\u2630", label: "Datasets", phase: 2 },
  { id: "research", icon: "\u2733", label: "Research", phase: 2 },
  { id: "training", icon: "\u25B6", label: "Training", phase: 2 },
  { id: "benchmark", icon: "\u2261", label: "Benchmark", phase: 3 },
  { id: "export", icon: "\u21E9", label: "Export", phase: 3 },
  { id: "inference", icon: "\u2699", label: "Inference", phase: 3 },
  { id: "deploy", icon: "\u21EA", label: "Deploy", phase: 4 },
];

// ── Styles ──────────────────────────────────────────────────────────

const styles = {
  root: {
    display: "flex",
    height: "100vh",
    width: "100%",
    background: "var(--vscode-sideBar-background, var(--vscode-editor-background))",
    color: "var(--vscode-foreground)",
    fontFamily: "var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif)",
    fontSize: "13px",
    overflow: "hidden" as const,
  },
  sidebar: {
    width: "200px",
    minWidth: "200px",
    background: "var(--vscode-sideBar-background, #1e1e1e)",
    borderRight: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.08))",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden" as const,
  },
  sidebarHeader: {
    padding: "16px 14px 12px",
    fontSize: "11px",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
    color: "var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground))",
    borderBottom: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.08))",
  },
  nav: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "6px 0",
  },
  navItem: (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 14px",
    fontSize: "13px",
    cursor: "pointer",
    color: active
      ? "var(--vscode-list-activeSelectionForeground, #fff)"
      : "var(--vscode-foreground)",
    background: active
      ? "var(--vscode-list-activeSelectionBackground, rgba(255,255,255,0.1))"
      : "transparent",
    border: "none",
    borderLeft: active ? "2px solid var(--vscode-focusBorder, #007acc)" : "2px solid transparent",
    width: "100%",
    textAlign: "left" as const,
    fontFamily: "inherit",
    transition: "background 0.15s ease",
  }),
  navIcon: {
    fontSize: "15px",
    width: "20px",
    textAlign: "center" as const,
  },
  main: {
    flex: 1,
    overflow: "auto" as const,
    padding: "16px",
    background: "var(--vscode-editor-background)",
  },
  placeholder: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "12px",
    color: "var(--vscode-descriptionForeground)",
  },
  placeholderPhase: {
    fontSize: "14px",
    fontWeight: 600 as const,
    color: "var(--vscode-foreground)",
  },
  placeholderText: {
    fontSize: "12px",
    color: "var(--vscode-descriptionForeground)",
  },
};

// ── Global keyframe injection for spinner ───────────────────────────

const KEYFRAMES = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

// ── App component ───────────────────────────────────────────────────

const App: React.FC = () => {
  const activePage = useAIStudioStore((s) => s.activePage);
  const setActivePage = useAIStudioStore((s) => s.setActivePage);
  const setGpuState = useAIStudioStore((s) => s.setGpuState);
  const setHailoState = useAIStudioStore((s) => s.setHailoState);
  const setRpiConnected = useAIStudioStore((s) => s.setRpiConnected);
  const setVramRecommendation = useAIStudioStore((s) => s.setVramRecommendation);
  const addTrainingMetric = useAIStudioStore((s) => s.addTrainingMetric);
  const setTrainingStatus = useAIStudioStore((s) => s.setTrainingStatus);
  const setVisionStats = useAIStudioStore((s) => s.setVisionStats);
  const setVisionValidation = useAIStudioStore((s) => s.setVisionValidation);
  const setLlmBuildResult = useAIStudioStore((s) => s.setLlmBuildResult);

  // Listen for messages from the extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg.type !== "string") return;

      switch (msg.type) {
        case "gpuUpdate":
          setGpuState(msg.state);
          break;
        case "hailoUpdate":
          setHailoState(msg.state);
          break;
        case "rpiConnected":
          setRpiConnected(true, msg.info);
          break;
        case "rpiDisconnected":
          setRpiConnected(false);
          break;
        case "vramRecommendation":
          setVramRecommendation(msg.recommendation);
          break;
        case "trainingMetric":
          addTrainingMetric(msg.metric);
          break;
        case "trainingDone":
          setTrainingStatus("completed");
          break;
        case "trainingError":
          setTrainingStatus("failed");
          break;
        case "visionStats":
          setVisionStats(msg.stats);
          break;
        case "visionValidation":
          setVisionValidation(msg.result);
          break;
        case "llmBuildResult":
          setLlmBuildResult(msg.result);
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [
    setGpuState,
    setHailoState,
    setRpiConnected,
    setVramRecommendation,
    addTrainingMetric,
    setTrainingStatus,
    setVisionStats,
    setVisionValidation,
    setLlmBuildResult,
  ]);

  // Request initial GPU probe on mount
  useEffect(() => {
    vscode.postMessage({ type: "probeGpu" });
  }, []);

  // Render active page
  const renderPage = () => {
    if (activePage === "dashboard") {
      return <DashboardPage />;
    }

    if (activePage === "dataset") {
      return <DatasetPage />;
    }

    if (activePage === "research") {
      return <ResearchPage />;
    }

    if (activePage === "training") {
      return <TrainingPage />;
    }

    if (activePage === "benchmark") {
      return <BenchmarkPage />;
    }

    if (activePage === "export") {
      return <ExportPage />;
    }

    if (activePage === "inference") {
      return <InferencePage />;
    }

    if (activePage === "deploy") {
      return <DeployPage />;
    }

    const navItem = NAV_ITEMS.find((n) => n.id === activePage);
    const phase = navItem?.phase ?? 2;

    return (
      <div style={styles.placeholder}>
        <div style={{ fontSize: "32px", opacity: 0.4 }}>{navItem?.icon ?? "?"}</div>
        <div style={styles.placeholderPhase}>{navItem?.label ?? activePage}</div>
        <div style={styles.placeholderText}>Coming in Phase {phase}</div>
      </div>
    );
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={styles.root}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>Virtus AI Studio</div>
          <nav style={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                style={styles.navItem(activePage === item.id)}
                onClick={() => setActivePage(item.id)}
                onMouseOver={(e) => {
                  if (activePage !== item.id) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--vscode-list-hoverBackground, rgba(255,255,255,0.05))";
                  }
                }}
                onMouseOut={(e) => {
                  if (activePage !== item.id) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }
                }}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main content */}
        <main style={styles.main}>{renderPage()}</main>
      </div>
    </>
  );
};

export default App;
