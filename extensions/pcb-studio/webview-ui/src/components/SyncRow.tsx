// Copyright 2026 VirtusCo

import { SyncResult } from '../store/pcbStore';
import { vscode } from '../vscodeApi';

interface SyncRowProps {
  result: SyncResult;
}

const STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  ok: { color: '#4caf50', icon: '[OK]' },
  mismatch: { color: '#f44336', icon: '[X]' },
  missing: { color: '#ff9800', icon: '[!]' },
};

export function SyncRow({ result }: SyncRowProps) {
  const config = STATUS_CONFIG[result.status];

  const handleViewInEditor = () => {
    vscode.postMessage({
      type: 'openFile',
      path: '',
    });
  };

  return (
    <tr style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
      <td style={{ padding: '6px 8px' }}>
        <span style={{
          color: config.color,
          fontWeight: 'bold',
          fontSize: '12px',
          fontFamily: 'monospace',
        }}>
          {config.icon}
        </span>
      </td>
      <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{result.net_name}</td>
      <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--vscode-charts-blue)' }}>
        {result.dts_alias}
      </td>
      <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '11px' }}>
        {result.schematic_pin}
      </td>
      <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '11px' }}>
        {result.dts_pin}
      </td>
      <td style={{ padding: '6px 8px' }}>
        {result.status !== 'ok' && (
          <button
            onClick={handleViewInEditor}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--vscode-textLink-foreground)',
              cursor: 'pointer',
              fontSize: '11px',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            View in Editor
          </button>
        )}
      </td>
    </tr>
  );
}
