// Copyright 2026 VirtusCo

import React from 'react';

interface CurrentBarProps {
  value_ma: number;
  warn_ma: number;
  critical_ma: number;
  max_ma: number;
  label?: string;
}

/**
 * Horizontal bar with threshold marker line.
 * Fills proportionally and changes color at thresholds.
 */
export const CurrentBar: React.FC<CurrentBarProps> = ({
  value_ma,
  warn_ma,
  critical_ma,
  max_ma,
  label,
}) => {
  const pct = max_ma > 0 ? Math.max(0, Math.min(100, (value_ma / max_ma) * 100)) : 0;
  const warnPct = max_ma > 0 ? (warn_ma / max_ma) * 100 : 0;
  const critPct = max_ma > 0 ? (critical_ma / max_ma) * 100 : 0;

  let color = 'var(--vscode-testing-iconPassed)'; // green
  if (value_ma >= critical_ma) {
    color = 'var(--vscode-testing-iconFailed)'; // red
  } else if (value_ma >= warn_ma) {
    color = 'var(--vscode-list-warningForeground)'; // yellow
  }

  return (
    <div style={{ marginBottom: '8px' }}>
      {label && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '2px',
          fontSize: '12px',
        }}>
          <span>{label}</span>
          <span style={{ fontWeight: 'bold', color }}>
            {value_ma.toFixed(0)} mA
          </span>
        </div>
      )}
      <div style={{
        height: '8px',
        background: 'var(--vscode-progressBar-background)',
        borderRadius: '4px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: '4px',
          transition: 'width 0.2s ease',
        }} />
        {/* Warning threshold marker */}
        <div style={{
          position: 'absolute',
          left: `${warnPct}%`,
          top: 0,
          bottom: 0,
          width: '1px',
          background: 'var(--vscode-list-warningForeground)',
          opacity: 0.7,
        }} />
        {/* Critical threshold marker */}
        <div style={{
          position: 'absolute',
          left: `${critPct}%`,
          top: 0,
          bottom: 0,
          width: '2px',
          background: 'var(--vscode-testing-iconFailed)',
          opacity: 0.7,
        }} />
      </div>
    </div>
  );
};
