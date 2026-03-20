// Copyright 2026 VirtusCo
// FSM viewer page — 9-state diagram with transition history

import React, { useMemo } from 'react';
import { useRos2Store, FSMState } from '../store/ros2Store';

// ── State Layout ────────────────────────────────────────────────────

interface StatePosition {
  name: string;
  x: number;
  y: number;
  color: string;
}

const STATE_POSITIONS: StatePosition[] = [
  { name: 'IDLE', x: 50, y: 50, color: '#9e9e9e' },
  { name: 'WAITING_FOR_PASSENGER', x: 280, y: 50, color: '#9e9e9e' },
  { name: 'GREETING', x: 510, y: 50, color: '#9e9e9e' },
  { name: 'LOADING_LUGGAGE', x: 510, y: 180, color: '#9e9e9e' },
  { name: 'NAVIGATING', x: 280, y: 180, color: '#2196f3' },
  { name: 'AVOIDING_OBSTACLE', x: 280, y: 310, color: '#ff9800' },
  { name: 'UNLOADING_LUGGAGE', x: 50, y: 180, color: '#9e9e9e' },
  { name: 'EMERGENCY_STOP', x: 510, y: 310, color: '#f44336' },
  { name: 'ERROR_RECOVERY', x: 50, y: 310, color: '#ff9800' },
];

// ── Transitions ─────────────────────────────────────────────────────

interface TransitionDef {
  from: string;
  to: string;
  trigger: string;
}

const TRANSITIONS: TransitionDef[] = [
  { from: 'IDLE', to: 'WAITING_FOR_PASSENGER', trigger: 'start_service' },
  { from: 'WAITING_FOR_PASSENGER', to: 'GREETING', trigger: 'passenger_detected' },
  { from: 'GREETING', to: 'LOADING_LUGGAGE', trigger: 'greeting_complete' },
  { from: 'LOADING_LUGGAGE', to: 'NAVIGATING', trigger: 'luggage_loaded' },
  { from: 'NAVIGATING', to: 'AVOIDING_OBSTACLE', trigger: 'obstacle_detected' },
  { from: 'AVOIDING_OBSTACLE', to: 'NAVIGATING', trigger: 'obstacle_cleared' },
  { from: 'NAVIGATING', to: 'UNLOADING_LUGGAGE', trigger: 'destination_reached' },
  { from: 'UNLOADING_LUGGAGE', to: 'IDLE', trigger: 'luggage_unloaded' },
  { from: 'WAITING_FOR_PASSENGER', to: 'IDLE', trigger: 'timeout' },
  { from: 'NAVIGATING', to: 'EMERGENCY_STOP', trigger: 'emergency' },
  { from: 'AVOIDING_OBSTACLE', to: 'EMERGENCY_STOP', trigger: 'emergency' },
  { from: 'EMERGENCY_STOP', to: 'ERROR_RECOVERY', trigger: 'emergency_cleared' },
  { from: 'ERROR_RECOVERY', to: 'IDLE', trigger: 'recovery_complete' },
  { from: 'ERROR_RECOVERY', to: 'NAVIGATING', trigger: 'resume_navigation' },
];

const STATE_WIDTH = 180;
const STATE_HEIGHT = 50;

function getStateColor(stateName: string, currentState: string): { bg: string; border: string } {
  const isActive = stateName === currentState;
  const pos = STATE_POSITIONS.find((s) => s.name === stateName);
  const baseColor = pos?.color ?? '#9e9e9e';

  if (isActive) {
    return { bg: baseColor + '40', border: baseColor };
  }
  return { bg: 'var(--vscode-editor-background, #1e1e1e)', border: '#555' };
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function FSMViewerPage(): React.ReactElement {
  const fsmState = useRos2Store((s) => s.fsmState);
  const fsmHistory = useRos2Store((s) => s.fsmHistory);

  const durationInState = useMemo(() => {
    if (fsmHistory.length === 0) {
      return 0;
    }
    const lastEntry = fsmHistory[fsmHistory.length - 1];
    return Date.now() - lastEntry.timestamp;
  }, [fsmHistory]);

  return (
    <div style={{ padding: '12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        flexShrink: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>FSM Viewer</h2>
        <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
          Current: <span style={{ fontWeight: 600, color: 'var(--vscode-foreground)' }}>{fsmState}</span>
          {fsmHistory.length > 0 && (
            <span style={{ marginLeft: '8px' }}>({formatDuration(durationInState)})</span>
          )}
        </div>
      </div>

      {/* State Diagram */}
      <div style={{
        position: 'relative',
        width: '740px',
        height: '400px',
        margin: '0 auto',
        flexShrink: 0,
      }}>
        {/* Transition arrows (simplified lines) */}
        <svg
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          viewBox="0 0 740 400"
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#666" />
            </marker>
          </defs>
          {TRANSITIONS.map((t, idx) => {
            const fromPos = STATE_POSITIONS.find((s) => s.name === t.from);
            const toPos = STATE_POSITIONS.find((s) => s.name === t.to);
            if (!fromPos || !toPos) {
              return null;
            }

            const x1 = fromPos.x + STATE_WIDTH / 2;
            const y1 = fromPos.y + STATE_HEIGHT / 2;
            const x2 = toPos.x + STATE_WIDTH / 2;
            const y2 = toPos.y + STATE_HEIGHT / 2;

            // Offset slightly for bidirectional arrows
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const offsetX = (-dy / len) * 4;
            const offsetY = (dx / len) * 4;

            return (
              <line
                key={idx}
                x1={x1 + offsetX}
                y1={y1 + offsetY}
                x2={x2 + offsetX}
                y2={y2 + offsetY}
                stroke="#555"
                strokeWidth="1.5"
                markerEnd="url(#arrowhead)"
                opacity={0.5}
              />
            );
          })}
        </svg>

        {/* State boxes */}
        {STATE_POSITIONS.map((sp) => {
          const isActive = sp.name === fsmState;
          const colors = getStateColor(sp.name, fsmState);

          return (
            <div
              key={sp.name}
              style={{
                position: 'absolute',
                left: sp.x,
                top: sp.y,
                width: STATE_WIDTH,
                height: STATE_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                border: `2px solid ${colors.border}`,
                background: colors.bg,
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--vscode-foreground)',
                zIndex: 2,
                boxShadow: isActive ? `0 0 12px ${sp.color}66` : 'none',
                animation: isActive ? 'pulse 2s infinite' : 'none',
              }}
            >
              {sp.name.replace(/_/g, ' ')}
              {isActive && (
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  background: sp.color,
                  color: '#fff',
                  borderRadius: '3px',
                  padding: '1px 4px',
                  fontSize: '8px',
                }}>
                  ACTIVE
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(33, 150, 243, 0.3); }
          50% { box-shadow: 0 0 20px rgba(33, 150, 243, 0.6); }
        }
      `}</style>

      {/* Transition History Table */}
      <div style={{ flex: 1, overflow: 'auto', marginTop: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          Transition History (last 20)
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--vscode-panel-border, #333)' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Time</th>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>From</th>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>To</th>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Trigger</th>
            </tr>
          </thead>
          <tbody>
            {fsmHistory.length === 0 ? (
              <tr>
                <td colSpan={4} style={{
                  padding: '16px',
                  textAlign: 'center',
                  color: 'var(--vscode-descriptionForeground)',
                }}>
                  No transitions recorded yet.
                </td>
              </tr>
            ) : (
              [...fsmHistory].reverse().map((entry, idx) => {
                // Determine "from" by looking at previous entry
                const prevIdx = fsmHistory.length - 1 - idx - 1;
                const fromState = prevIdx >= 0 ? fsmHistory[prevIdx].state : 'IDLE';

                return (
                  <tr key={idx} style={{
                    borderBottom: '1px solid var(--vscode-panel-border, #2a2a2a)',
                  }}>
                    <td style={{ padding: '4px 8px', color: 'var(--vscode-descriptionForeground)' }}>
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td style={{ padding: '4px 8px' }}>{fromState}</td>
                    <td style={{ padding: '4px 8px', fontWeight: 600 }}>{entry.state}</td>
                    <td style={{ padding: '4px 8px', color: 'var(--vscode-textLink-foreground)' }}>
                      {entry.trigger}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
