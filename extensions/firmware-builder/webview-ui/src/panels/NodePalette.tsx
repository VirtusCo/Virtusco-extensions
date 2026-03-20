// Copyright 2026 VirtusCo
// Left sidebar node palette — drag nodes onto canvas

import React, { useState } from 'react';
import { nodeDefRegistry, VirtusNodeDefUI } from '../nodes/registry';
import { useFlowStore } from '../store/flowStore';

type Category = 'peripheral' | 'composite' | 'rtos' | 'pipeline';

const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: 'peripheral', label: 'Peripherals', color: '#4fc3f7' },
  { key: 'composite', label: 'Composite', color: '#ce93d8' },
  { key: 'rtos', label: 'RTOS', color: '#81c784' },
  { key: 'pipeline', label: 'Pipeline', color: '#ff8a65' },
];

export function NodePalette() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const { boardId, supportedNodeTypes } = useFlowStore();

  const allDefs = Object.values(nodeDefRegistry);

  // Filter by board compatibility (show all if no filter set)
  const boardFiltered = supportedNodeTypes.length > 0
    ? allDefs.filter(d => supportedNodeTypes.includes(d.type))
    : allDefs;

  const { dynamicNodeDefs, zephyrVersion } = useFlowStore();

  const filteredDefs = search
    ? boardFiltered.filter(d =>
        d.label.toLowerCase().includes(search.toLowerCase()) ||
        d.type.toLowerCase().includes(search.toLowerCase())
      )
    : boardFiltered;

  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    nodes: filteredDefs.filter(d => d.category === cat.key),
  }));

  // Group dynamic nodes by subsystem
  const dynamicFiltered = search
    ? dynamicNodeDefs.filter(d =>
        d.label.toLowerCase().includes(search.toLowerCase()) ||
        d.type.toLowerCase().includes(search.toLowerCase()) ||
        ((d as Record<string, unknown>)._subsystem as string ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : dynamicNodeDefs;

  const dynamicSubsystems = new Map<string, { displayName: string; color: string; nodes: VirtusNodeDefUI[] }>();
  for (const dn of dynamicFiltered) {
    const sub = (dn as Record<string, unknown>)._subsystem as string ?? 'other';
    if (!dynamicSubsystems.has(sub)) {
      dynamicSubsystems.set(sub, {
        displayName: sub.toUpperCase(),
        color: dn.color,
        nodes: [],
      });
    }
    dynamicSubsystems.get(sub)!.nodes.push(dn);
  }

  // Register dynamic nodes so they can be dropped on canvas
  for (const dn of dynamicNodeDefs) {
    if (!nodeDefRegistry[dn.type]) {
      nodeDefRegistry[dn.type] = dn;
    }
  }

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/virtus-node-type', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      style={{
        width: 220,
        height: '100%',
        background: 'var(--vscode-sideBar-background, #252526)',
        borderRight: '1px solid var(--vscode-panel-border, #333)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '10px 12px 6px',
        borderBottom: '1px solid var(--vscode-panel-border, #333)',
      }}>
        <div style={{
          fontWeight: 600,
          fontSize: 13,
          color: 'var(--vscode-sideBarTitle-foreground, #bbb)',
        }}>
          Node Palette
        </div>
        {boardId && (
          <div style={{
            fontSize: 10,
            color: 'var(--vscode-descriptionForeground, #666)',
            marginTop: 2,
          }}>
            Board: {boardId}
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ padding: '6px 8px' }}>
        <input
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: 12,
            background: 'var(--vscode-input-background, #3c3c3c)',
            color: 'var(--vscode-input-foreground, #ccc)',
            border: '1px solid var(--vscode-input-border, #555)',
            borderRadius: 4,
            outline: 'none',
          }}
        />
      </div>

      {/* Categories */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px 8px' }}>
        {grouped.map(cat => {
          if (cat.nodes.length === 0) return null;
          const isCollapsed = collapsed[cat.key] ?? false;

          return (
            <div key={cat.key} style={{ marginBottom: 4 }}>
              {/* Category header */}
              <div
                onClick={() => setCollapsed(prev => ({ ...prev, [cat.key]: !isCollapsed }))}
                style={{
                  padding: '6px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: cat.color,
                  cursor: 'pointer',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 10 }}>{isCollapsed ? '▶' : '▼'}</span>
                {cat.label}
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  color: '#666',
                }}>
                  {cat.nodes.length}
                </span>
              </div>

              {/* Node items */}
              {!isCollapsed && cat.nodes.map(def => (
                <PaletteItem key={def.type} def={def} onDragStart={onDragStart} />
              ))}
            </div>
          );
        })}

        {/* Dynamic Zephyr API nodes (scanned from headers) */}
        {dynamicSubsystems.size > 0 && (
          <>
            <div style={{
              padding: '8px 8px 4px',
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              color: '#e6b422',
              letterSpacing: 0.5,
              borderTop: '1px solid var(--vscode-panel-border, #333)',
              marginTop: 4,
            }}>
              Zephyr API {zephyrVersion && `(v${zephyrVersion})`}
              <span style={{ float: 'right', color: '#666' }}>
                {dynamicFiltered.length}
              </span>
            </div>

            {[...dynamicSubsystems.entries()].map(([sub, data]) => {
              const isCollapsed = collapsed[`zapi_${sub}`] ?? true;
              return (
                <div key={`zapi_${sub}`} style={{ marginBottom: 2 }}>
                  <div
                    onClick={() => setCollapsed(prev => ({ ...prev, [`zapi_${sub}`]: !isCollapsed }))}
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: data.color,
                      cursor: 'pointer',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 10 }}>{isCollapsed ? '▶' : '▼'}</span>
                    {data.displayName}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#666' }}>
                      {data.nodes.length}
                    </span>
                  </div>
                  {!isCollapsed && data.nodes.map(def => (
                    <PaletteItem
                      key={def.type}
                      def={def}
                      onDragStart={onDragStart}
                      tooltip={(def as Record<string, unknown>)._brief as string}
                    />
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function PaletteItem({
  def,
  onDragStart,
  tooltip,
}: {
  def: VirtusNodeDefUI;
  onDragStart: (e: React.DragEvent, type: string) => void;
  tooltip?: string;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, def.type)}
      title={tooltip ?? def.label}
      style={{
        padding: '5px 8px 5px 20px',
        fontSize: 12,
        cursor: 'grab',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--vscode-foreground, #ccc)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: def.color,
        flexShrink: 0,
      }} />
      {def.label}
    </div>
  );
}
