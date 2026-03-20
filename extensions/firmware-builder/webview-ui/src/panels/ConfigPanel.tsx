// Copyright 2026 VirtusCo
// Right-side property editor panel — renders form from configSchema

import React from 'react';
import { Node } from '@xyflow/react';
import { nodeDefRegistry } from '../nodes/registry';

interface ConfigPanelProps {
  node: Node;
  onConfigChange: (key: string, value: unknown) => void;
  onDelete: () => void;
}

export function ConfigPanel({ node, onConfigChange, onDelete }: ConfigPanelProps) {
  const nodeData = node.data as Record<string, unknown>;
  const nodeType = nodeData.nodeType as string;
  const config = (nodeData.config ?? {}) as Record<string, unknown>;
  const def = nodeDefRegistry[nodeType];

  if (!def) {
    return (
      <PanelWrapper>
        <div style={{ color: '#888', padding: 12 }}>Unknown node type: {nodeType}</div>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--vscode-panel-border, #333)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: def.color,
        }} />
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{def.label}</span>
        <button
          onClick={onDelete}
          title="Delete node"
          style={{
            background: 'var(--vscode-errorForeground, #f44)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      </div>

      {/* Config fields */}
      <div style={{ padding: '8px 12px', overflowY: 'auto', flex: 1 }}>
        {def.configSchema.length === 0 && (
          <div style={{ color: '#888', fontSize: 12 }}>No configurable properties</div>
        )}

        {def.configSchema.map(field => {
          const value = config[field.key] ?? field.default;

          return (
            <div key={field.key} style={{ marginBottom: 10 }}>
              <label style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--vscode-descriptionForeground, #888)',
                marginBottom: 3,
              }}>
                {field.label}
              </label>

              {field.type === 'text' || field.type === 'pin' ? (
                <input
                  type="text"
                  value={String(value ?? '')}
                  placeholder={field.placeholder}
                  onChange={e => onConfigChange(field.key, e.target.value)}
                  style={inputStyle}
                />
              ) : field.type === 'number' ? (
                <input
                  type="number"
                  value={Number(value ?? field.default)}
                  min={field.min}
                  max={field.max}
                  onChange={e => onConfigChange(field.key, Number(e.target.value))}
                  style={inputStyle}
                />
              ) : field.type === 'boolean' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={e => onConfigChange(field.key, e.target.checked)}
                  />
                  <span style={{ fontSize: 12, color: '#ccc' }}>
                    {value ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              ) : field.type === 'select' ? (
                <select
                  value={String(value ?? '')}
                  onChange={e => onConfigChange(field.key, e.target.value)}
                  style={inputStyle}
                >
                  {(field.options ?? []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Node ID (for debugging) */}
      <div style={{
        padding: '6px 12px',
        fontSize: 10,
        color: '#555',
        borderTop: '1px solid var(--vscode-panel-border, #333)',
      }}>
        ID: {node.id}
      </div>
    </PanelWrapper>
  );
}

function PanelWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 260,
      height: '100%',
      background: 'var(--vscode-sideBar-background, #252526)',
      borderLeft: '1px solid var(--vscode-panel-border, #333)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  fontSize: 12,
  background: 'var(--vscode-input-background, #3c3c3c)',
  color: 'var(--vscode-input-foreground, #ccc)',
  border: '1px solid var(--vscode-input-border, #555)',
  borderRadius: 4,
  outline: 'none',
};
