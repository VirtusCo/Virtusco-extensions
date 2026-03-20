// Copyright 2026 VirtusCo
// Horizontal bar of status dots with tooltips for each process

import React from 'react';
import { ProcessInfo } from '../store/simStore';

interface ProcessStatusBarProps {
  processes: ProcessInfo[];
}

export default function ProcessStatusBar({ processes }: ProcessStatusBarProps): React.ReactElement {
  if (processes.length === 0) {
    return (
      <div style={{
        fontSize: '11px',
        color: 'var(--vscode-descriptionForeground)',
        padding: '4px 0',
      }}>
        No processes
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
      alignItems: 'center',
      padding: '4px 0',
    }}>
      {processes.map((proc) => {
        const dotColor = proc.status === 'running'
          ? '#4caf50'
          : proc.status === 'error'
            ? '#f44336'
            : '#9e9e9e';

        return (
          <div
            key={proc.id}
            title={`${proc.name} (PID ${proc.pid}) - ${proc.status}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              background: 'var(--vscode-sideBar-background)',
              borderRadius: '10px',
              fontSize: '10px',
            }}
          >
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: dotColor,
              flexShrink: 0,
            }} />
            <span style={{ color: 'var(--vscode-foreground)' }}>{proc.name}</span>
            <span style={{ color: 'var(--vscode-descriptionForeground)' }}>({proc.pid})</span>
          </div>
        );
      })}
    </div>
  );
}
