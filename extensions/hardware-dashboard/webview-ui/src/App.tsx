// Copyright 2026 VirtusCo

import React, { useEffect } from 'react';
import { useHwStore, type PageId } from './store/hwStore';
import { vscode } from './vscodeApi';
import { OverviewPage } from './pages/OverviewPage';
import { PowerPage } from './pages/PowerPage';
import { MotorPage } from './pages/MotorPage';
import { SensorPage } from './pages/SensorPage';
import { AlertsPage } from './pages/AlertsPage';
import { EventLogPage } from './pages/EventLogPage';

const TABS: { id: PageId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'power', label: 'Power' },
  { id: 'motors', label: 'Motors' },
  { id: 'sensors', label: 'Sensors' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'eventlog', label: 'Event Log' },
];

export const App: React.FC = () => {
  const activePage = useHwStore((s) => s.activePage);
  const setActivePage = useHwStore((s) => s.setActivePage);
  const updateTelemetry = useHwStore((s) => s.updateTelemetry);
  const setConnected = useHwStore((s) => s.setConnected);
  const addAlert = useHwStore((s) => s.addAlert);
  const clearAlerts = useHwStore((s) => s.clearAlerts);
  const setEventLog = useHwStore((s) => s.setEventLog);
  const setPorts = useHwStore((s) => s.setPorts);
  const setThresholds = useHwStore((s) => s.setThresholds);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case 'telemetry':
          updateTelemetry(msg.packet);
          break;
        case 'alert':
          addAlert(msg.alert);
          break;
        case 'alertCleared':
          clearAlerts();
          break;
        case 'connectionStatus':
          setConnected(msg.connected, msg.port);
          break;
        case 'portList':
          setPorts(msg.ports);
          break;
        case 'eventLog':
          setEventLog(msg.events);
          break;
        case 'thresholds':
          setThresholds(msg.config);
          break;
        case 'error':
          console.error('Host error:', msg.message);
          break;
      }
    };

    window.addEventListener('message', handler);
    // Request initial data
    vscode.postMessage({ type: 'requestPortList' });
    vscode.postMessage({ type: 'requestEventLog' });

    return () => window.removeEventListener('message', handler);
  }, [updateTelemetry, setConnected, addAlert, clearAlerts, setEventLog, setPorts, setThresholds]);

  const renderPage = () => {
    switch (activePage) {
      case 'overview': return <OverviewPage />;
      case 'power': return <PowerPage />;
      case 'motors': return <MotorPage />;
      case 'sensors': return <SensorPage />;
      case 'alerts': return <AlertsPage />;
      case 'eventlog': return <EventLogPage />;
      default: return <OverviewPage />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--vscode-panel-border)',
        background: 'var(--vscode-editorGroupHeader-tabsBackground)',
        flexShrink: 0,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActivePage(tab.id);
              vscode.postMessage({ type: 'changePage', page: tab.id });
            }}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activePage === tab.id
                ? '2px solid var(--vscode-focusBorder)'
                : '2px solid transparent',
              background: activePage === tab.id
                ? 'var(--vscode-tab-activeBackground)'
                : 'transparent',
              color: activePage === tab.id
                ? 'var(--vscode-tab-activeForeground)'
                : 'var(--vscode-tab-inactiveForeground)',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'var(--vscode-font-family)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {renderPage()}
      </div>
    </div>
  );
};
