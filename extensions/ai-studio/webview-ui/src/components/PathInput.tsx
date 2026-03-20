// Copyright 2026 VirtusCo
// Reusable path input with "Browse" button that opens native file explorer

import React from "react";
import { vscode } from "../vscodeApi";

interface PathInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  browseType: "file" | "folder";
  browseId: string;
  filters?: Record<string, string[]>;
  disabled?: boolean;
  label?: string;
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 600 as const,
    color: "var(--vscode-foreground)",
  },
  row: {
    display: "flex",
    gap: "4px",
  },
  input: {
    flex: 1,
    padding: "5px 8px",
    fontSize: "12px",
    background: "var(--vscode-input-background, #3c3c3c)",
    color: "var(--vscode-input-foreground, #ccc)",
    border: "1px solid var(--vscode-input-border, #555)",
    borderRadius: "3px",
    outline: "none",
    fontFamily: "var(--vscode-editor-font-family, monospace)",
  },
  browseBtn: {
    padding: "5px 10px",
    fontSize: "12px",
    background: "var(--vscode-button-secondaryBackground, #3a3d41)",
    color: "var(--vscode-button-secondaryForeground, #ccc)",
    border: "1px solid var(--vscode-button-border, transparent)",
    borderRadius: "3px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
};

export default function PathInput({
  value,
  onChange,
  placeholder,
  browseType,
  browseId,
  filters,
  disabled,
  label,
}: PathInputProps) {
  const handleBrowse = () => {
    vscode.postMessage({
      type: "browse",
      browseId,
      browseType,
      filters: filters ?? {},
    });
  };

  // Listen for browse result matching our browseId
  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "browseResult" && msg.browseId === browseId && msg.path) {
        onChange(msg.path);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [browseId, onChange]);

  return (
    <div style={styles.wrapper}>
      {label && <div style={styles.label}>{label}</div>}
      <div style={styles.row}>
        <input
          type="text"
          style={{
            ...styles.input,
            opacity: disabled ? 0.5 : 1,
          }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <button
          style={{
            ...styles.browseBtn,
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
          onClick={handleBrowse}
          disabled={disabled}
        >
          Browse
        </button>
      </div>
    </div>
  );
}
