// Copyright 2026 VirtusCo

import React from 'react';
import { useHwStore, type MotorChannel } from '../store/hwStore';
import { CurrentBar } from '../components/CurrentBar';

const WARN_MA = 3000;
const CRITICAL_MA = 6000;
const MAX_MA = 8000;

/** Simplified thermal model matching AlertConfig.estimateTemp */
function estimateTemp(current_ma: number, duty_pct: number, ambient = 25): number {
  const R_THERMAL = 0.0000015;
  const dutyFactor = Math.max(0, Math.min(1, duty_pct / 100));
  return ambient + current_ma * current_ma * R_THERMAL * dutyFactor;
}

function getDirection(ch: MotorChannel): string {
  if (!ch.en) return 'STOPPED';
  if (ch.rpwm > 0 && ch.lpwm === 0) return 'FORWARD';
  if (ch.lpwm > 0 && ch.rpwm === 0) return 'REVERSE';
  if (ch.rpwm === 0 && ch.lpwm === 0) return 'STOPPED';
  return 'BRAKING';
}

function getTempBadge(temp: number): { label: string; color: string } {
  if (temp >= 120) return { label: 'HOT', color: 'var(--vscode-testing-iconFailed)' };
  if (temp >= 80) return { label: 'WARM', color: 'var(--vscode-list-warningForeground)' };
  return { label: 'COOL', color: 'var(--vscode-testing-iconPassed)' };
}

const DutyBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div style={{ marginBottom: '4px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '1px' }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{value.toFixed(0)}%</span>
    </div>
    <div style={{
      height: '6px',
      background: 'var(--vscode-progressBar-background)',
      borderRadius: '3px',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, value))}%`,
        height: '100%',
        background: 'var(--vscode-charts-blue)',
        borderRadius: '3px',
        transition: 'width 0.2s ease',
      }} />
    </div>
  </div>
);

const HistoryChart: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  const maxVal = Math.max(...values, 1);
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '1px',
      height: '32px',
      marginTop: '4px',
    }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / maxVal) * 100}%`,
            background: color,
            borderRadius: '1px 1px 0 0',
            opacity: 0.6 + (i / values.length) * 0.4,
            minWidth: '2px',
          }}
          title={`${v.toFixed(0)} mA`}
        />
      ))}
    </div>
  );
};

const MotorPanel: React.FC<{
  label: string;
  channel: MotorChannel;
  history: number[];
  color: string;
}> = ({ label, channel, history, color }) => {
  const duty = Math.max(channel.rpwm, channel.lpwm);
  const temp = estimateTemp(channel.i_ma, duty);
  const direction = getDirection(channel);
  const tempBadge = getTempBadge(temp);

  return (
    <div style={{
      flex: 1,
      background: 'var(--vscode-editorWidget-background)',
      border: '1px solid var(--vscode-panel-border)',
      borderRadius: '4px',
      padding: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{label}</span>
        <span style={{
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '11px',
          fontWeight: 'bold',
          background: channel.en ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-badge-background)',
          color: channel.en ? 'var(--vscode-editor-background)' : 'var(--vscode-badge-foreground)',
        }}>
          {channel.en ? 'EN' : 'DIS'}
        </span>
      </div>

      {/* Direction */}
      <div style={{
        fontSize: '12px',
        marginBottom: '8px',
        padding: '4px 8px',
        background: 'var(--vscode-badge-background)',
        borderRadius: '3px',
        textAlign: 'center',
        fontWeight: 'bold',
      }}>
        {direction}
      </div>

      {/* Duty bars */}
      <DutyBar label="RPWM" value={channel.rpwm} />
      <DutyBar label="LPWM" value={channel.lpwm} />

      {/* Current */}
      <div style={{ marginTop: '8px' }}>
        <CurrentBar
          value_ma={channel.i_ma}
          warn_ma={WARN_MA}
          critical_ma={CRITICAL_MA}
          max_ma={MAX_MA}
          label="Current"
        />
      </div>

      {/* Temperature estimate */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <span style={{ fontSize: '11px', opacity: 0.7 }}>Temp (est.)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px' }}>{temp.toFixed(0)} C</span>
          <span style={{
            padding: '1px 6px',
            borderRadius: '8px',
            fontSize: '10px',
            fontWeight: 'bold',
            background: tempBadge.color,
            color: 'var(--vscode-editor-background)',
          }}>
            {tempBadge.label}
          </span>
        </div>
      </div>

      {/* Current history */}
      {history.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '10px', opacity: 0.5 }}>Current history ({history.length} samples)</div>
          <HistoryChart values={history} color={color} />
        </div>
      )}
    </div>
  );
};

export const MotorPage: React.FC = () => {
  const packet = useHwStore((s) => s.latestPacket);
  const motorHistory = useHwStore((s) => s.motorHistory);

  if (!packet) {
    return <div style={{ opacity: 0.6, padding: '20px' }}>Waiting for telemetry data...</div>;
  }

  return (
    <div>
      <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>Motor Control</div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <MotorPanel
          label="Left Motor"
          channel={packet.motors.left}
          history={motorHistory.leftCurrent}
          color="var(--vscode-charts-blue)"
        />
        <MotorPanel
          label="Right Motor"
          channel={packet.motors.right}
          history={motorHistory.rightCurrent}
          color="var(--vscode-charts-purple)"
        />
      </div>
    </div>
  );
};
