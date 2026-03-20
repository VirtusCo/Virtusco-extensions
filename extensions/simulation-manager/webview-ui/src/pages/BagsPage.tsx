// Copyright 2026 VirtusCo
// Bag recording, playback, and file management page

import React, { useState, useEffect } from 'react';
import { useSimStore } from '../store/simStore';
import { vscode } from '../vscodeApi';

const PRESETS = [
  { id: 'all', label: 'All Topics' },
  { id: 'nav2_debug', label: 'Nav2 Debug' },
  { id: 'sensor_fusion', label: 'Sensor Fusion' },
  { id: 'ai_interaction', label: 'AI Interaction' },
];

const RATES = [0.5, 1, 2];

export default function BagsPage(): React.ReactElement {
  const bagFiles = useSimStore((s) => s.bagFiles);
  const recording = useSimStore((s) => s.recording);
  const recordingElapsed = useSimStore((s) => s.recordingElapsed);
  const [selectedPreset, setSelectedPreset] = useState('all');
  const [bagName, setBagName] = useState('');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [displayElapsed, setDisplayElapsed] = useState(0);

  useEffect(() => {
    if (recording) {
      const interval = setInterval(() => {
        setDisplayElapsed((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setDisplayElapsed(0);
    }
  }, [recording]);

  useEffect(() => {
    if (recordingElapsed > 0) {
      setDisplayElapsed(recordingElapsed);
    }
  }, [recordingElapsed]);

  const handleRecord = () => {
    const name = bagName.trim() || `porter_bag_${Date.now()}`;
    vscode.postMessage({ type: 'recordBag', preset: selectedPreset, name });
  };

  const handleStopRecording = () => {
    vscode.postMessage({ type: 'stopRecording' });
  };

  const handlePlay = (path: string) => {
    vscode.postMessage({ type: 'playBag', path, rate: playbackRate });
  };

  const handleStopPlayback = () => {
    vscode.postMessage({ type: 'stopPlayback' });
  };

  const handleDelete = (path: string) => {
    vscode.postMessage({ type: 'deleteBag', path });
  };

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Recording Section */}
      <div style={{
        background: 'var(--vscode-sideBar-background)',
        borderRadius: '6px',
        padding: '12px',
        border: recording ? '1px solid #c6282866' : '1px solid var(--vscode-panel-border)',
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--vscode-descriptionForeground)',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}>
          Recording
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
            disabled={recording}
            style={{
              padding: '5px 8px',
              border: '1px solid var(--vscode-input-border)',
              borderRadius: '3px',
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              fontSize: '12px',
              fontFamily: 'inherit',
            }}
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>

          <input
            type="text"
            value={bagName}
            onChange={(e) => setBagName(e.target.value)}
            placeholder="Bag name (optional)"
            disabled={recording}
            style={{
              flex: 1,
              minWidth: '120px',
              padding: '5px 8px',
              border: '1px solid var(--vscode-input-border)',
              borderRadius: '3px',
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              fontSize: '12px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {recording ? (
            <button
              onClick={handleStopRecording}
              style={{
                padding: '5px 14px',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
                background: '#c62828',
                color: '#ffffff',
                fontFamily: 'inherit',
              }}
            >
              Stop Recording
            </button>
          ) : (
            <button
              onClick={handleRecord}
              style={{
                padding: '5px 14px',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
                background: '#c62828',
                color: '#ffffff',
                fontFamily: 'inherit',
              }}
            >
              Record
            </button>
          )}

          {recording && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#f44336',
                animation: 'none',
              }} />
              <span style={{ fontWeight: 600, color: '#ef9a9a' }}>
                {formatDuration(displayElapsed)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Playback Controls */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', fontWeight: 600 }}>
          Playback Rate:
        </span>
        {RATES.map((rate) => (
          <button
            key={rate}
            onClick={() => setPlaybackRate(rate)}
            style={{
              padding: '3px 10px',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '11px',
              background: playbackRate === rate ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
              color: playbackRate === rate ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
              fontFamily: 'inherit',
            }}
          >
            {rate}x
          </button>
        ))}
        <button
          onClick={handleStopPlayback}
          style={{
            padding: '3px 10px',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            marginLeft: 'auto',
            fontFamily: 'inherit',
          }}
        >
          Stop Playback
        </button>
      </div>

      {/* Bag File List */}
      <div>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--vscode-descriptionForeground)',
          textTransform: 'uppercase',
          marginBottom: '6px',
        }}>
          Bag Files ({bagFiles.length})
        </div>

        {bagFiles.length === 0 ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: 'var(--vscode-descriptionForeground)',
            fontSize: '12px',
            border: '1px dashed var(--vscode-panel-border)',
            borderRadius: '4px',
          }}>
            No bag files found in workspace/bags directory
          </div>
        ) : (
          bagFiles.map((bag) => (
            <div key={bag.path} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderBottom: '1px solid var(--vscode-panel-border)',
              fontSize: '12px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{bag.name}</div>
                <div style={{
                  fontSize: '10px',
                  color: 'var(--vscode-descriptionForeground)',
                  display: 'flex',
                  gap: '8px',
                  marginTop: '2px',
                }}>
                  <span>{bag.size_mb} MB</span>
                  {bag.duration_s > 0 && <span>{formatDuration(bag.duration_s)}</span>}
                  {bag.topics_count > 0 && <span>{bag.topics_count} topics</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => handlePlay(bag.path)}
                  style={{
                    padding: '3px 8px',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    background: '#2e7d3266',
                    color: '#a5d6a7',
                    fontFamily: 'inherit',
                  }}
                >
                  Play
                </button>
                <button
                  onClick={() => handleDelete(bag.path)}
                  style={{
                    padding: '3px 8px',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    background: '#c6282833',
                    color: '#ef9a9a',
                    fontFamily: 'inherit',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
