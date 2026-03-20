// Copyright 2026 VirtusCo
// Bridge debugger page — ESP32 serial frame decoder with hex + field views

import React, { useState, useRef, useEffect } from 'react';
import { useRos2Store, DecodedFrame } from '../store/ros2Store';
import { vscode } from '../vscodeApi';

export function BridgeDebuggerPage(): React.ReactElement {
  const bridgeFrames = useRos2Store((s) => s.bridgeFrames);
  const clearBridgeFrames = useRos2Store((s) => s.clearBridgeFrames);

  const [port, setPort] = useState('/dev/ttyUSB0');
  const [baud, setBaud] = useState(115200);
  const [connected, setConnected] = useState(false);
  const frameListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest frame
  useEffect(() => {
    if (frameListRef.current) {
      frameListRef.current.scrollTop = frameListRef.current.scrollHeight;
    }
  }, [bridgeFrames]);

  const handleConnect = () => {
    if (connected) {
      vscode.postMessage({ type: 'disconnectBridge' });
      setConnected(false);
    } else {
      vscode.postMessage({ type: 'connectBridge', port, baud });
      setConnected(true);
    }
  };

  const handleClear = () => {
    clearBridgeFrames();
  };

  return (
    <div style={{ padding: '12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        flexShrink: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Bridge Debugger</h2>
        <span style={{
          fontSize: '11px',
          color: connected ? '#4caf50' : 'var(--vscode-descriptionForeground)',
        }}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Connection Controls */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        marginBottom: '12px',
        flexShrink: 0,
      }}>
        <input
          type="text"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          placeholder="Serial port"
          disabled={connected}
          style={{
            flex: 1,
            padding: '4px 8px',
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border, #444)',
            borderRadius: '3px',
            fontSize: '12px',
          }}
        />
        <input
          type="number"
          value={baud}
          onChange={(e) => setBaud(parseInt(e.target.value) || 115200)}
          placeholder="Baud"
          disabled={connected}
          style={{
            width: '80px',
            padding: '4px 8px',
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border, #444)',
            borderRadius: '3px',
            fontSize: '12px',
          }}
        />
        <button
          onClick={handleConnect}
          style={{
            padding: '4px 12px',
            background: connected ? '#f44336' : 'var(--vscode-button-background)',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>
        <button
          onClick={handleClear}
          style={{
            padding: '4px 12px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Clear
        </button>
      </div>

      {/* Frame counter */}
      <div style={{
        fontSize: '11px',
        color: 'var(--vscode-descriptionForeground)',
        marginBottom: '8px',
        flexShrink: 0,
      }}>
        {bridgeFrames.length} frames (max 200)
      </div>

      {/* Frame List */}
      <div
        ref={frameListRef}
        style={{
          flex: 1,
          overflow: 'auto',
          border: '1px solid var(--vscode-panel-border, #333)',
          borderRadius: '4px',
        }}
      >
        {bridgeFrames.length === 0 ? (
          <div style={{
            padding: '32px',
            textAlign: 'center',
            color: 'var(--vscode-descriptionForeground)',
          }}>
            No frames received. Connect to an ESP32 to see frames.
          </div>
        ) : (
          bridgeFrames.map((frame, idx) => (
            <FrameRow key={idx} frame={frame} index={idx} />
          ))
        )}
      </div>
    </div>
  );
}

function FrameRow({ frame, index }: { frame: DecodedFrame; index: number }): React.ReactElement {
  const isError = frame.msg_name === 'ERROR_FRAME';

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      padding: '6px 10px',
      borderBottom: '1px solid var(--vscode-panel-border, #2a2a2a)',
      background: isError ? '#b71c1c20' : 'transparent',
      fontSize: '11px',
    }}>
      {/* Index */}
      <span style={{
        color: 'var(--vscode-descriptionForeground)',
        minWidth: '30px',
        textAlign: 'right',
      }}>
        #{index}
      </span>

      {/* Hex */}
      <div style={{
        flex: 1,
        fontFamily: 'var(--vscode-editor-font-family, monospace)',
        fontSize: '10px',
        color: isError ? '#f44336' : 'var(--vscode-descriptionForeground)',
        wordBreak: 'break-all',
      }}>
        {frame.raw_hex}
      </div>

      {/* Decoded */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontWeight: 600,
          marginBottom: '2px',
          color: isError ? '#f44336' : 'var(--vscode-foreground)',
        }}>
          {frame.msg_name}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {frame.fields.map((f, i) => (
            <span key={i} style={{ color: 'var(--vscode-descriptionForeground)' }}>
              <span style={{ color: 'var(--vscode-textLink-foreground)' }}>{f.name}</span>
              ={f.value}{f.unit ? ` ${f.unit}` : ''}
            </span>
          ))}
        </div>
      </div>

      {/* CRC */}
      <span style={{
        color: frame.crc_valid ? '#4caf50' : '#f44336',
        fontWeight: 600,
        minWidth: '20px',
        textAlign: 'center',
      }}>
        {frame.crc_valid ? 'OK' : 'ERR'}
      </span>
    </div>
  );
}
