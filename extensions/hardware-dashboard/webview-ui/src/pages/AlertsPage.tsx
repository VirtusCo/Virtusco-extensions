// Copyright 2026 VirtusCo

import React, { useState, useCallback } from 'react';
import { useHwStore, type AlertConfig, type ThresholdPair } from '../store/hwStore';
import { vscode } from '../vscodeApi';

const DEFAULT_CONFIG: AlertConfig = {
  POWER_THRESHOLDS: {
    v12: { low: { warn: 11.5, critical: 11.0 }, high: { warn: 13.0, critical: 13.5 } },
    v5: { low: { warn: 4.75, critical: 4.6 }, high: { warn: 5.3, critical: 5.5 } },
    v33: { low: { warn: 3.1, critical: 3.0 }, high: { warn: 3.5, critical: 3.6 } },
  },
  CURRENT_THRESHOLDS: {
    i12_ma: { warn: 5000, critical: 8000 },
    i5_ma: { warn: 2000, critical: 3000 },
  },
  MOTOR_THRESHOLDS: {
    current_ma: { warn: 3000, critical: 6000 },
    temp_c: { warn: 80, critical: 120 },
  },
  SENSOR_DISAGREEMENT_PCT: 20,
};

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'var(--vscode-testing-iconFailed)';
    case 'warning': return 'var(--vscode-list-warningForeground)';
    default: return 'var(--vscode-charts-blue)';
  }
}

const inputStyle: React.CSSProperties = {
  width: '70px',
  padding: '2px 4px',
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: '2px',
  fontSize: '12px',
};

const ThresholdRow: React.FC<{
  label: string;
  pair: ThresholdPair;
  onChange: (pair: ThresholdPair) => void;
}> = ({ label, pair, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
    <span style={{ flex: 1, fontSize: '12px' }}>{label}</span>
    <span style={{ fontSize: '11px', opacity: 0.7 }}>Warn:</span>
    <input
      type="number"
      step="0.1"
      value={pair.warn}
      onChange={(e) => onChange({ ...pair, warn: parseFloat(e.target.value) || 0 })}
      style={inputStyle}
    />
    <span style={{ fontSize: '11px', opacity: 0.7 }}>Crit:</span>
    <input
      type="number"
      step="0.1"
      value={pair.critical}
      onChange={(e) => onChange({ ...pair, critical: parseFloat(e.target.value) || 0 })}
      style={inputStyle}
    />
  </div>
);

export const AlertsPage: React.FC = () => {
  const alerts = useHwStore((s) => s.alerts);
  const thresholds = useHwStore((s) => s.thresholds);
  const setThresholds = useHwStore((s) => s.setThresholds);

  const [editConfig, setEditConfig] = useState<AlertConfig>(thresholds || DEFAULT_CONFIG);

  const handleSave = useCallback(() => {
    setThresholds(editConfig);
    vscode.postMessage({ type: 'updateThresholds', config: editConfig });
  }, [editConfig, setThresholds]);

  const handleReset = useCallback(() => {
    setEditConfig(DEFAULT_CONFIG);
    setThresholds(DEFAULT_CONFIG);
    vscode.postMessage({ type: 'updateThresholds', config: DEFAULT_CONFIG });
  }, [setThresholds]);

  const handleClear = useCallback(() => {
    vscode.postMessage({ type: 'clearAlerts' });
  }, []);

  const updatePowerThreshold = (
    rail: 'v12' | 'v5' | 'v33',
    side: 'low' | 'high',
    pair: ThresholdPair,
  ) => {
    setEditConfig((prev) => ({
      ...prev,
      POWER_THRESHOLDS: {
        ...prev.POWER_THRESHOLDS,
        [rail]: {
          ...prev.POWER_THRESHOLDS[rail],
          [side]: pair,
        },
      },
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Active Alerts ({alerts.length})</div>
        <button
          onClick={handleClear}
          style={{
            padding: '4px 12px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Clear All
        </button>
      </div>

      {/* Alert list */}
      <div style={{
        background: 'var(--vscode-editorWidget-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: '4px',
        padding: '8px',
        maxHeight: '300px',
        overflowY: 'auto',
      }}>
        {alerts.length === 0 ? (
          <div style={{ padding: '12px', textAlign: 'center', opacity: 0.6 }}>
            No active alerts
          </div>
        ) : (
          alerts.map((alert, i) => (
            <div key={`${alert.id}-${alert.timestamp}-${i}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              borderBottom: i < alerts.length - 1 ? '1px solid var(--vscode-panel-border)' : 'none',
            }}>
              <span style={{
                padding: '1px 6px',
                borderRadius: '8px',
                fontSize: '10px',
                fontWeight: 'bold',
                background: severityColor(alert.severity),
                color: 'var(--vscode-editor-background)',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}>
                {alert.severity}
              </span>
              <span style={{ flex: 1, fontSize: '12px' }}>{alert.message}</span>
              <span style={{ fontSize: '10px', opacity: 0.5, whiteSpace: 'nowrap' }}>
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Threshold Configuration */}
      <div style={{
        background: 'var(--vscode-editorWidget-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: '4px',
        padding: '12px',
      }}>
        <div style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          opacity: 0.7,
          marginBottom: '12px',
          letterSpacing: '0.5px',
        }}>
          Threshold Configuration
        </div>

        {/* Power thresholds */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Power (Low)</div>
          <ThresholdRow label="12V Low" pair={editConfig.POWER_THRESHOLDS.v12.low}
            onChange={(p) => updatePowerThreshold('v12', 'low', p)} />
          <ThresholdRow label="5V Low" pair={editConfig.POWER_THRESHOLDS.v5.low}
            onChange={(p) => updatePowerThreshold('v5', 'low', p)} />
          <ThresholdRow label="3.3V Low" pair={editConfig.POWER_THRESHOLDS.v33.low}
            onChange={(p) => updatePowerThreshold('v33', 'low', p)} />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Power (High)</div>
          <ThresholdRow label="12V High" pair={editConfig.POWER_THRESHOLDS.v12.high}
            onChange={(p) => updatePowerThreshold('v12', 'high', p)} />
          <ThresholdRow label="5V High" pair={editConfig.POWER_THRESHOLDS.v5.high}
            onChange={(p) => updatePowerThreshold('v5', 'high', p)} />
          <ThresholdRow label="3.3V High" pair={editConfig.POWER_THRESHOLDS.v33.high}
            onChange={(p) => updatePowerThreshold('v33', 'high', p)} />
        </div>

        {/* Motor thresholds */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Motor</div>
          <ThresholdRow label="Current (mA)" pair={editConfig.MOTOR_THRESHOLDS.current_ma}
            onChange={(p) => setEditConfig((prev) => ({
              ...prev, MOTOR_THRESHOLDS: { ...prev.MOTOR_THRESHOLDS, current_ma: p },
            }))} />
          <ThresholdRow label="Temp (C)" pair={editConfig.MOTOR_THRESHOLDS.temp_c}
            onChange={(p) => setEditConfig((prev) => ({
              ...prev, MOTOR_THRESHOLDS: { ...prev.MOTOR_THRESHOLDS, temp_c: p },
            }))} />
        </div>

        {/* Sensor disagreement */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Sensor</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ flex: 1, fontSize: '12px' }}>Disagreement %</span>
            <input
              type="number"
              step="1"
              value={editConfig.SENSOR_DISAGREEMENT_PCT}
              onChange={(e) => setEditConfig((prev) => ({
                ...prev, SENSOR_DISAGREEMENT_PCT: parseFloat(e.target.value) || 0,
              }))}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '6px',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Save Thresholds
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: '6px 12px',
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};
