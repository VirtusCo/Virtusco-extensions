// Copyright 2026 VirtusCo

import { vscode } from '../vscodeApi';
import { useSuiteStore } from '../store/suiteStore';
import { DependencyRow } from '../components/DependencyRow';

export function InstallerPage() {
  const extensions = useSuiteStore((s) => s.extensions);
  const dependencies = useSuiteStore((s) => s.dependencies);

  const missingCount = extensions.filter((e) => !e.installed).length;

  const handleInstallAll = () => {
    vscode.postMessage({ type: 'installAll' });
  };

  const handleInstall = (id: string) => {
    vscode.postMessage({ type: 'installExtension', id });
  };

  const handleOpen = (openCommand: string) => {
    vscode.postMessage({ type: 'openExtension', openCommand });
  };

  const handleCheckAll = () => {
    vscode.postMessage({ type: 'checkDependencies' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Extensions section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 500 }}>
            VirtusCo Extensions ({extensions.filter((e) => e.installed).length}/{extensions.length} installed)
          </h3>
          {missingCount > 0 && (
            <button
              onClick={handleInstallAll}
              style={{
                padding: '6px 14px',
                background: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'var(--vscode-font-family)',
              }}
            >
              Install All Missing ({missingCount})
            </button>
          )}
        </div>

        <div style={{
          border: '1px solid var(--vscode-panel-border, #333)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          {extensions.map((ext, idx) => (
            <div
              key={ext.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                gap: '12px',
                borderBottom: idx < extensions.length - 1
                  ? '1px solid var(--vscode-panel-border, #333)'
                  : 'none',
                background: 'var(--vscode-editor-background)',
              }}
            >
              {/* Status dot */}
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: ext.installed
                  ? 'var(--vscode-charts-green, #4caf50)'
                  : 'var(--vscode-descriptionForeground, #888)',
                flexShrink: 0,
              }} />

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: '13px' }}>{ext.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
                  {ext.description}
                </div>
              </div>

              {/* Version */}
              {ext.installed && ext.version && (
                <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
                  v{ext.version}
                </span>
              )}

              {/* Action button */}
              {ext.installed ? (
                <button
                  onClick={() => handleOpen(ext.openCommand)}
                  style={{
                    padding: '4px 10px',
                    background: 'var(--vscode-button-background)',
                    color: 'var(--vscode-button-foreground)',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'var(--vscode-font-family)',
                  }}
                >
                  Open
                </button>
              ) : (
                <button
                  onClick={() => handleInstall(ext.id)}
                  style={{
                    padding: '4px 10px',
                    background: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-button-secondaryForeground)',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'var(--vscode-font-family)',
                  }}
                >
                  Install
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dependencies section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 500 }}>
            System Dependencies
            {dependencies.length > 0 && (
              <span style={{ fontWeight: 400, fontSize: '13px', color: 'var(--vscode-descriptionForeground)' }}>
                {' '}({dependencies.filter((d) => d.found).length}/{dependencies.length} found)
              </span>
            )}
          </h3>
          <button
            onClick={handleCheckAll}
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
            Check All
          </button>
        </div>

        <div style={{
          border: '1px solid var(--vscode-panel-border, #333)',
          borderRadius: '4px',
          padding: '8px 12px',
          background: 'var(--vscode-editor-background)',
        }}>
          {dependencies.length === 0 ? (
            <div style={{
              color: 'var(--vscode-descriptionForeground)',
              fontStyle: 'italic',
              fontSize: '12px',
              padding: '8px 0',
            }}>
              Click "Check All" to scan system dependencies.
            </div>
          ) : (
            dependencies.map((dep) => (
              <DependencyRow
                key={dep.name}
                name={dep.name}
                found={dep.found}
                version={dep.version}
                required_by={dep.required_by}
                install_url={dep.install_url}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
