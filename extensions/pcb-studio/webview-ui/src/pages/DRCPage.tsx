import React from 'react';
// Copyright 2026 VirtusCo

import { useState, useCallback } from 'react';
import { vscode } from '../vscodeApi';
import { usePCBStore } from '../store/pcbStore';

interface DRCViolation {
  type: 'clearance' | 'width' | 'unconnected' | 'overlap' | 'courtyard';
  severity: 'error' | 'warning';
  message: string;
  location: { x: number; y: number };
  items: string[];
}

const SEVERITY_COLORS: Record<string, string> = {
  error: '#f44336',
  warning: '#ff9800',
};

const TYPE_LABELS: Record<string, string> = {
  clearance: 'CLR',
  width: 'WID',
  unconnected: 'UNC',
  overlap: 'OVR',
  courtyard: 'CRT',
};

export function DRCPage() {
  const drcViolations = usePCBStore((s) => s.drcViolations);
  const [minTraceWidth, setMinTraceWidth] = useState(0.2);
  const [minClearance, setMinClearance] = useState(0.2);
  const [minViaDrill, setMinViaDrill] = useState(0.3);
  const [minViaSize, setMinViaSize] = useState(0.6);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const handleRunDRC = useCallback(() => {
    vscode.postMessage({
      type: 'runDRC',
      designRules: {
        minTraceWidth,
        minClearance,
        minViaDrill,
        minViaSize,
        minPadSize: 0.5,
        copperLayers: 2,
      },
    });
  }, [minTraceWidth, minClearance, minViaDrill, minViaSize]);

  const handleClickViolation = useCallback((violation: DRCViolation) => {
    vscode.postMessage({
      type: 'scrollToPCBLocation',
      x: violation.location.x,
      y: violation.location.y,
    });
  }, []);

  const violations: DRCViolation[] = drcViolations;
  const filteredViolations = violations.filter((v) => {
    if (filterType !== 'all' && v.type !== filterType) { return false; }
    if (filterSeverity !== 'all' && v.severity !== filterSeverity) { return false; }
    return true;
  });

  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;
  const passedCount = violations.length === 0;

  return (
    <div style={{ padding: 16, overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: 16, marginBottom: 16, fontWeight: 'bold' }}>Design Rule Check</h2>

      {/* Design rules editor */}
      <div style={{
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: 4,
        padding: 12,
        marginBottom: 16,
      }}>
        <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>Design Rules</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <label style={labelStyle}>
            Min Trace Width (mm):
            <input type="number" step={0.05} min={0.05} value={minTraceWidth} onChange={(e) => setMinTraceWidth(parseFloat(e.target.value) || 0.2)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Min Clearance (mm):
            <input type="number" step={0.05} min={0.05} value={minClearance} onChange={(e) => setMinClearance(parseFloat(e.target.value) || 0.2)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Min Via Drill (mm):
            <input type="number" step={0.05} min={0.1} value={minViaDrill} onChange={(e) => setMinViaDrill(parseFloat(e.target.value) || 0.3)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Min Via Size (mm):
            <input type="number" step={0.1} min={0.2} value={minViaSize} onChange={(e) => setMinViaSize(parseFloat(e.target.value) || 0.6)} style={inputStyle} />
          </label>
        </div>
        <button
          onClick={handleRunDRC}
          style={{
            marginTop: 12,
            padding: '8px 20px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 'bold',
            borderRadius: 2,
          }}
        >
          Run DRC
        </button>
      </div>

      {/* Summary */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 16,
      }}>
        <div style={{
          padding: '8px 16px',
          borderRadius: 4,
          background: errorCount > 0 ? 'rgba(244, 67, 54, 0.15)' : 'rgba(76, 175, 80, 0.15)',
          border: `1px solid ${errorCount > 0 ? '#f44336' : '#4caf50'}`,
          fontSize: 13,
        }}>
          {errorCount} Errors
        </div>
        <div style={{
          padding: '8px 16px',
          borderRadius: 4,
          background: warningCount > 0 ? 'rgba(255, 152, 0, 0.15)' : 'rgba(76, 175, 80, 0.15)',
          border: `1px solid ${warningCount > 0 ? '#ff9800' : '#4caf50'}`,
          fontSize: 13,
        }}>
          {warningCount} Warnings
        </div>
        {passedCount && violations.length === 0 && (
          <div style={{
            padding: '8px 16px',
            borderRadius: 4,
            background: 'rgba(76, 175, 80, 0.15)',
            border: '1px solid #4caf50',
            fontSize: 13,
          }}>
            All checks passed
          </div>
        )}
      </div>

      {/* Filters */}
      {violations.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', fontSize: 12 }}>
          <label>
            Type:
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...inputStyle, marginLeft: 4 }}>
              <option value="all">All</option>
              <option value="clearance">Clearance</option>
              <option value="width">Width</option>
              <option value="unconnected">Unconnected</option>
              <option value="overlap">Overlap</option>
              <option value="courtyard">Courtyard</option>
            </select>
          </label>
          <label>
            Severity:
            <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} style={{ ...inputStyle, marginLeft: 4 }}>
              <option value="all">All</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
            </select>
          </label>
          <div style={{ opacity: 0.7 }}>
            Showing {filteredViolations.length} of {violations.length}
          </div>
        </div>
      )}

      {/* Violation list */}
      {filteredViolations.length > 0 && (
        <div style={{
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          {filteredViolations.map((violation, i) => (
            <div
              key={i}
              onClick={() => handleClickViolation(violation)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 12px',
                borderBottom: i < filteredViolations.length - 1 ? '1px solid var(--vscode-panel-border)' : 'none',
                cursor: 'pointer',
                fontSize: 12,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'var(--vscode-list-hoverBackground)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              {/* Severity indicator */}
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: SEVERITY_COLORS[violation.severity],
                marginTop: 4,
                flexShrink: 0,
              }} />

              {/* Type badge */}
              <div style={{
                padding: '1px 6px',
                borderRadius: 3,
                background: 'var(--vscode-badge-background)',
                color: 'var(--vscode-badge-foreground)',
                fontSize: 10,
                fontWeight: 'bold',
                flexShrink: 0,
              }}>
                {TYPE_LABELS[violation.type] || violation.type}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div>{violation.message}</div>
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
                  at ({violation.location.x.toFixed(1)}, {violation.location.y.toFixed(1)}) mm
                  {violation.items.length > 0 && ` | ${violation.items.join(', ')}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {violations.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', opacity: 0.5, fontSize: 13 }}>
          Click "Run DRC" to check your design against the rules above.
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  padding: '4px 8px',
  fontSize: 12,
  outline: 'none',
  borderRadius: 2,
};
