// Copyright 2026 VirtusCo

import { useState, useMemo } from 'react';
import { usePCBStore, BuilderComponent } from '../store/pcbStore';

const CATEGORY_ORDER = ['Passive', 'IC', 'Sensor', 'Power', 'Connector'];

const CATEGORY_COLORS: Record<string, string> = {
  Passive: '#888',
  IC: '#569cd6',
  Sensor: '#4caf50',
  Power: '#ff9800',
  Connector: '#9c27b0',
};

function getCategoryForType(type: string): string {
  const map: Record<string, string> = {
    'Resistor': 'Passive',
    'Capacitor': 'Passive',
    'Diode': 'Passive',
    'LED': 'Passive',
    'BTS7960': 'IC',
    'ESP32-WROOM': 'IC',
    'Arduino Nano': 'IC',
    'VL53L0X': 'Sensor',
    'HC-SR04': 'Sensor',
    'RCWL-0516': 'Sensor',
    'LM7805': 'Power',
    'AMS1117-3.3': 'Power',
    'Relay Module': 'Power',
    'USB-C': 'Connector',
  };
  return map[type] || 'Other';
}

export function ComponentsPage() {
  const library = usePCBStore((s) => s.builderLibrary);
  const addBuilderComponent = usePCBStore((s) => s.addBuilderComponent);
  const setActivePage = usePCBStore((s) => s.setActivePage);
  const [selectedComp, setSelectedComp] = useState<BuilderComponent | null>(null);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, BuilderComponent[]> = {};
    for (const comp of library) {
      const cat = getCategoryForType(comp.type);
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(comp);
    }
    return groups;
  }, [library]);

  const handleAddToBuilder = (comp: BuilderComponent) => {
    addBuilderComponent({
      ...comp,
      id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      position: { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 },
    });
    setActivePage('builder');
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left: component list */}
      <div style={{
        width: '300px',
        borderRight: '1px solid var(--vscode-panel-border)',
        overflow: 'auto',
        flexShrink: 0,
      }}>
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (!items) {
            return null;
          }
          return (
            <div key={cat}>
              <div style={{
                padding: '8px 12px',
                fontSize: '11px',
                fontWeight: 'bold',
                color: CATEGORY_COLORS[cat],
                textTransform: 'uppercase',
                background: 'var(--vscode-editorWidget-background)',
                borderBottom: '1px solid var(--vscode-panel-border)',
              }}>
                {cat}
              </div>
              {items.map((comp) => (
                <button
                  key={comp.type}
                  onClick={() => setSelectedComp(comp)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    borderBottom: '1px solid var(--vscode-panel-border)',
                    background: selectedComp?.type === comp.type
                      ? 'var(--vscode-list-activeSelectionBackground)'
                      : 'transparent',
                    color: selectedComp?.type === comp.type
                      ? 'var(--vscode-list-activeSelectionForeground)'
                      : 'var(--vscode-foreground)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--vscode-font-family)',
                    fontSize: '12px',
                  }}
                >
                  <span>{comp.name}</span>
                  <span style={{
                    fontSize: '10px',
                    color: 'var(--vscode-descriptionForeground)',
                  }}>
                    {comp.pins.length} pins
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Right: component detail */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {selectedComp ? (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '16px',
            }}>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: '18px',
                  color: 'var(--vscode-editor-foreground)',
                }}>
                  {selectedComp.name}
                </h2>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--vscode-descriptionForeground)',
                  marginTop: '4px',
                }}>
                  Category: {getCategoryForType(selectedComp.type)} | {selectedComp.pins.length} pins
                </div>
              </div>
              <button
                onClick={() => handleAddToBuilder(selectedComp)}
                style={{
                  padding: '6px 14px',
                  background: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Add to Builder
              </button>
            </div>

            {/* Pinout diagram */}
            <div style={{
              padding: '16px',
              background: 'var(--vscode-editorWidget-background)',
              borderRadius: '8px',
              border: '1px solid var(--vscode-panel-border)',
              marginBottom: '16px',
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--vscode-descriptionForeground)',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}>
                Pinout
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '4px',
              }}>
                {/* Left pins (input) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  {selectedComp.pins
                    .filter((p) => p.dir === 'in' || p.dir === 'bidir')
                    .map((pin) => (
                      <div key={pin.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                      }}>
                        <span style={{ color: 'var(--vscode-descriptionForeground)' }}>{pin.name}</span>
                        <div style={{
                          width: '20px',
                          height: '2px',
                          background: pin.dir === 'in' ? '#4caf50' : '#2196f3',
                        }} />
                      </div>
                    ))}
                </div>

                {/* IC body */}
                <div style={{
                  minWidth: '80px',
                  minHeight: `${Math.max(selectedComp.pins.length * 12, 40)}px`,
                  border: `2px solid ${CATEGORY_COLORS[getCategoryForType(selectedComp.type)]}`,
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: CATEGORY_COLORS[getCategoryForType(selectedComp.type)],
                }}>
                  {selectedComp.type}
                </div>

                {/* Right pins (output) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                  {selectedComp.pins
                    .filter((p) => p.dir === 'out' || p.dir === 'bidir')
                    .map((pin) => (
                      <div key={`r-${pin.id}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                      }}>
                        <div style={{
                          width: '20px',
                          height: '2px',
                          background: pin.dir === 'out' ? '#f44336' : '#2196f3',
                        }} />
                        <span style={{ color: 'var(--vscode-descriptionForeground)' }}>{pin.name}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Pin table */}
            <div style={{
              padding: '12px',
              background: 'var(--vscode-editorWidget-background)',
              borderRadius: '8px',
              border: '1px solid var(--vscode-panel-border)',
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--vscode-descriptionForeground)',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}>
                Pin Details
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
                    <th style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>ID</th>
                    <th style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>Name</th>
                    <th style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--vscode-descriptionForeground)' }}>Direction</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedComp.pins.map((pin) => (
                    <tr key={pin.id} style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
                      <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{pin.id}</td>
                      <td style={{ padding: '4px 8px' }}>{pin.name}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: '8px',
                          fontSize: '10px',
                          background: pin.dir === 'in' ? '#4caf5033' : pin.dir === 'out' ? '#f4433633' : '#2196f333',
                          color: pin.dir === 'in' ? '#4caf50' : pin.dir === 'out' ? '#f44336' : '#2196f3',
                        }}>
                          {pin.dir}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--vscode-descriptionForeground)',
            fontSize: '13px',
          }}>
            Select a component from the list to view its details and pinout
          </div>
        )}
      </div>
    </div>
  );
}
