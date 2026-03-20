// Copyright 2026 VirtusCo

import { vscode } from '../vscodeApi';
import { useSuiteStore } from '../store/suiteStore';
import { ExtensionTile } from '../components/ExtensionTile';

export function DashboardPage() {
  const extensions = useSuiteStore((s) => s.extensions);
  const workspace = useSuiteStore((s) => s.workspace);
  const alerts = useSuiteStore((s) => s.alerts);
  const clearAlerts = useSuiteStore((s) => s.clearAlerts);

  const handleRefresh = () => {
    vscode.postMessage({ type: 'requestStatus' });
  };

  const handleOpen = (openCommand: string) => {
    vscode.postMessage({ type: 'openExtension', openCommand });
  };

  const handleInstall = (id: string) => {
    vscode.postMessage({ type: 'installExtension', id });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            VirtusCo DevTools Suite
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
            Unified development environment for Porter Robot
          </div>
        </div>
        <button
          onClick={handleRefresh}
          style={{
            padding: '6px 14px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: 'var(--vscode-font-family)',
          }}
        >
          Refresh Status
        </button>
      </div>

      {/* Extension tile grid */}
      <div>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 500 }}>Extensions</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
        }}>
          {extensions.map((ext) => (
            <ExtensionTile
              key={ext.id}
              name={ext.name}
              description={ext.description}
              installed={ext.installed}
              version={ext.version}
              onOpen={() => handleOpen(ext.openCommand)}
              onInstall={() => handleInstall(ext.id)}
            />
          ))}
        </div>
      </div>

      {/* System status section */}
      <div>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 500 }}>System Status</h3>
        <div style={{
          border: '1px solid var(--vscode-panel-border, #333)',
          borderRadius: '4px',
          padding: '12px',
          background: 'var(--vscode-editor-background)',
        }}>
          {workspace ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--vscode-descriptionForeground)', width: '80px' }}>Workspace:</span>
                <span style={{ fontWeight: 500 }}>{workspace.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--vscode-descriptionForeground)', width: '80px' }}>Branch:</span>
                <span>{workspace.branch}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--vscode-descriptionForeground)', width: '80px' }}>Path:</span>
                <span style={{ fontSize: '11px', wordBreak: 'break-all' }}>{workspace.path}</span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>
              No Porter-ROS workspace detected. Use Setup tab to bootstrap one.
            </div>
          )}
        </div>
      </div>

      {/* Alerts section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>Alerts</h3>
          {alerts.length > 0 && (
            <button
              onClick={clearAlerts}
              style={{
                padding: '3px 8px',
                background: 'transparent',
                color: 'var(--vscode-descriptionForeground)',
                border: '1px solid var(--vscode-panel-border)',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: 'var(--vscode-font-family)',
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div style={{
          border: '1px solid var(--vscode-panel-border, #333)',
          borderRadius: '4px',
          padding: '8px',
          background: 'var(--vscode-editor-background)',
          maxHeight: '150px',
          overflowY: 'auto',
        }}>
          {alerts.length === 0 ? (
            <div style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic', fontSize: '12px' }}>
              No alerts
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  padding: '4px 8px',
                  borderLeft: `3px solid ${
                    alert.level === 'error'
                      ? 'var(--vscode-errorForeground, #f44336)'
                      : alert.level === 'warning'
                        ? 'var(--vscode-charts-yellow, #ffb300)'
                        : 'var(--vscode-charts-blue, #2196f3)'
                  }`,
                  marginBottom: '4px',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '10px' }}>
                  [{alert.source}]
                </span>{' '}
                {alert.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
