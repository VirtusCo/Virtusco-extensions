// Copyright 2026 VirtusCo
// Custom React Flow node component for all Virtus node types

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { nodeDefRegistry } from '../nodes/registry';

interface VirtusNodeData {
  label: string;
  nodeType: string;
  icon: string;
  color: string;
  category: string;
  config: Record<string, unknown>;
  [key: string]: unknown;
}

const categoryBadge: Record<string, string> = {
  peripheral: 'HW',
  rtos: 'OS',
  composite: 'CMP',
  pipeline: 'CMD',
};

export const VirtusNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as VirtusNodeData;
  const def = nodeDefRegistry[nodeData.nodeType];
  const inputs = def?.inputs ?? [];
  const outputs = def?.outputs ?? [];
  const color = nodeData.color || '#555';
  const configAlias = (nodeData.config?.alias || nodeData.config?.name || '') as string;

  return (
    <div
      style={{
        minWidth: 160,
        background: 'var(--vscode-editor-background, #252526)',
        border: `2px solid ${selected ? '#0e639c' : color}`,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: selected ? `0 0 8px ${color}66` : '0 2px 6px rgba(0,0,0,0.3)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: color,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: '#fff',
        }}
      >
        <span style={{
          fontSize: 9,
          background: 'rgba(0,0,0,0.3)',
          padding: '1px 4px',
          borderRadius: 3,
        }}>
          {categoryBadge[nodeData.category] ?? '?'}
        </span>
        <span style={{ flex: 1 }}>{nodeData.label}</span>
      </div>

      {/* Body */}
      <div style={{ padding: '6px 10px', fontSize: 11 }}>
        {configAlias && (
          <div style={{
            color: 'var(--vscode-descriptionForeground, #888)',
            fontStyle: 'italic',
            marginBottom: 4,
          }}>
            {configAlias}
          </div>
        )}

        {/* Input handles */}
        {inputs.map((port) => (
          <div key={port.id} style={{ position: 'relative', paddingLeft: 14, marginBottom: 3 }}
            title={`${port.label} (${port.type}) — connects to ${port.type} outputs only`}>
            <Handle
              type="target"
              position={Position.Left}
              id={port.id}
              style={{
                width: 10,
                height: 10,
                background: portColor(port.type),
                border: `2px solid ${portBorderColor(port.type)}`,
                borderRadius: port.type === 'signal' ? '50%' : port.type === 'data' ? 2 : '50%',
                left: -5,
                top: '50%',
              }}
            />
            <span style={{ color: '#aaa', fontSize: 10 }}>
              {port.label}
              <span style={{ color: portColor(port.type), marginLeft: 3, fontSize: 8 }}>
                {portTypeSymbol(port.type)}
              </span>
            </span>
          </div>
        ))}

        {/* Output handles */}
        {outputs.map((port) => (
          <div key={port.id} style={{
            position: 'relative',
            paddingRight: 14,
            textAlign: 'right',
            marginBottom: 3,
          }}
            title={`${port.label} (${port.type}) — connects to ${port.type} inputs only`}>
            <Handle
              type="source"
              position={Position.Right}
              id={port.id}
              style={{
                width: 10,
                height: 10,
                background: portColor(port.type),
                border: `2px solid ${portBorderColor(port.type)}`,
                borderRadius: port.type === 'signal' ? '50%' : port.type === 'data' ? 2 : '50%',
                right: -5,
                top: '50%',
              }}
            />
            <span style={{ color: '#aaa', fontSize: 10 }}>
              <span style={{ color: portColor(port.type), marginRight: 3, fontSize: 8 }}>
                {portTypeSymbol(port.type)}
              </span>
              {port.label}
            </span>
          </div>
        ))}

        {inputs.length === 0 && outputs.length === 0 && (
          <div style={{ color: '#666', fontSize: 10 }}>No ports</div>
        )}
      </div>
    </div>
  );
});

VirtusNode.displayName = 'VirtusNode';

function portColor(type: string): string {
  switch (type) {
    case 'signal': return '#4fc3f7';  // blue — digital signals
    case 'data': return '#81c784';    // green — data streams
    case 'power': return '#ff8a65';   // orange — power lines
    default: return '#999';
  }
}

function portBorderColor(type: string): string {
  switch (type) {
    case 'signal': return '#0288d1';
    case 'data': return '#388e3c';
    case 'power': return '#e64a19';
    default: return '#666';
  }
}

function portTypeSymbol(type: string): string {
  switch (type) {
    case 'signal': return '◆';  // diamond for signals
    case 'data': return '■';    // square for data
    case 'power': return '●';   // circle for power
    default: return '○';
  }
}
