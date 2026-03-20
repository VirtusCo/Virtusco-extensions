// Copyright 2026 VirtusCo

import { usePCBStore } from '../store/pcbStore';
import { vscode } from '../vscodeApi';

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: '#f44336',
  MEDIUM: '#ff9800',
  LOW: '#4caf50',
};

export function ImpactPage() {
  const impacts = usePCBStore((s) => s.impactResults);

  const highImpacts = impacts.filter((i) => i.severity === 'HIGH');
  const mediumImpacts = impacts.filter((i) => i.severity === 'MEDIUM');
  const lowImpacts = impacts.filter((i) => i.severity === 'LOW');

  const handleOpenFile = (filePath: string, line: number) => {
    vscode.postMessage({ type: 'openFile', path: filePath, line });
  };

  const handleCreateIssue = (impact: { change: string; description: string; severity: string }) => {
    const title = `[PCB Impact] ${impact.change}`;
    const body = `## Severity: ${impact.severity}\n\n${impact.description}\n\nDetected by Virtus PCB Studio schematic diff analysis.`;
    vscode.postMessage({ type: 'createIssue', title, body });
  };

  const renderGroup = (label: string, items: typeof impacts) => {
    if (items.length === 0) {
      return null;
    }
    return (
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          padding: '4px 8px',
          background: 'var(--vscode-editorWidget-background)',
          borderRadius: '4px',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: SEVERITY_COLORS[label],
          }} />
          <span style={{
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}>
            {label} ({items.length})
          </span>
        </div>

        {items.map((impact, idx) => (
          <div
            key={idx}
            style={{
              padding: '8px 12px',
              marginBottom: '8px',
              border: `1px solid ${SEVERITY_COLORS[impact.severity]}33`,
              borderLeft: `3px solid ${SEVERITY_COLORS[impact.severity]}`,
              borderRadius: '4px',
              background: 'var(--vscode-editor-background)',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '6px',
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{impact.change}</div>
              <button
                onClick={() => handleCreateIssue(impact)}
                style={{
                  background: 'none',
                  border: '1px solid var(--vscode-button-secondaryBackground)',
                  color: 'var(--vscode-button-secondaryForeground)',
                  cursor: 'pointer',
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '2px',
                  whiteSpace: 'nowrap',
                }}
              >
                Create GitHub Issue
              </button>
            </div>

            <div style={{
              fontSize: '11px',
              color: 'var(--vscode-descriptionForeground)',
              marginBottom: '8px',
            }}>
              {impact.description}
            </div>

            {impact.files.length > 0 && (
              <div>
                <div style={{
                  fontSize: '10px',
                  color: 'var(--vscode-descriptionForeground)',
                  textTransform: 'uppercase',
                  marginBottom: '4px',
                }}>
                  Affected Files
                </div>
                {impact.files.map((file, fi) => (
                  <div
                    key={fi}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '3px 0',
                      fontSize: '11px',
                    }}
                  >
                    <button
                      onClick={() => handleOpenFile(file.path, file.line)}
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
                      Open File
                    </button>
                    <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
                      {file.path.split(/[\\/]/).pop()}:{file.line}
                    </span>
                    <code style={{
                      fontSize: '10px',
                      color: 'var(--vscode-editor-foreground)',
                      background: 'var(--vscode-textCodeBlock-background)',
                      padding: '1px 4px',
                      borderRadius: '2px',
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {file.text}
                    </code>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div style={{ flex: 1, padding: '12px', overflow: 'auto' }}>
        {impacts.length > 0 ? (
          <>
            {renderGroup('HIGH', highImpacts)}
            {renderGroup('MEDIUM', mediumImpacts)}
            {renderGroup('LOW', lowImpacts)}
          </>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--vscode-descriptionForeground)',
            fontSize: '13px',
          }}>
            Run a schematic diff first to see firmware impact analysis
          </div>
        )}
      </div>
    </div>
  );
}
