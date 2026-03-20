// Copyright 2026 VirtusCo

import { useState } from 'react';
import { usePCBStore } from '../store/pcbStore';
import { SchematicSVG } from '../components/SchematicSVG';
import { vscode } from '../vscodeApi';

export function SchematicPage() {
  const svg = usePCBStore((s) => s.schematicSvg);
  const stats = usePCBStore((s) => s.schematicStats);
  const [filePath, setFilePath] = useState('');

  const handleLoad = () => {
    if (filePath.trim()) {
      vscode.postMessage({ type: 'loadSchematic', path: filePath.trim() });
    } else {
      vscode.postMessage({ type: 'loadSchematic', path: '' });
    }
  };

  const handleNetClick = (netName: string) => {
    console.log('Net clicked:', netName);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderBottom: '1px solid var(--vscode-panel-border)',
        background: 'var(--vscode-editorWidget-background)',
      }}>
        <input
          type="text"
          placeholder="Path to .kicad_sch file..."
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          style={{
            flex: 1,
            padding: '4px 8px',
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border)',
            borderRadius: '2px',
            fontFamily: 'var(--vscode-font-family)',
            fontSize: '12px',
          }}
        />
        <button
          onClick={handleLoad}
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
          Load Schematic
        </button>
      </div>

      {/* Stats bar */}
      {svg && (
        <div style={{
          display: 'flex',
          gap: '24px',
          padding: '6px 12px',
          borderBottom: '1px solid var(--vscode-panel-border)',
          fontSize: '11px',
          color: 'var(--vscode-descriptionForeground)',
        }}>
          <span>Components: <strong style={{ color: 'var(--vscode-charts-blue)' }}>{stats.components}</strong></span>
          <span>Nets: <strong style={{ color: 'var(--vscode-charts-green)' }}>{stats.nets}</strong></span>
          <span>Sheets: <strong style={{ color: 'var(--vscode-charts-yellow)' }}>{stats.sheets}</strong></span>
        </div>
      )}

      {/* SVG viewer */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {svg ? (
          <SchematicSVG svg={svg} onNetClick={handleNetClick} />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--vscode-descriptionForeground)',
            fontSize: '14px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>PCB</div>
              <div>No schematic loaded</div>
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                Click "Load Schematic" or use the sidebar to open a .kicad_sch file
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
