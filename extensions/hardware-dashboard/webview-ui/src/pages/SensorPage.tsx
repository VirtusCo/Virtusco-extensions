// Copyright 2026 VirtusCo

import React from 'react';
import { useHwStore } from '../store/hwStore';

const MAX_RANGE_MM = 2000; // Max display range
const MAX_RANGE_CM = 200;

function getAgreementStatus(tofMm: number, sonicCm: number): {
  label: string;
  color: string;
  pct: number;
} {
  const tofCm = tofMm / 10;
  if (tofCm <= 0 || sonicCm <= 0) {
    return { label: 'N/A', color: 'var(--vscode-badge-background)', pct: 0 };
  }
  const avg = (tofCm + sonicCm) / 2;
  const pct = Math.abs(tofCm - sonicCm) / avg * 100;
  if (pct <= 5) {
    return { label: `${pct.toFixed(1)}% - Good`, color: 'var(--vscode-testing-iconPassed)', pct };
  }
  if (pct <= 20) {
    return { label: `${pct.toFixed(1)}% - Marginal`, color: 'var(--vscode-list-warningForeground)', pct };
  }
  return { label: `${pct.toFixed(1)}% - Divergent`, color: 'var(--vscode-testing-iconFailed)', pct };
}

function formatUptime(ms: number): string {
  if (ms <= 0) return '--';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

const RangeBar: React.FC<{
  label: string;
  value: number;
  unit: string;
  maxRange: number;
  color: string;
}> = ({ label, value, unit, maxRange, color }) => {
  const pct = Math.max(0, Math.min(100, (value / maxRange) * 100));
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '12px' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 'bold' }}>{value.toFixed(1)} {unit}</span>
      </div>
      <div style={{
        height: '8px',
        background: 'var(--vscode-progressBar-background)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: '4px',
          transition: 'width 0.2s ease',
        }} />
      </div>
    </div>
  );
};

export const SensorPage: React.FC = () => {
  const packet = useHwStore((s) => s.latestPacket);

  if (!packet) {
    return <div style={{ opacity: 0.6, padding: '20px' }}>Waiting for telemetry data...</div>;
  }

  const { sensors, esp32_health } = packet;
  const agreement = getAgreementStatus(sensors.tof_mm, sensors.sonic_cm);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Sensor Readings</div>

      {/* Sensor readings */}
      <div style={{
        background: 'var(--vscode-editorWidget-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: '4px',
        padding: '12px',
      }}>
        <RangeBar
          label="Time-of-Flight (VL53L0X)"
          value={sensors.tof_mm}
          unit="mm"
          maxRange={MAX_RANGE_MM}
          color="var(--vscode-charts-green)"
        />
        <RangeBar
          label="Ultrasonic (HC-SR04)"
          value={sensors.sonic_cm}
          unit="cm"
          maxRange={MAX_RANGE_CM}
          color="var(--vscode-charts-blue)"
        />
        <RangeBar
          label="Microwave (RCWL-0516)"
          value={sensors.microwave}
          unit=""
          maxRange={1}
          color="var(--vscode-charts-orange)"
        />
        <RangeBar
          label="Kalman Fused Estimate"
          value={sensors.kalman_cm}
          unit="cm"
          maxRange={MAX_RANGE_CM}
          color="var(--vscode-charts-purple)"
        />
      </div>

      {/* Sensor Agreement */}
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
          marginBottom: '8px',
          letterSpacing: '0.5px',
        }}>
          Sensor Agreement (ToF vs Ultrasonic)
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: agreement.color,
            display: 'inline-block',
          }} />
          <span style={{
            fontWeight: 'bold',
            fontSize: '14px',
            color: agreement.color,
          }}>
            {agreement.label}
          </span>
        </div>
        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
          ToF: {(sensors.tof_mm / 10).toFixed(1)} cm | Sonic: {sensors.sonic_cm.toFixed(1)} cm | Kalman: {sensors.kalman_cm.toFixed(1)} cm
        </div>
      </div>

      {/* ESP32 #2 Health */}
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
          marginBottom: '8px',
          letterSpacing: '0.5px',
        }}>
          ESP32 Health
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>ESP32 #1 (Motor)</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Uptime: {formatUptime(esp32_health.esp1_uptime_ms)}</div>
            <div style={{
              fontSize: '12px',
              color: esp32_health.esp1_errors > 0 ? 'var(--vscode-testing-iconFailed)' : 'var(--vscode-foreground)',
            }}>
              Errors: {esp32_health.esp1_errors}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>ESP32 #2 (Sensor)</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Uptime: {formatUptime(esp32_health.esp2_uptime_ms)}</div>
            <div style={{
              fontSize: '12px',
              color: esp32_health.esp2_errors > 0 ? 'var(--vscode-testing-iconFailed)' : 'var(--vscode-foreground)',
            }}>
              Errors: {esp32_health.esp2_errors}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
