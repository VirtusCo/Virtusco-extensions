// Copyright 2026 VirtusCo

import { usePCBStore } from '../store/pcbStore';
import { vscode } from '../vscodeApi';
import { SyncRow } from '../components/SyncRow';

export function SyncPage() {
  const results = usePCBStore((s) => s.syncResults);

  const okCount = results.filter((r) => r.status === 'ok').length;
  const mismatchCount = results.filter((r) => r.status === 'mismatch').length;
  const missingCount = results.filter((r) => r.status === 'missing').length;

  const handleRunCheck = () => {
    vscode.postMessage({ type: 'runSyncCheck', schematicPath: '', overlayPath: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderBottom: '1px solid var(--vscode-panel-border)',
        background: 'var(--vscode-editorWidget-background)',
      }}>
        <button
          onClick={handleRunCheck}
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
          Run Sync Check
        </button>
      </div>

      {/* Summary */}
      {results.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '24px',
          padding: '8px 12px',
          borderBottom: '1px solid var(--vscode-panel-border)',
          fontSize: '12px',
        }}>
          <span style={{ color: '#4caf50' }}>
            {okCount} OK
          </span>
          <span style={{ color: '#f44336' }}>
            {mismatchCount} Mismatch
          </span>
          <span style={{ color: '#ff9800' }}>
            {missingCount} Missing
          </span>
        </div>
      )}

      {/* Results table */}
      {results.length > 0 ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>Status</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>Net Name</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>DTS Alias</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>Schematic Pin</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>DTS Pin</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, i) => (
                <SyncRow key={i} result={result} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          color: 'var(--vscode-descriptionForeground)',
          fontSize: '13px',
        }}>
          Click "Run Sync Check" to compare schematic nets with DTS overlay
        </div>
      )}
    </div>
  );
}
