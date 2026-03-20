// Copyright 2026 VirtusCo
// Launch page: profile cards, active profile info, process list

import React from 'react';
import { useSimStore } from '../store/simStore';
import { vscode } from '../vscodeApi';
import ProfileCard from '../components/ProfileCard';
import ProcessStatusBar from '../components/ProcessStatusBar';

export default function LaunchPage(): React.ReactElement {
  const profiles = useSimStore((s) => s.profiles);
  const activeProfileId = useSimStore((s) => s.activeProfileId);
  const processes = useSimStore((s) => s.processes);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const runningProcesses = processes.filter((p) => p.status === 'running');

  const handleLaunch = (profileId: string) => {
    vscode.postMessage({ type: 'launchProfile', profileId });
  };

  const handleStop = () => {
    vscode.postMessage({ type: 'stopAll' });
  };

  const handleStopProcess = (processId: string) => {
    vscode.postMessage({ type: 'stopProcess', processId });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Active Profile Section */}
      {activeProfile && (
        <div style={{
          background: 'var(--vscode-sideBar-background)',
          borderRadius: '6px',
          padding: '12px',
          border: `1px solid ${activeProfile.color}40`,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
            <div>
              <span style={{
                fontWeight: 600,
                fontSize: '14px',
                color: activeProfile.color,
              }}>
                {activeProfile.label}
              </span>
              <span style={{
                fontSize: '11px',
                color: 'var(--vscode-descriptionForeground)',
                marginLeft: '8px',
              }}>
                {runningProcesses.length} running
              </span>
            </div>
            <button
              onClick={handleStop}
              style={{
                padding: '4px 12px',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
                background: '#c62828',
                color: '#ffffff',
                fontFamily: 'inherit',
              }}
            >
              Stop All
            </button>
          </div>

          <ProcessStatusBar processes={processes} />

          {/* Process list with details */}
          <div style={{ marginTop: '8px' }}>
            {processes.map((proc) => {
              const dotColor = proc.status === 'running'
                ? '#4caf50'
                : proc.status === 'error'
                  ? '#f44336'
                  : '#9e9e9e';
              const uptime = proc.startTime > 0
                ? Math.floor((Date.now() - proc.startTime) / 1000)
                : 0;

              return (
                <div key={proc.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  borderBottom: '1px solid var(--vscode-panel-border)',
                  fontSize: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: dotColor,
                    }} />
                    <span>{proc.name}</span>
                    <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '10px' }}>
                      PID {proc.pid}
                    </span>
                    {uptime > 0 && (
                      <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '10px' }}>
                        {uptime}s
                      </span>
                    )}
                  </div>
                  {proc.status === 'running' && (
                    <button
                      onClick={() => handleStopProcess(proc.id)}
                      style={{
                        padding: '2px 8px',
                        border: 'none',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        background: '#c6282866',
                        color: '#ef9a9a',
                        fontFamily: 'inherit',
                      }}
                    >
                      Stop
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Step sequence */}
          <div style={{ marginTop: '10px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--vscode-descriptionForeground)',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}>
              Launch Sequence
            </div>
            {activeProfile.steps.map((step, i) => {
              const proc = processes.find((p) => p.name === step.name);
              const statusColor = proc
                ? proc.status === 'running' ? '#4caf50' : proc.status === 'error' ? '#f44336' : '#9e9e9e'
                : 'var(--vscode-descriptionForeground)';
              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  padding: '2px 0',
                }}>
                  <span style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 600,
                    background: statusColor + '33',
                    color: statusColor,
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <span>{step.name}</span>
                  {step.delay_ms && (
                    <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '10px' }}>
                      +{step.delay_ms / 1000}s delay
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Profile Grid */}
      <div>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--vscode-descriptionForeground)',
          textTransform: 'uppercase',
          marginBottom: '8px',
          letterSpacing: '0.5px',
        }}>
          Launch Profiles
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '8px',
        }}>
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              active={profile.id === activeProfileId}
              onLaunch={handleLaunch}
              onStop={handleStop}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
