// Copyright 2026 VirtusCo
// Nav2 parameter tuning: collapsible groups, typed inputs, save/reset

import React, { useState, useEffect, useCallback } from 'react';
import { useSimStore, Nav2ParamGroup } from '../store/simStore';
import { vscode } from '../vscodeApi';

export default function Nav2Page(): React.ReactElement {
  const [filePath, setFilePath] = useState('');
  const nav2Params = useSimStore((s) => s.nav2Params);
  const nav2Schema = useSimStore((s) => s.nav2Schema);
  const [localParams, setLocalParams] = useState<Record<string, unknown>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [hasUnsaved, setHasUnsaved] = useState(false);

  useEffect(() => {
    setLocalParams({ ...nav2Params });
    setHasUnsaved(false);
  }, [nav2Params]);

  const handleBrowse = () => {
    vscode.postMessage({ type: 'browseFile', purpose: 'nav2' });
  };

  const handleLoad = () => {
    if (filePath.trim()) {
      vscode.postMessage({ type: 'loadNav2Params', path: filePath });
    }
  };

  const handleSave = () => {
    if (filePath.trim()) {
      vscode.postMessage({ type: 'saveNav2Params', path: filePath, params: localParams });
      setHasUnsaved(false);
    }
  };

  const handleReset = () => {
    vscode.postMessage({ type: 'resetNav2Defaults' });
  };

  const handleParamChange = useCallback((key: string, value: unknown) => {
    setLocalParams((prev) => ({ ...prev, [key]: value }));
    setHasUnsaved(true);
  }, []);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* File input */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <input
          type="text"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          placeholder="Path to nav2_params.yaml..."
          style={{
            flex: 1,
            padding: '5px 8px',
            border: '1px solid var(--vscode-input-border)',
            borderRadius: '3px',
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            fontSize: '12px',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleBrowse}
          style={{
            padding: '5px 10px',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            fontFamily: 'inherit',
          }}
        >
          Browse
        </button>
        <button
          onClick={handleLoad}
          style={{
            padding: '5px 10px',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            fontFamily: 'inherit',
          }}
        >
          Load
        </button>
      </div>

      {/* Action buttons */}
      {nav2Schema.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleSave}
            disabled={!filePath.trim()}
            style={{
              padding: '5px 14px',
              border: 'none',
              borderRadius: '3px',
              cursor: filePath.trim() ? 'pointer' : 'default',
              fontSize: '12px',
              background: '#2e7d32',
              color: '#ffffff',
              opacity: filePath.trim() ? 1 : 0.5,
              fontFamily: 'inherit',
            }}
          >
            Save
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: '5px 14px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              fontFamily: 'inherit',
            }}
          >
            Reset to Defaults
          </button>
          {hasUnsaved && (
            <span style={{ fontSize: '11px', color: '#ffb74d', fontWeight: 600 }}>
              Unsaved changes
            </span>
          )}
        </div>
      )}

      {/* Parameter groups */}
      {nav2Schema.map((group) => (
        <ParamGroupSection
          key={group.group}
          group={group}
          params={localParams}
          collapsed={collapsedGroups.has(group.group)}
          onToggle={() => toggleGroup(group.group)}
          onChange={handleParamChange}
        />
      ))}
    </div>
  );
}

interface ParamGroupProps {
  group: Nav2ParamGroup;
  params: Record<string, unknown>;
  collapsed: boolean;
  onToggle: () => void;
  onChange: (key: string, value: unknown) => void;
}

function ParamGroupSection({ group, params, collapsed, onToggle, onChange }: ParamGroupProps): React.ReactElement {
  return (
    <div style={{
      border: '1px solid var(--vscode-panel-border)',
      borderRadius: '4px',
      overflow: 'hidden',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--vscode-sideBar-background)',
          color: 'var(--vscode-foreground)',
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '10px' }}>{collapsed ? '\u25B6' : '\u25BC'}</span>
        {group.label}
        <span style={{ color: 'var(--vscode-descriptionForeground)', fontWeight: 400, fontSize: '11px' }}>
          ({group.params.length} params)
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '8px 12px' }}>
          {group.params.map((param) => {
            const value = params[param.key] ?? param.default;

            return (
              <div key={param.key} style={{
                padding: '6px 0',
                borderBottom: '1px solid var(--vscode-panel-border)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '2px',
                }}>
                  <label style={{ fontSize: '12px', fontWeight: 500 }}>{param.label}</label>
                  {param.type === 'bool' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => onChange(param.key, e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  ) : param.type === 'float' || param.type === 'int' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        value={String(value)}
                        min={param.min}
                        max={param.max}
                        step={param.type === 'float' ? 0.01 : 1}
                        onChange={(e) => {
                          const v = param.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                          if (!isNaN(v)) onChange(param.key, v);
                        }}
                        style={{
                          width: '80px',
                          padding: '3px 6px',
                          border: '1px solid var(--vscode-input-border)',
                          borderRadius: '3px',
                          background: 'var(--vscode-input-background)',
                          color: 'var(--vscode-input-foreground)',
                          fontSize: '11px',
                          fontFamily: 'inherit',
                        }}
                      />
                      {param.min !== undefined && param.max !== undefined && (
                        <span style={{ fontSize: '9px', color: 'var(--vscode-descriptionForeground)' }}>
                          [{param.min} - {param.max}]
                        </span>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={String(value)}
                      onChange={(e) => onChange(param.key, e.target.value)}
                      style={{
                        width: '120px',
                        padding: '3px 6px',
                        border: '1px solid var(--vscode-input-border)',
                        borderRadius: '3px',
                        background: 'var(--vscode-input-background)',
                        color: 'var(--vscode-input-foreground)',
                        fontSize: '11px',
                        fontFamily: 'inherit',
                      }}
                    />
                  )}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: 'var(--vscode-descriptionForeground)',
                  lineHeight: '1.3',
                }}>
                  {param.description}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
