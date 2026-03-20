// Copyright 2026 VirtusCo
// Color-coded profile card with launch/stop actions

import React from 'react';
import { LaunchProfile } from '../store/simStore';

interface ProfileCardProps {
  profile: LaunchProfile;
  active: boolean;
  onLaunch: (id: string) => void;
  onStop: () => void;
}

export default function ProfileCard({ profile, active, onLaunch, onStop }: ProfileCardProps): React.ReactElement {
  return (
    <div style={{
      background: 'var(--vscode-editor-background)',
      border: '1px solid var(--vscode-panel-border)',
      borderLeft: `4px solid ${profile.color}`,
      borderRadius: '4px',
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>{profile.label}</span>
        <span style={{
          fontSize: '10px',
          color: 'var(--vscode-descriptionForeground)',
        }}>
          {profile.steps.length} step{profile.steps.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{
        fontSize: '11px',
        color: 'var(--vscode-descriptionForeground)',
        lineHeight: '1.4',
      }}>
        {profile.description}
      </div>

      {active ? (
        <button
          onClick={onStop}
          style={{
            padding: '5px 10px',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            background: '#c62828',
            color: '#ffffff',
            fontFamily: 'inherit',
          }}
        >
          Stop
        </button>
      ) : (
        <button
          onClick={() => onLaunch(profile.id)}
          style={{
            padding: '5px 10px',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            background: '#2e7d32',
            color: '#ffffff',
            fontFamily: 'inherit',
          }}
        >
          Launch
        </button>
      )}
    </div>
  );
}
