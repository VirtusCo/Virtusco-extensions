// Copyright 2026 VirtusCo

import { usePCBStore } from '../store/pcbStore';
import { vscode } from '../vscodeApi';

export function BOMPage() {
  const entries = usePCBStore((s) => s.bomEntries);

  const totalComponents = entries.reduce((sum, e) => sum + e.quantity, 0);
  const uniqueParts = entries.length;
  const lcscCoverage = entries.filter((e) => e.lcsc_part).length;

  const handleExportCSV = () => {
    vscode.postMessage({ type: 'exportBOM', format: 'csv' });
  };

  const handleOpenLCSC = (partNumber: string) => {
    vscode.postMessage({
      type: 'openExternal',
      url: `https://www.lcsc.com/search?q=${encodeURIComponent(partNumber)}`,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--vscode-panel-border)',
        background: 'var(--vscode-editorWidget-background)',
      }}>
        <div style={{ display: 'flex', gap: '24px', fontSize: '12px' }}>
          <span>Total: <strong style={{ color: 'var(--vscode-charts-blue)' }}>{totalComponents}</strong></span>
          <span>Unique: <strong style={{ color: 'var(--vscode-charts-green)' }}>{uniqueParts}</strong></span>
          <span>LCSC: <strong style={{ color: 'var(--vscode-charts-yellow)' }}>{lcscCoverage}/{uniqueParts}</strong></span>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={entries.length === 0}
          style={{
            padding: '4px 12px',
            background: entries.length > 0 ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
            color: entries.length > 0 ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            borderRadius: '2px',
            cursor: entries.length > 0 ? 'pointer' : 'default',
            fontSize: '12px',
          }}
        >
          Export CSV
        </button>
      </div>

      {/* BOM table */}
      {entries.length > 0 ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>Reference</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>Value</th>
                <th style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>Qty</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>Footprint</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>LCSC</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid var(--vscode-panel-border)',
                  }}
                >
                  <td style={{ padding: '6px 8px', color: 'var(--vscode-charts-blue)' }}>{entry.reference}</td>
                  <td style={{ padding: '6px 8px' }}>{entry.value}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>{entry.quantity}</td>
                  <td style={{ padding: '6px 8px', fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
                    {entry.footprint || '-'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {entry.lcsc_part ? (
                      <button
                        onClick={() => handleOpenLCSC(entry.lcsc_part)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--vscode-textLink-foreground)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontSize: '12px',
                          padding: 0,
                        }}
                      >
                        {entry.lcsc_part}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--vscode-descriptionForeground)' }}>-</span>
                    )}
                  </td>
                </tr>
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
          Load a schematic to view the Bill of Materials
        </div>
      )}
    </div>
  );
}
