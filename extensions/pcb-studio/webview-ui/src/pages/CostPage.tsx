import React from 'react';
// Copyright 2026 VirtusCo

import { useState, useCallback } from 'react';
import { vscode } from '../vscodeApi';
import { usePCBStore } from '../store/pcbStore';

export function CostPage() {
  const costEstimate = usePCBStore((s) => s.costEstimate);

  const [boardWidth, setBoardWidth] = useState(100);
  const [boardHeight, setBoardHeight] = useState(80);
  const [layers, setLayers] = useState(2);
  const [quantity, setQuantity] = useState(5);
  const [manufacturer, setManufacturer] = useState('JLCPCB');

  const handleEstimate = useCallback(() => {
    vscode.postMessage({
      type: 'estimateCost',
      boardWidth,
      boardHeight,
      layers,
      quantity,
      manufacturer,
    });
  }, [boardWidth, boardHeight, layers, quantity, manufacturer]);

  const handleExportQuote = useCallback(() => {
    if (!costEstimate) { return; }

    const csvLines: string[] = [];
    csvLines.push('Item,Unit Cost (USD),Quantity,Total (USD)');
    for (const item of costEstimate.breakdown) {
      csvLines.push(`"${item.item}",${item.unitCost.toFixed(2)},${item.qty},${item.total.toFixed(2)}`);
    }
    csvLines.push('');
    csvLines.push(`Total Per Unit,,, ${costEstimate.totalPerUnit.toFixed(2)}`);
    csvLines.push(`Batch Total (${costEstimate.quantity} units),,, ${(costEstimate.totalPerUnit * costEstimate.quantity).toFixed(2)}`);
    csvLines.push(`Manufacturer:,${costEstimate.manufacturer}`);

    vscode.postMessage({
      type: 'exportCostCSV',
      csv: csvLines.join('\n'),
    });
  }, [costEstimate]);

  return (
    <div style={{ padding: 16, overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: 16, marginBottom: 16, fontWeight: 'bold' }}>Cost Estimation</h2>

      {/* Board specs */}
      <div style={{
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: 4,
        padding: 12,
        marginBottom: 16,
      }}>
        <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>Board Specifications</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={labelStyle}>
            Width (mm):
            <input type="number" value={boardWidth} onChange={(e) => setBoardWidth(parseFloat(e.target.value) || 100)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Height (mm):
            <input type="number" value={boardHeight} onChange={(e) => setBoardHeight(parseFloat(e.target.value) || 80)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Layers:
            <select value={layers} onChange={(e) => setLayers(parseInt(e.target.value))} style={inputStyle}>
              <option value={2}>2-layer</option>
              <option value={4}>4-layer</option>
            </select>
          </label>
          <label style={labelStyle}>
            Quantity:
            <select value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value))} style={inputStyle}>
              {[5, 10, 20, 30, 50, 100, 200, 500].map((q) => (
                <option key={q} value={q}>{q} pcs</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Manufacturer:
            <select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} style={inputStyle}>
              <option value="JLCPCB">JLCPCB</option>
              <option value="PCBWay">PCBWay</option>
              <option value="OSH Park">OSH Park</option>
            </select>
          </label>
        </div>
        <button
          onClick={handleEstimate}
          style={{
            marginTop: 12,
            padding: '6px 16px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            borderRadius: 2,
          }}
        >
          Estimate Cost
        </button>
      </div>

      {/* Results */}
      {costEstimate && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 4 }}>PCB Cost</div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>${costEstimate.pcbCost.toFixed(2)}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>for {costEstimate.quantity} pcs</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 4 }}>Component Cost</div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>${costEstimate.componentCost.toFixed(2)}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>per unit</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 4 }}>Assembly</div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>${costEstimate.assemblyEstimate.toFixed(2)}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>SMT assembly</div>
            </div>
            <div style={{ ...cardStyle, borderColor: 'var(--vscode-focusBorder)' }}>
              <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 4 }}>Total Per Unit</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--vscode-charts-green)' }}>${costEstimate.totalPerUnit.toFixed(2)}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>{costEstimate.manufacturer}</div>
            </div>
          </div>

          {/* Breakdown table */}
          <div style={{
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: 4,
            marginBottom: 16,
            overflow: 'hidden',
          }}>
            <div style={{ fontWeight: 'bold', fontSize: 13, padding: '8px 12px', borderBottom: '1px solid var(--vscode-panel-border)', background: 'var(--vscode-editorGroupHeader-tabsBackground)' }}>
              Cost Breakdown
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--vscode-panel-border)', background: 'var(--vscode-editorGroupHeader-tabsBackground)' }}>
                  <th style={thStyle}>Item</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Unit Cost</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {costEstimate.breakdown.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
                    <td style={tdStyle}>{item.item}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>${item.unitCost.toFixed(2)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{item.qty}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>${item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--vscode-panel-border)' }}>
                  <td style={tdStyle} colSpan={3}>Total Per Unit</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>${costEstimate.totalPerUnit.toFixed(2)}</td>
                </tr>
                <tr style={{ fontWeight: 'bold' }}>
                  <td style={tdStyle} colSpan={3}>Batch Total ({costEstimate.quantity} units)</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>${(costEstimate.totalPerUnit * costEstimate.quantity).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <button
            onClick={handleExportQuote}
            style={{
              padding: '6px 16px',
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              borderRadius: 2,
            }}
          >
            Export Quote (CSV)
          </button>
        </>
      )}

      {!costEstimate && (
        <div style={{ padding: 20, textAlign: 'center', opacity: 0.5, fontSize: 13 }}>
          Configure board specifications and click "Estimate Cost" to see pricing.
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  padding: '4px 8px',
  fontSize: 12,
  outline: 'none',
  borderRadius: 2,
};

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: 4,
  padding: 12,
  textAlign: 'center',
};

const thStyle: React.CSSProperties = {
  padding: '6px 12px',
  textAlign: 'left',
  fontWeight: 'bold',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 12px',
};
