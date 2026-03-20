// Copyright 2026 VirtusCo

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const CATEGORY_COLORS: Record<string, string> = {
  Passive: '#888888',
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

interface BuilderNodeData {
  component: {
    id: string;
    type: string;
    name: string;
    value: string;
    pins: { id: string; name: string; dir: 'in' | 'out' | 'bidir' }[];
  };
  [key: string]: unknown;
}

function BuilderNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as BuilderNodeData;
  const component = nodeData?.component;
  if (!component) {
    return <div style={{ padding: 8, background: '#f44', color: '#fff', borderRadius: 4, fontSize: 11 }}>
      No component data
    </div>;
  }
  const category = getCategoryForType(component.type);
  const borderColor = CATEGORY_COLORS[category] || '#888';

  const inputPins = component.pins.filter((p) => p.dir === 'in' || p.dir === 'bidir');
  const outputPins = component.pins.filter((p) => p.dir === 'out' || p.dir === 'bidir');

  // Remove duplicates that appear in both (bidir pins appear in both lists)
  // We want bidir on both sides, which is correct — handles will be on both sides.

  const maxPins = Math.max(inputPins.length, outputPins.length, 1);
  const nodeHeight = Math.max(maxPins * 22 + 40, 60);

  return (
    <div style={{
      background: 'var(--vscode-editor-background, #1e1e1e)',
      border: `2px solid ${borderColor}`,
      borderRadius: '6px',
      minWidth: '140px',
      fontSize: '11px',
      fontFamily: 'var(--vscode-font-family, monospace)',
      color: 'var(--vscode-editor-foreground, #d4d4d4)',
    }}>
      {/* Header */}
      <div style={{
        padding: '4px 8px',
        background: `${borderColor}33`,
        borderBottom: `1px solid ${borderColor}`,
        borderRadius: '4px 4px 0 0',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '10px',
      }}>
        <div style={{ color: borderColor }}>{component.name}</div>
        <div style={{ fontSize: '9px', color: 'var(--vscode-descriptionForeground, #888)' }}>
          {component.value}
        </div>
      </div>

      {/* Pins */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 0',
        minHeight: `${nodeHeight - 40}px`,
      }}>
        {/* Left pins (input) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {inputPins.map((pin, idx) => (
            <div
              key={`in-${pin.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px 2px 0',
                position: 'relative',
              }}
            >
              <Handle
                type="target"
                position={Position.Left}
                id={`${component.id}-${pin.id}`}
                style={{
                  width: '8px',
                  height: '8px',
                  background: pin.dir === 'bidir' ? '#2196f3' : '#4caf50',
                  border: 'none',
                  left: '-4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <span style={{
                fontSize: '9px',
                marginLeft: '8px',
                color: pin.dir === 'bidir' ? '#2196f3' : '#4caf50',
              }}>
                {pin.name}
              </span>
            </div>
          ))}
        </div>

        {/* Right pins (output) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
          {outputPins.map((pin, idx) => (
            <div
              key={`out-${pin.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 0 2px 8px',
                position: 'relative',
              }}
            >
              <span style={{
                fontSize: '9px',
                marginRight: '8px',
                color: pin.dir === 'bidir' ? '#2196f3' : '#f44336',
              }}>
                {pin.name}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`${component.id}-${pin.id}`}
                style={{
                  width: '8px',
                  height: '8px',
                  background: pin.dir === 'bidir' ? '#2196f3' : '#f44336',
                  border: 'none',
                  right: '-4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const BuilderNode = memo(BuilderNodeComponent);
