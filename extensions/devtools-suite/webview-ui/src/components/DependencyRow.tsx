// Copyright 2026 VirtusCo

import { vscode } from '../vscodeApi';

interface DependencyRowProps {
  name: string;
  found: boolean;
  version: string;
  required_by: string[];
  install_url: string;
}

export function DependencyRow({
  name,
  found,
  version,
  required_by,
  install_url,
}: DependencyRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '6px 0',
      borderBottom: '1px solid var(--vscode-panel-border, #333)',
      gap: '10px',
    }}>
      {/* Status indicator */}
      <div style={{
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: found
          ? 'var(--vscode-charts-green, #4caf50)'
          : 'var(--vscode-errorForeground, #f44336)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '10px',
        fontWeight: 'bold',
      }}>
        {found ? 'Y' : 'N'}
      </div>

      {/* Name and version */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: '13px' }}>{name}</div>
        <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
          {found ? `v${version}` : 'Not found'}
          {' | Required by: '}
          {required_by.join(', ')}
        </div>
      </div>

      {/* Install link if missing */}
      {!found && (
        <button
          onClick={() => {
            vscode.postMessage({ type: 'openExternalUrl', url: install_url });
          }}
          style={{
            padding: '3px 8px',
            background: 'transparent',
            color: 'var(--vscode-textLink-foreground, #3794ff)',
            border: '1px solid var(--vscode-textLink-foreground, #3794ff)',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '11px',
            fontFamily: 'var(--vscode-font-family)',
            flexShrink: 0,
          }}
        >
          Install Guide
        </button>
      )}
    </div>
  );
}
