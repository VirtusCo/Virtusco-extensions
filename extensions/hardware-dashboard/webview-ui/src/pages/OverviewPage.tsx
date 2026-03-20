// Copyright 2026 VirtusCo

import React from 'react';
import { useHwStore } from '../store/hwStore';

const cardStyle: React.CSSProperties = {
  background: 'var(--vscode-editorWidget-background)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '4px',
  padding: '12px',
  minWidth: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  opacity: 0.7,
  marginBottom: '8px',
  letterSpacing: '0.5px',
};

const valueStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 'bold',
  marginBottom: '4px',
};

const MiniBar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
  <div style={{
    height: '4px',
    background: 'var(--vscode-progressBar-background)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '4px',
  }}>
    <div style={{
      width: `${Math.max(0, Math.min(100, pct))}%`,
      height: '100%',
      background: color,
      borderRadius: '2px',
    }} />
  </div>
);

export const OverviewPage: React.FC = () => {
  const packet = useHwStore((s) => s.latestPacket);
  const alerts = useHwStore((s) => s.alerts);
  const connected = useHwStore((s) => s.connected);
  const port = useHwStore((s) => s.port);

  if (!packet) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>Hardware Dashboard</div>
        <div>{connected ? `Connected to ${port} - Waiting for data...` : 'Not connected. Use the sidebar to connect to a telemetry port.'}</div>
      </div>
    );
  }

  const { power, motors, sensors } = packet;

  const voltageColor = (v: number, nominal: number, warnDelta: number): string => {
    const delta = Math.abs(v - nominal);
    if (delta > warnDelta * 1.5) return 'var(--vscode-testing-iconFailed)';
    if (delta > warnDelta) return 'var(--vscode-list-warningForeground)';
    return 'var(--vscode-testing-iconPassed)';
  };

  const leftDuty = Math.max(motors.left.rpwm, motors.left.lpwm);
  const rightDuty = Math.max(motors.right.rpwm, motors.right.lpwm);
  const critAlerts = alerts.filter((a) => a.severity === 'critical').length;
  const warnAlerts = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '12px',
    }}>
      {/* Power Card */}
      <div style={cardStyle}>
        <div style={titleStyle}>Power Rails</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
              <span>12V</span>
              <span style={{ color: voltageColor(power.v12, 12, 0.5), fontWeight: 'bold' }}>{power.v12.toFixed(2)}V</span>
            </div>
            <MiniBar pct={(power.v12 / 14) * 100} color={voltageColor(power.v12, 12, 0.5)} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
              <span>5V</span>
              <span style={{ color: voltageColor(power.v5, 5, 0.25), fontWeight: 'bold' }}>{power.v5.toFixed(2)}V</span>
            </div>
            <MiniBar pct={(power.v5 / 6) * 100} color={voltageColor(power.v5, 5, 0.25)} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
              <span>3.3V</span>
              <span style={{ color: voltageColor(power.v33, 3.3, 0.2), fontWeight: 'bold' }}>{power.v33.toFixed(2)}V</span>
            </div>
            <MiniBar pct={(power.v33 / 4) * 100} color={voltageColor(power.v33, 3.3, 0.2)} />
          </div>
        </div>
      </div>

      {/* Motors Card */}
      <div style={cardStyle}>
        <div style={titleStyle}>Motors</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', marginBottom: '4px' }}>Left</div>
            <div style={valueStyle}>{leftDuty.toFixed(0)}%</div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>{motors.left.i_ma.toFixed(0)} mA</div>
            <MiniBar pct={leftDuty} color="var(--vscode-charts-blue)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', marginBottom: '4px' }}>Right</div>
            <div style={valueStyle}>{rightDuty.toFixed(0)}%</div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>{motors.right.i_ma.toFixed(0)} mA</div>
            <MiniBar pct={rightDuty} color="var(--vscode-charts-purple)" />
          </div>
        </div>
      </div>

      {/* Sensors Card */}
      <div style={cardStyle}>
        <div style={titleStyle}>Sensors</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>ToF</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{sensors.tof_mm} mm</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>Ultrasonic</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{sensors.sonic_cm.toFixed(1)} cm</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>Microwave</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{sensors.microwave}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>Kalman</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{sensors.kalman_cm.toFixed(1)} cm</div>
          </div>
        </div>
      </div>

      {/* Alerts Card */}
      <div style={cardStyle}>
        <div style={titleStyle}>Alerts</div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: critAlerts > 0 ? 'var(--vscode-testing-iconFailed)' : 'var(--vscode-foreground)' }}>
              {critAlerts}
            </div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>Critical</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: warnAlerts > 0 ? 'var(--vscode-list-warningForeground)' : 'var(--vscode-foreground)' }}>
              {warnAlerts}
            </div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>Warning</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{alerts.length}</div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>Total</div>
          </div>
        </div>
        {alerts.length > 0 && (
          <div style={{
            fontSize: '11px',
            padding: '6px 8px',
            background: alerts[0].severity === 'critical'
              ? 'rgba(255, 0, 0, 0.1)'
              : 'rgba(255, 200, 0, 0.1)',
            borderRadius: '3px',
            borderLeft: `3px solid ${alerts[0].severity === 'critical' ? 'var(--vscode-testing-iconFailed)' : 'var(--vscode-list-warningForeground)'}`,
          }}>
            {alerts[0].message}
          </div>
        )}
      </div>
    </div>
  );
};
