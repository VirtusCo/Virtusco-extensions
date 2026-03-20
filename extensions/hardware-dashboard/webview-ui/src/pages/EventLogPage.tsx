// Copyright 2026 VirtusCo

import React, { useState, useEffect, useCallback } from 'react';
import { useHwStore, type AlertItem } from '../store/hwStore';
import { vscode } from '../vscodeApi';

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'var(--vscode-testing-iconFailed)';
    case 'warning': return 'var(--vscode-list-warningForeground)';
    default: return 'var(--vscode-charts-blue)';
  }
}

export const EventLogPage: React.FC = () => {
  const eventLog = useHwStore((s) => s.eventLog);

  const [filterCritical, setFilterCritical] = useState(true);
  const [filterWarning, setFilterWarning] = useState(true);
  const [filterInfo, setFilterInfo] = useState(true);

  useEffect(() => {
    vscode.postMessage({ type: 'requestEventLog' });
  }, []);

  const handleExport = useCallback(() => {
    vscode.postMessage({ type: 'exportCsv' });
  }, []);

  const filteredEvents = eventLog.filter((e: AlertItem) => {
    if (e.severity === 'critical' && !filterCritical) return false;
    if (e.severity === 'warning' && !filterWarning) return false;
    if (e.severity === 'info' && !filterInfo) return false;
    return true;
  });

  const timeRange = filteredEvents.length > 0
    ? `${new Date(filteredEvents[filteredEvents.length - 1].timestamp).toLocaleString()} - ${new Date(filteredEvents[0].timestamp).toLocaleString()}`
    : 'No events';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Event Log ({filteredEvents.length})</div>
        <button
          onClick={handleExport}
          style={{
            padding: '4px 12px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        fontSize: '12px',
      }}>
        <span style={{ opacity: 0.7 }}>Filter:</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={filterCritical} onChange={() => setFilterCritical(!filterCritical)} />
          Critical
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={filterWarning} onChange={() => setFilterWarning(!filterWarning)} />
          Warning
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={filterInfo} onChange={() => setFilterInfo(!filterInfo)} />
          Info
        </label>
      </div>

      {/* Time range */}
      <div style={{ fontSize: '11px', opacity: 0.5 }}>
        Time range: {timeRange}
      </div>

      {/* Event list */}
      <div style={{
        background: 'var(--vscode-editorWidget-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: '4px',
        maxHeight: '500px',
        overflowY: 'auto',
      }}>
        {filteredEvents.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6 }}>
            No events recorded
          </div>
        ) : (
          filteredEvents.map((event: AlertItem, i: number) => (
            <div key={`${event.id}-${event.timestamp}-${i}`} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '8px 12px',
              borderBottom: i < filteredEvents.length - 1 ? '1px solid var(--vscode-panel-border)' : 'none',
            }}>
              {/* Timestamp */}
              <span style={{
                fontSize: '10px',
                opacity: 0.6,
                whiteSpace: 'nowrap',
                fontFamily: 'var(--vscode-editor-font-family)',
                minWidth: '75px',
              }}>
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>

              {/* Severity badge */}
              <span style={{
                padding: '1px 6px',
                borderRadius: '8px',
                fontSize: '10px',
                fontWeight: 'bold',
                background: severityColor(event.severity),
                color: 'var(--vscode-editor-background)',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                minWidth: '55px',
                textAlign: 'center',
              }}>
                {event.severity}
              </span>

              {/* Type/field */}
              <span style={{
                fontSize: '11px',
                opacity: 0.7,
                whiteSpace: 'nowrap',
                minWidth: '80px',
              }}>
                {event.field}
              </span>

              {/* Details */}
              <span style={{ flex: 1, fontSize: '12px' }}>
                {event.message}
              </span>

              {/* Value */}
              <span style={{
                fontSize: '11px',
                fontFamily: 'var(--vscode-editor-font-family)',
                opacity: 0.7,
                whiteSpace: 'nowrap',
              }}>
                {event.value.toFixed(1)} / {event.threshold.toFixed(1)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
