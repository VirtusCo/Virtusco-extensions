// Copyright 2026 VirtusCo
// World file management: scan, list, switch active world

import React, { useEffect } from 'react';
import { useSimStore } from '../store/simStore';
import { vscode } from '../vscodeApi';

export default function WorldsPage(): React.ReactElement {
  const worlds = useSimStore((s) => s.worlds);

  useEffect(() => {
    vscode.postMessage({ type: 'scanWorlds' });
  }, []);

  const handleRefresh = () => {
    vscode.postMessage({ type: 'scanWorlds' });
  };

  const handleSwitch = (worldPath: string) => {
    vscode.postMessage({ type: 'switchWorld', worldPath });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--vscode-descriptionForeground)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          World Files ({worlds.length})
        </span>
        <button
          onClick={handleRefresh}
          style={{
            padding: '3px 10px',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            fontFamily: 'inherit',
          }}
        >
          Refresh
        </button>
      </div>

      {/* World list */}
      {worlds.length === 0 ? (
        <div style={{
          padding: '30px 20px',
          textAlign: 'center',
          color: 'var(--vscode-descriptionForeground)',
          fontSize: '12px',
          border: '1px dashed var(--vscode-panel-border)',
          borderRadius: '4px',
        }}>
          <div style={{ marginBottom: '8px' }}>No world files found</div>
          <div style={{ fontSize: '10px' }}>
            Place .world or .sdf files in worlds/, simulation/worlds/, or src/porter_description/worlds/
          </div>
        </div>
      ) : (
        worlds.map((world) => (
          <div
            key={world.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: world.active ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-sideBar-background)',
              border: world.active ? '1px solid var(--vscode-textLink-foreground)' : '1px solid var(--vscode-panel-border)',
              borderRadius: '4px',
            }}
          >
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: world.active ? 600 : 400,
                }}>{world.name}</span>
                {world.active && (
                  <span style={{
                    padding: '1px 8px',
                    borderRadius: '3px',
                    fontSize: '9px',
                    fontWeight: 600,
                    background: '#2e7d3266',
                    color: '#a5d6a7',
                  }}>
                    ACTIVE
                  </span>
                )}
              </div>
              <div style={{
                fontSize: '10px',
                color: 'var(--vscode-descriptionForeground)',
                marginTop: '2px',
              }}>
                {world.path}
              </div>
            </div>

            {!world.active && (
              <button
                onClick={() => handleSwitch(world.path)}
                style={{
                  padding: '4px 12px',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  background: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                Switch World
              </button>
            )}
          </div>
        ))
      )}

      {/* Warning about restart */}
      {worlds.length > 0 && (
        <div style={{
          padding: '8px 12px',
          background: '#ff980015',
          border: '1px solid #ff980030',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#ffcc80',
        }}>
          Switching worlds requires restarting Gazebo. Stop all processes before switching.
        </div>
      )}
    </div>
  );
}
