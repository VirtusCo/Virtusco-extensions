// Copyright 2026 VirtusCo

import React from 'react';

interface VoltageBarProps {
  value: number;
  min: number;
  nominal: number;
  max: number;
  warn: number;
  critical: number;
  label: string;
  unit?: string;
}

/**
 * Horizontal bar showing voltage level with color coding.
 * Green = normal, yellow = warning, red = critical.
 */
export const VoltageBar: React.FC<VoltageBarProps> = ({
  value,
  min,
  nominal,
  max,
  warn,
  critical,
  label,
  unit = 'V',
}) => {
  const range = max - min;
  const pct = range > 0 ? Math.max(0, Math.min(100, ((value - min) / range) * 100)) : 0;

  let color = 'var(--vscode-testing-iconPassed)'; // green
  if (value < critical || value > max - (critical - min)) {
    color = 'var(--vscode-testing-iconFailed)'; // red
  } else if (value < warn || value > max - (warn - min)) {
    color = 'var(--vscode-list-warningForeground)'; // yellow
  }

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '2px',
        fontSize: '12px',
      }}>
        <span>{label}</span>
        <span style={{ fontWeight: 'bold', color }}>
          {value.toFixed(2)} {unit}
        </span>
      </div>
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
        {/* Nominal marker */}
        <div style={{
          position: 'absolute',
          left: `${((nominal - min) / range) * 100}%`,
          top: 0,
          bottom: 0,
          width: '2px',
          background: 'var(--vscode-foreground)',
          opacity: 0.4,
        }} />
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        opacity: 0.5,
        marginTop: '1px',
      }}>
        <span>{min.toFixed(1)}</span>
        <span>{nominal.toFixed(1)} (nom)</span>
        <span>{max.toFixed(1)}</span>
      </div>
    </div>
  );
};
