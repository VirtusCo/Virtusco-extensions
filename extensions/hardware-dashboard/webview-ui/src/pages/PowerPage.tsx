// Copyright 2026 VirtusCo

import React from 'react';
import { useHwStore } from '../store/hwStore';
import { VoltageBar } from '../components/VoltageBar';

const TrendChart: React.FC<{ values: number[]; min: number; max: number; color: string }> = ({
  values,
  min,
  max,
  color,
}) => {
  const range = max - min || 1;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '1px',
      height: '40px',
      marginTop: '4px',
    }}>
      {values.map((v, i) => {
        const pct = Math.max(0, Math.min(100, ((v - min) / range) * 100));
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${pct}%`,
              background: color,
              borderRadius: '1px 1px 0 0',
              opacity: 0.7 + (i / values.length) * 0.3,
              minWidth: '2px',
            }}
            title={`${v.toFixed(2)}`}
          />
        );
      })}
    </div>
  );
};

const RelayPill: React.FC<{ index: number; active: boolean }> = ({ index, active }) => (
  <span style={{
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 'bold',
    background: active
      ? 'var(--vscode-testing-iconPassed)'
      : 'var(--vscode-badge-background)',
    color: active
      ? 'var(--vscode-editor-background)'
      : 'var(--vscode-badge-foreground)',
    marginRight: '4px',
  }}>
    R{index + 1}: {active ? 'ON' : 'OFF'}
  </span>
);

export const PowerPage: React.FC = () => {
  const packet = useHwStore((s) => s.latestPacket);
  const powerHistory = useHwStore((s) => s.powerHistory);
  const powerMinMax = useHwStore((s) => s.powerMinMax);

  if (!packet) {
    return <div style={{ opacity: 0.6, padding: '20px' }}>Waiting for telemetry data...</div>;
  }

  const { power } = packet;

  const rails = [
    {
      label: '12V Rail',
      value: power.v12,
      nominal: 12,
      min: 10,
      max: 14,
      warn: 11.5,
      critical: 11.0,
      history: powerHistory.v12,
      minSeen: powerMinMax.v12.min,
      maxSeen: powerMinMax.v12.max,
      current: power.i12_ma,
      color: 'var(--vscode-charts-red)',
    },
    {
      label: '5V Rail',
      value: power.v5,
      nominal: 5,
      min: 4,
      max: 6,
      warn: 4.75,
      critical: 4.6,
      history: powerHistory.v5,
      minSeen: powerMinMax.v5.min,
      maxSeen: powerMinMax.v5.max,
      current: power.i5_ma,
      color: 'var(--vscode-charts-orange)',
    },
    {
      label: '3.3V Rail',
      value: power.v33,
      nominal: 3.3,
      min: 2.8,
      max: 3.8,
      warn: 3.1,
      critical: 3.0,
      history: powerHistory.v33,
      minSeen: powerMinMax.v33.min,
      maxSeen: powerMinMax.v33.max,
      current: 0,
      color: 'var(--vscode-charts-yellow)',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Power Rails</div>

      {rails.map((rail) => (
        <div key={rail.label} style={{
          background: 'var(--vscode-editorWidget-background)',
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: '4px',
          padding: '12px',
        }}>
          <VoltageBar
            value={rail.value}
            min={rail.min}
            nominal={rail.nominal}
            max={rail.max}
            warn={rail.warn}
            critical={rail.critical}
            label={rail.label}
          />

          <div style={{
            display: 'flex',
            gap: '16px',
            fontSize: '12px',
            marginTop: '4px',
            marginBottom: '4px',
          }}>
            <div>
              <span style={{ opacity: 0.7 }}>Current: </span>
              <span style={{ fontWeight: 'bold' }}>{rail.current.toFixed(0)} mA</span>
            </div>
            <div>
              <span style={{ opacity: 0.7 }}>Min seen: </span>
              <span>{rail.minSeen === Infinity ? '--' : rail.minSeen.toFixed(2)}V</span>
            </div>
            <div>
              <span style={{ opacity: 0.7 }}>Max seen: </span>
              <span>{rail.maxSeen === -Infinity ? '--' : rail.maxSeen.toFixed(2)}V</span>
            </div>
          </div>

          {rail.history.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '4px' }}>
                Trend (last {rail.history.length} samples)
              </div>
              <TrendChart
                values={rail.history}
                min={rail.min}
                max={rail.max}
                color={rail.color}
              />
            </div>
          )}
        </div>
      ))}

      {/* Relay States */}
      <div style={{
        background: 'var(--vscode-editorWidget-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: '4px',
        padding: '12px',
      }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.7, marginBottom: '8px', letterSpacing: '0.5px' }}>
          Relay States
        </div>
        <div>
          {power.relay_states.length > 0
            ? power.relay_states.map((state, i) => (
                <RelayPill key={i} index={i} active={state} />
              ))
            : <span style={{ opacity: 0.5, fontSize: '12px' }}>No relay data</span>
          }
        </div>
      </div>
    </div>
  );
};
