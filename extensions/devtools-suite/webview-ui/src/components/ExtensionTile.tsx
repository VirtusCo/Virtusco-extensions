// Copyright 2026 VirtusCo

interface ExtensionTileProps {
  name: string;
  description: string;
  installed: boolean;
  version: string;
  onOpen: () => void;
  onInstall: () => void;
}

export function ExtensionTile({
  name,
  description,
  installed,
  version,
  onOpen,
  onInstall,
}: ExtensionTileProps) {
  return (
    <div style={{
      border: `1px solid ${installed ? 'var(--vscode-charts-green, #4caf50)' : 'var(--vscode-panel-border, #444)'}`,
      borderRadius: '4px',
      padding: '12px',
      background: 'var(--vscode-editor-background)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: '13px' }}>{name}</div>
        <span style={{
          fontSize: '10px',
          padding: '2px 6px',
          borderRadius: '8px',
          background: installed
            ? 'var(--vscode-charts-green, #4caf50)'
            : 'var(--vscode-descriptionForeground, #888)',
          color: '#fff',
        }}>
          {installed ? 'Installed' : 'Not Installed'}
        </span>
      </div>

      <div style={{
        fontSize: '12px',
        color: 'var(--vscode-descriptionForeground)',
        lineHeight: '1.4',
      }}>
        {description}
      </div>

      {installed && version && (
        <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
          v{version}
        </div>
      )}

      <div>
        {installed ? (
          <button
            onClick={onOpen}
            style={{
              padding: '4px 12px',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--vscode-font-family)',
            }}
          >
            Open
          </button>
        ) : (
          <button
            onClick={onInstall}
            style={{
              padding: '4px 12px',
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--vscode-font-family)',
            }}
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
