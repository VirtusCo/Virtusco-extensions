// Copyright 2026 VirtusCo
// Inference page — vision detection and LLM chat playground

import React, { useState, useEffect, useRef } from "react";
import { vscode } from "../vscodeApi";

// ── Types ───────────────────────────────────────────────────────────

interface BBox {
  class_name: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface VisionResult {
  boxes: BBox[];
  latency_ms: number;
  image_width: number;
  image_height: number;
}

interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

type LLMMode = "passenger" | "operator" | "voice_command" | "multilingual";
type Language = "english" | "malayalam" | "hindi" | "tamil";

interface LLMStats {
  tokens_per_sec: number;
  ttft_ms: number;
  model_name: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
}

const MODE_SYSTEM_PROMPTS: Record<LLMMode, string> = {
  passenger:
    "You are Virtue, the AI assistant aboard Porter, an autonomous luggage-carrying robot at the airport. " +
    "You help passengers with directions, flight information, gate locations, amenities, and general airport questions. " +
    "Be friendly, concise, and helpful. Always prioritize passenger safety. " +
    "If you do not know something, say so honestly and suggest asking airport staff.",
  operator:
    "You are Virtue, the AI assistant aboard Porter, in operator/maintenance mode. " +
    "You respond to technical queries about the robot's systems: battery, motors, LIDAR, sensors, " +
    "navigation status, error logs, and diagnostics. " +
    "Use precise technical language. Report exact values when available.",
  voice_command:
    "You are Virtue, the voice-controlled AI aboard Porter, an autonomous airport robot. " +
    "You interpret short spoken commands and respond with brief confirmations or clarifications. " +
    "Commands may include: follow me, stop, go to gate, carry luggage, find restroom, call assistance. " +
    "Keep responses under 2 sentences. Use clear, simple language.",
  multilingual:
    "You are Virtue, a multilingual AI assistant aboard Porter, an autonomous airport robot. " +
    "You detect the passenger's language and respond in the same language. " +
    "You support English, Malayalam, Hindi, and Tamil. " +
    "Provide the same helpful airport assistance regardless of language.",
};

const MODE_LABELS: Record<LLMMode, string> = {
  passenger: "Passenger",
  operator: "Operator",
  voice_command: "Voice Command",
  multilingual: "Multilingual",
};

const LANGUAGE_LABELS: Record<Language, string> = {
  english: "English",
  malayalam: "Malayalam",
  hindi: "Hindi",
  tamil: "Tamil",
};

// ── Styles ──────────────────────────────────────────────────────────

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    maxWidth: "1000px",
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
  select: {
    padding: "6px 10px",
    fontSize: "13px",
    border: "1px solid var(--vscode-input-border, rgba(255,255,255,0.15))",
    borderRadius: "4px",
    background: "var(--vscode-input-background)",
    color: "var(--vscode-input-foreground, var(--vscode-foreground))",
    fontFamily: "inherit",
    outline: "none",
  },
  slider: {
    flex: 1,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "8px",
  },
  statBox: {
    background: "var(--vscode-sideBar-background, rgba(255,255,255,0.03))",
    borderRadius: "4px",
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  statLabel: {
    fontSize: "10px",
    color: "var(--vscode-descriptionForeground)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  statValue: {
    fontSize: "16px",
    fontWeight: 700 as const,
    color: "var(--vscode-foreground)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "12px",
  },
  th: {
    textAlign: "left" as const,
    padding: "6px 8px",
    borderBottom: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.15))",
    color: "var(--vscode-descriptionForeground)",
    fontWeight: 600 as const,
    fontSize: "11px",
    textTransform: "uppercase" as const,
  },
  td: {
    padding: "6px 8px",
    borderBottom: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.05))",
    color: "var(--vscode-foreground)",
  },
  // Chat styles
  chatContainer: {
    flex: 1,
    maxHeight: "400px",
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    padding: "8px",
    background: "var(--vscode-input-background)",
    borderRadius: "6px",
  },
  chatBubble: (isUser: boolean) => ({
    maxWidth: "80%",
    padding: "10px 14px",
    borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
    background: isUser ? "#007acc" : "var(--vscode-sideBar-background, rgba(255,255,255,0.06))",
    color: isUser ? "#fff" : "var(--vscode-foreground)",
    alignSelf: isUser ? ("flex-end" as const) : ("flex-start" as const),
    fontSize: "13px",
    lineHeight: "1.5",
    wordBreak: "break-word" as const,
  }),
  chatInputRow: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-end",
  },
  chatTextarea: {
    flex: 1,
    padding: "8px 10px",
    fontSize: "13px",
    border: "1px solid var(--vscode-input-border, rgba(255,255,255,0.15))",
    borderRadius: "6px",
    background: "var(--vscode-input-background)",
    color: "var(--vscode-input-foreground, var(--vscode-foreground))",
    fontFamily: "inherit",
    outline: "none",
    resize: "none" as const,
    minHeight: "40px",
    maxHeight: "100px",
  },
  modeSelector: {
    display: "flex",
    gap: "0px",
    borderBottom: "1px solid var(--vscode-panel-border, rgba(255,255,255,0.08))",
    marginBottom: "8px",
  },
  modeTab: (active: boolean) => ({
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 600 as const,
    cursor: "pointer",
    border: "none",
    borderBottom: active ? "2px solid var(--vscode-focusBorder, #007acc)" : "2px solid transparent",
    background: "transparent",
    color: active ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)",
    fontFamily: "inherit",
  }),
  statsBar: {
    display: "flex",
    gap: "16px",
    padding: "8px 12px",
    background: "var(--vscode-sideBar-background, rgba(255,255,255,0.03))",
    borderRadius: "4px",
    fontSize: "11px",
    color: "var(--vscode-descriptionForeground)",
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  statItem: {
    display: "flex",
    gap: "4px",
    alignItems: "center",
  },
  statValueInline: {
    fontWeight: 600 as const,
    color: "var(--vscode-foreground)",
  },
};

// ── Vision Tab ──────────────────────────────────────────────────────

const VisionTab: React.FC = () => {
  const [modelPath, setModelPath] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [confThreshold, setConfThreshold] = useState(0.25);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg.type !== "string") { return; }

      if (msg.type === "visionInferenceResult") {
        setResult(msg.result);
        setRunning(false);
      } else if (msg.type === "visionInferenceError") {
        setRunning(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleRun = () => {
    if (!modelPath.trim() || !imagePath.trim()) { return; }
    setRunning(true);
    setResult(null);

    vscode.postMessage({
      type: "runVisionInference",
      modelPath: modelPath.trim(),
      imagePath: imagePath.trim(),
      confThreshold,
    });
  };

  // Count classes
  const classCounts: Record<string, number> = {};
  if (result) {
    for (const box of result.boxes) {
      classCounts[box.class_name] = (classCounts[box.class_name] || 0) + 1;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Input controls */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Vision Inference</div>

        <div>
          <div style={styles.fieldLabel}>Model Path (.pt or .onnx)</div>
          <input
            style={styles.input}
            placeholder="Path to YOLO model..."
            value={modelPath}
            onChange={(e) => setModelPath(e.target.value)}
          />
        </div>

        <div>
          <div style={styles.fieldLabel}>Image Path</div>
          <input
            style={styles.input}
            placeholder="Path to image file..."
            value={imagePath}
            onChange={(e) => setImagePath(e.target.value)}
          />
        </div>

        <div>
          <div style={styles.fieldLabel}>
            Confidence Threshold: {confThreshold.toFixed(2)}
          </div>
          <div style={styles.inputRow}>
            <span style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)" }}>0.0</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={confThreshold}
              onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
              style={styles.slider}
            />
            <span style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)" }}>1.0</span>
          </div>
        </div>

        <button
          style={{
            ...styles.button,
            opacity: running || !modelPath.trim() || !imagePath.trim() ? 0.5 : 1,
            alignSelf: "flex-start",
          }}
          onClick={handleRun}
          disabled={running || !modelPath.trim() || !imagePath.trim()}
        >
          {running ? "Running..." : "Run"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary stats */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Results</div>
            <div style={styles.statsGrid}>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Detections</div>
                <div style={styles.statValue}>{result.boxes.length}</div>
              </div>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Latency</div>
                <div style={styles.statValue}>{result.latency_ms.toFixed(1)}ms</div>
              </div>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Image Size</div>
                <div style={styles.statValue}>{result.image_width}x{result.image_height}</div>
              </div>
            </div>

            {/* Class counts */}
            {Object.keys(classCounts).length > 0 && (
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Detected Classes
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {Object.entries(classCounts).map(([cls, count]) => (
                    <div
                      key={cls}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "12px",
                        background: "rgba(0,122,204,0.15)",
                        color: "#4da6ff",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {cls}: {count}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bounding box table */}
          {result.boxes.length > 0 && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>Bounding Boxes</div>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Class</th>
                      <th style={styles.th}>Confidence</th>
                      <th style={styles.th}>X</th>
                      <th style={styles.th}>Y</th>
                      <th style={styles.th}>W</th>
                      <th style={styles.th}>H</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.boxes.map((box, i) => (
                      <tr key={i}>
                        <td style={{ ...styles.td, fontWeight: 600 }}>{box.class_name}</td>
                        <td style={styles.td}>{(box.confidence * 100).toFixed(1)}%</td>
                        <td style={styles.td}>{box.x.toFixed(1)}</td>
                        <td style={styles.td}>{box.y.toFixed(1)}</td>
                        <td style={styles.td}>{box.w.toFixed(1)}</td>
                        <td style={styles.td}>{box.h.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── LLM Chat Playground Tab ─────────────────────────────────────────

const LLMTab: React.FC = () => {
  const [modelPath, setModelPath] = useState("");
  const [mode, setMode] = useState<LLMMode>("passenger");
  const [language, setLanguage] = useState<Language>("english");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState<LLMStats | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for LLM responses
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg.type !== "string") { return; }

      if (msg.type === "llmInferenceResult") {
        const response = msg.result;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response.response },
        ]);
        setStats({
          tokens_per_sec: response.tokens_per_sec,
          ttft_ms: response.ttft_ms,
          model_name: response.model_name,
          total_tokens: response.total_tokens,
          prompt_tokens: response.prompt_tokens,
          completion_tokens: response.completion_tokens,
        });
        setSending(false);
      } else if (msg.type === "llmInferenceError") {
        setSending(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleSend = () => {
    if (!modelPath.trim() || !inputText.trim() || sending) { return; }

    const userMsg: ChatMsg = { role: "user", content: inputText.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");
    setSending(true);

    // Build the full message list including system prompt
    const systemPrompt = mode === "multilingual"
      ? MODE_SYSTEM_PROMPTS[mode] + ` Respond in ${LANGUAGE_LABELS[language]}.`
      : MODE_SYSTEM_PROMPTS[mode];

    const fullMessages: ChatMsg[] = [
      { role: "system", content: systemPrompt },
      ...newMessages,
    ];

    vscode.postMessage({
      type: "runLLMInference",
      modelPath: modelPath.trim(),
      messages: fullMessages,
      maxTokens: 256,
    });
  };

  const handleClear = () => {
    setMessages([]);
    setStats(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Context usage estimate (rough: 4 chars per token)
  const contextUsage = messages.reduce((sum, m) => sum + m.content.length, 0);
  const contextTokensEstimate = Math.round(contextUsage / 4);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Model path */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>LLM Chat Playground</div>
        <div>
          <div style={styles.fieldLabel}>GGUF Model Path</div>
          <input
            style={styles.input}
            placeholder="Path to .gguf model file..."
            value={modelPath}
            onChange={(e) => setModelPath(e.target.value)}
          />
        </div>
      </div>

      {/* Mode + Language selectors */}
      <div style={styles.card}>
        <div style={styles.modeSelector}>
          {(["passenger", "operator", "voice_command", "multilingual"] as LLMMode[]).map((m) => (
            <button
              key={m}
              style={styles.modeTab(mode === m)}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {mode === "multilingual" && (
          <div style={styles.inputRow}>
            <div style={styles.fieldLabel}>Language:</div>
            {(["english", "malayalam", "hindi", "tamil"] as Language[]).map((lang) => (
              <label
                key={lang}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  color: language === lang ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)",
                }}
              >
                <input
                  type="radio"
                  name="language"
                  checked={language === lang}
                  onChange={() => setLanguage(lang)}
                  style={{ margin: 0 }}
                />
                {LANGUAGE_LABELS[lang]}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Chat area */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={styles.cardTitle}>Chat</div>
          <button style={styles.buttonSecondary} onClick={handleClear}>
            Clear Chat
          </button>
        </div>

        {/* Messages */}
        <div ref={chatRef} style={styles.chatContainer}>
          {messages.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "120px",
                color: "var(--vscode-descriptionForeground)",
                fontSize: "13px",
              }}
            >
              Start a conversation with Virtue...
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} style={styles.chatBubble(msg.role === "user")}>
                {msg.content}
              </div>
            ))
          )}
          {sending && (
            <div style={{ ...styles.chatBubble(false), opacity: 0.6, fontStyle: "italic" }}>
              Thinking...
            </div>
          )}
        </div>

        {/* Input */}
        <div style={styles.chatInputRow}>
          <textarea
            style={styles.chatTextarea}
            placeholder={
              mode === "voice_command"
                ? "Type a voice command..."
                : "Type your message... (Enter to send, Shift+Enter for newline)"
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={!modelPath.trim()}
          />
          <button
            style={{
              ...styles.button,
              opacity: sending || !modelPath.trim() || !inputText.trim() ? 0.5 : 1,
              alignSelf: "flex-end",
              padding: "8px 20px",
            }}
            onClick={handleSend}
            disabled={sending || !modelPath.trim() || !inputText.trim()}
          >
            Send
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <span>TPS:</span>
            <span style={styles.statValueInline}>{stats.tokens_per_sec.toFixed(1)}</span>
          </div>
          <div style={styles.statItem}>
            <span>TTFT:</span>
            <span style={styles.statValueInline}>{stats.ttft_ms.toFixed(0)}ms</span>
          </div>
          <div style={styles.statItem}>
            <span>Model:</span>
            <span style={styles.statValueInline}>{stats.model_name}</span>
          </div>
          <div style={styles.statItem}>
            <span>Context:</span>
            <span style={styles.statValueInline}>~{contextTokensEstimate}/1024 tokens</span>
          </div>
          <div style={styles.statItem}>
            <span>Completion:</span>
            <span style={styles.statValueInline}>{stats.completion_tokens} tokens</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main InferencePage ──────────────────────────────────────────────

const InferencePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"vision" | "llm">("vision");

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
      </div>

      {activeTab === "vision" ? <VisionTab /> : <LLMTab />}
    </div>
  );
};

export default InferencePage;
