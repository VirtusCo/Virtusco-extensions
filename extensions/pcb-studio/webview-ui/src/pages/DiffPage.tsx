// Copyright 2026 VirtusCo

import { useState } from 'react';
import { usePCBStore } from '../store/pcbStore';
import { vscode } from '../vscodeApi';

export function DiffPage() {
  const diff = usePCBStore((s) => s.diffResult);
  const impacts = usePCBStore((s) => s.impactResults);
  const setActivePage = usePCBStore((s) => s.setActivePage);
  const [expandNoImpact, setExpandNoImpact] = useState(false);

  const handleRunDiff = () => {
    vscode.postMessage({ type: 'runDiff', oldRef: 'HEAD~1', newRef: 'HEAD' });
  };

  const hasImpact = (changeName: string) => {
    return impacts.some((imp) => imp.change.includes(changeName));
  };

  interface DiffItem {
    type: 'added' | 'removed' | 'renamed' | 'moved';
    label: string;
    detail: string;
    key: string;
  }

  const items: DiffItem[] = [];

  if (diff) {
    for (const net of diff.nets_added) {
      items.push({ type: 'added', label: `Net: ${net}`, detail: 'New net added', key: `na-${net}` });
    }
    for (const net of diff.nets_removed) {
      items.push({ type: 'removed', label: `Net: ${net}`, detail: 'Net removed', key: `nr-${net}` });
    }
    for (const rn of diff.nets_renamed) {
      items.push({ type: 'renamed', label: `Net: ${rn.old_name}`, detail: `Renamed to ${rn.new_name}`, key: `rn-${rn.old_name}` });
    }
    for (const comp of diff.components_added) {
      items.push({ type: 'added', label: `Component: ${comp.reference}`, detail: `${comp.value} added`, key: `ca-${comp.reference}` });
    }
    for (const comp of diff.components_removed) {
      items.push({ type: 'removed', label: `Component: ${comp.reference}`, detail: `${comp.value} removed`, key: `cr-${comp.reference}` });
    }
    for (const pin of diff.pins_moved) {
      items.push({ type: 'moved', label: `Pin: ${pin.reference}.${pin.pin}`, detail: `Moved from (${pin.from.x},${pin.from.y}) to (${pin.to.x},${pin.to.y})`, key: `pm-${pin.reference}-${pin.pin}` });
    }
  }

  const badgeColors: Record<string, string> = {
    added: '#4caf50',
    removed: '#f44336',
    renamed: '#2196f3',
    moved: '#ff9800',
  };

  const itemsWithImpact = items.filter((item) => hasImpact(item.label.split(': ')[1]));
  const itemsWithoutImpact = items.filter((item) => !hasImpact(item.label.split(': ')[1]));

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
          onClick={handleRunDiff}
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
          Run Diff
        </button>
        <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
          HEAD~1 vs HEAD
        </span>
      </div>

      {items.length > 0 ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {/* Changes with firmware impact */}
          {itemsWithImpact.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--vscode-descriptionForeground)',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}>
                Changes with firmware impact ({itemsWithImpact.length})
              </div>
              {itemsWithImpact.map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    borderBottom: '1px solid var(--vscode-panel-border)',
                  }}
                >
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: '#fff',
                    background: badgeColors[item.type],
                  }}>
                    {item.type.toUpperCase()}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>{item.detail}</span>
                  <button
                    onClick={() => setActivePage('impact')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--vscode-textLink-foreground)',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    View Impact
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Changes without firmware impact */}
          {itemsWithoutImpact.length > 0 && (
            <div>
              <button
                onClick={() => setExpandNoImpact(!expandNoImpact)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--vscode-descriptionForeground)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                  padding: 0,
                }}
              >
                {expandNoImpact ? 'v' : '>'} No firmware impact ({itemsWithoutImpact.length})
              </button>
              {expandNoImpact && itemsWithoutImpact.map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    borderBottom: '1px solid var(--vscode-panel-border)',
                    opacity: 0.7,
                  }}
                >
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: '#fff',
                    background: badgeColors[item.type],
                  }}>
                    {item.type.toUpperCase()}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>{item.detail}</span>
                </div>
              ))}
            </div>
          )}
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
          Click "Run Diff" to compare schematic versions
        </div>
      )}
    </div>
  );
}
