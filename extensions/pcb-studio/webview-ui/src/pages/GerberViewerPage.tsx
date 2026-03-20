import React from 'react';
// Copyright 2026 VirtusCo

import { useState, useMemo } from 'react';
import { vscode } from '../vscodeApi';
import { usePCBStore } from '../store/pcbStore';

interface GerberFileEntry {
  layer: string;
  filename: string;
  content: string;
}

interface ParsedAperture {
  id: number;
  shape: 'C' | 'R' | 'O';
  params: number[];
}

interface GerberCommand {
  type: 'move' | 'draw' | 'flash';
  x: number;
  y: number;
  aperture: number;
}

const LAYER_COLORS: Record<string, string> = {
  'F.Cu': '#ff0000',
  'B.Cu': '#0000ff',
  'In1.Cu': '#00cc00',
  'In2.Cu': '#cc8800',
  'F.SilkS': '#ffff00',
  'B.SilkS': '#00ffff',
  'Edge.Cuts': '#ffffff',
  'F.Mask': '#800080',
  'B.Mask': '#008080',
  'F.Paste': '#ff8800',
  'B.Paste': '#0088ff',
};

function parseGerber(content: string): { apertures: ParsedAperture[]; commands: GerberCommand[] } {
  const apertures: ParsedAperture[] = [];
  const commands: GerberCommand[] = [];
  let currentAperture = 10;
  let cx = 0;
  let cy = 0;

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Aperture definition: %ADD10C,0.200*%
    const apMatch = trimmed.match(/^%ADD(\d+)([CRO]),(.+)\*%$/);
    if (apMatch) {
      const id = parseInt(apMatch[1]);
      const shape = apMatch[2] as 'C' | 'R' | 'O';
      const params = apMatch[3].split('X').map(Number);
      apertures.push({ id, shape, params });
      continue;
    }

    // Select aperture: D10*
    const selMatch = trimmed.match(/^D(\d+)\*$/);
    if (selMatch) {
      const d = parseInt(selMatch[1]);
      if (d >= 10) {
        currentAperture = d;
      }
      continue;
    }

    // Coordinate command: X100000Y200000D01*
    const cmdMatch = trimmed.match(/^X(-?\d+)Y(-?\d+)(D0[123])\*$/);
    if (cmdMatch) {
      const x = parseInt(cmdMatch[1]) / 1000000;
      const y = parseInt(cmdMatch[2]) / 1000000;
      const d = cmdMatch[3];

      if (d === 'D02') {
        commands.push({ type: 'move', x, y, aperture: currentAperture });
      } else if (d === 'D01') {
        commands.push({ type: 'draw', x, y, aperture: currentAperture });
      } else if (d === 'D03') {
        commands.push({ type: 'flash', x, y, aperture: currentAperture });
      }
      cx = x;
      cy = y;
    }
  }

  return { apertures, commands };
}

function renderGerberToSvg(
  parsed: { apertures: ParsedAperture[]; commands: GerberCommand[] },
  color: string,
  scale: number,
  offsetX: number,
  offsetY: number,
): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const apMap = new Map<number, ParsedAperture>();
  for (const ap of parsed.apertures) {
    apMap.set(ap.id, ap);
  }

  let lastX = 0;
  let lastY = 0;

  for (let i = 0; i < parsed.commands.length; i++) {
    const cmd = parsed.commands[i];
    const sx = cmd.x * scale + offsetX;
    const sy = cmd.y * scale + offsetY;
    const ap = apMap.get(cmd.aperture);

    if (cmd.type === 'move') {
      lastX = sx;
      lastY = sy;
    } else if (cmd.type === 'draw') {
      const width = ap ? ap.params[0] * scale : 1;
      elements.push(
        <line
          key={`l_${i}`}
          x1={lastX}
          y1={lastY}
          x2={sx}
          y2={sy}
          stroke={color}
          strokeWidth={Math.max(width, 0.5)}
          strokeLinecap="round"
        />
      );
      lastX = sx;
      lastY = sy;
    } else if (cmd.type === 'flash') {
      if (ap) {
        if (ap.shape === 'C') {
          const r = ap.params[0] * scale / 2;
          elements.push(
            <circle key={`f_${i}`} cx={sx} cy={sy} r={Math.max(r, 0.5)} fill={color} />
          );
        } else if (ap.shape === 'R') {
          const w = ap.params[0] * scale;
          const h = (ap.params[1] || ap.params[0]) * scale;
          elements.push(
            <rect key={`f_${i}`} x={sx - w / 2} y={sy - h / 2} width={Math.max(w, 0.5)} height={Math.max(h, 0.5)} fill={color} />
          );
        } else if (ap.shape === 'O') {
          const w = ap.params[0] * scale;
          const h = (ap.params[1] || ap.params[0]) * scale;
          elements.push(
            <rect key={`f_${i}`} x={sx - w / 2} y={sy - h / 2} width={Math.max(w, 0.5)} height={Math.max(h, 0.5)} fill={color} rx={Math.min(w, h) / 4} />
          );
        }
      }
      lastX = sx;
      lastY = sy;
    }
  }

  return elements;
}

export function GerberViewerPage() {
  const gerberFiles = usePCBStore((s) => s.gerberFiles);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());

  const files: GerberFileEntry[] = gerberFiles;

  const selectedData = useMemo(() => {
    if (!selectedFile) { return null; }
    const file = files.find((f) => f.filename === selectedFile);
    if (!file) { return null; }
    return { file, parsed: parseGerber(file.content) };
  }, [selectedFile, files]);

  const overlayParsed = useMemo(() => {
    const results: { layer: string; parsed: ReturnType<typeof parseGerber> }[] = [];
    for (const file of files) {
      if (visibleLayers.has(file.layer)) {
        results.push({ layer: file.layer, parsed: parseGerber(file.content) });
      }
    }
    return results;
  }, [visibleLayers, files]);

  const handleExportAll = () => {
    vscode.postMessage({ type: 'exportGerberFiles', files: gerberFiles });
  };

  const toggleLayer = (layer: string) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  };

  const scale = 4;
  const offsetX = 20;
  const offsetY = 20;

  if (files.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
        <div style={{ fontSize: 16, marginBottom: 12 }}>No Gerber files generated</div>
        <div style={{ fontSize: 12 }}>Use the PCB Layout page to design a board, then click "Export Gerber" to generate files.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: file list + layer toggles */}
      <div style={{
        width: 220,
        borderRight: '1px solid var(--vscode-panel-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}>
        <div style={{ padding: '6px 8px', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid var(--vscode-panel-border)' }}>
          Generated Files ({files.length})
        </div>
        {files.map((file) => (
          <div
            key={file.filename}
            onClick={() => setSelectedFile(file.filename)}
            style={{
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '11px',
              background: selectedFile === file.filename ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
              color: selectedFile === file.filename ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 2, background: LAYER_COLORS[file.layer] || '#888', flexShrink: 0 }} />
            <div>
              <div>{file.filename}</div>
              <div style={{ fontSize: '10px', opacity: 0.7 }}>{file.layer}</div>
            </div>
          </div>
        ))}

        <div style={{ padding: '6px 8px', fontWeight: 'bold', fontSize: '11px', borderTop: '1px solid var(--vscode-panel-border)', borderBottom: '1px solid var(--vscode-panel-border)', marginTop: 8 }}>
          Overlay Layers
        </div>
        {files.map((file) => (
          <label
            key={`ov_${file.filename}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={visibleLayers.has(file.layer)}
              onChange={() => toggleLayer(file.layer)}
            />
            <div style={{ width: 8, height: 8, borderRadius: 2, background: LAYER_COLORS[file.layer] || '#888' }} />
            {file.layer}
          </label>
        ))}

        <div style={{ padding: 8, marginTop: 'auto' }}>
          <button
            onClick={handleExportAll}
            style={{
              width: '100%',
              padding: '6px 12px',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              borderRadius: 2,
            }}
          >
            Export All
          </button>
        </div>
      </div>

      {/* Right: SVG renderer */}
      <div style={{ flex: 1, overflow: 'auto', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="100%" height="100%" viewBox="0 0 600 500" style={{ maxWidth: '100%', maxHeight: '100%' }}>
          {/* Background */}
          <rect width="600" height="500" fill="#0a0a1a" />

          {/* Overlay layers */}
          {overlayParsed.map((entry) => (
            <g key={entry.layer} opacity={0.6}>
              {renderGerberToSvg(entry.parsed, LAYER_COLORS[entry.layer] || '#888', scale, offsetX, offsetY)}
            </g>
          ))}

          {/* Selected file (on top, full opacity) */}
          {selectedData && (
            <g>
              {renderGerberToSvg(selectedData.parsed, LAYER_COLORS[selectedData.file.layer] || '#fff', scale, offsetX, offsetY)}
            </g>
          )}

          {/* Info text */}
          {selectedData && (
            <text x={10} y={490} fill="var(--vscode-descriptionForeground)" fontSize={10}>
              {selectedData.file.filename} | {selectedData.parsed.commands.length} commands | {selectedData.parsed.apertures.length} apertures
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
