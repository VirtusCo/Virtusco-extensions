// Copyright 2026 VirtusCo
// Commands page — grouped ROS 2 command buttons with output log

import React, { useRef, useEffect } from 'react';
import { useRos2Store } from '../store/ros2Store';
import { vscode } from '../vscodeApi';

// ── Command Definitions ─────────────────────────────────────────────

interface CommandDef {
  label: string;
  cmd: string;
}

interface CommandGroup {
  group: string;
  commands: CommandDef[];
}

const COMMAND_GROUPS: CommandGroup[] = [
  {
    group: 'Movement',
    commands: [
      { label: 'Move Forward', cmd: 'ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.2}, angular: {z: 0.0}}"' },
      { label: 'Move Backward', cmd: 'ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: -0.2}, angular: {z: 0.0}}"' },
      { label: 'Rotate Left', cmd: 'ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.0}, angular: {z: 0.5}}"' },
      { label: 'Rotate Right', cmd: 'ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.0}, angular: {z: -0.5}}"' },
      { label: 'Stop', cmd: 'ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.0}, angular: {z: 0.0}}"' },
    ],
  },
  {
    group: 'Diagnostics',
    commands: [
      { label: 'List Nodes', cmd: 'ros2 node list' },
      { label: 'List Topics', cmd: 'ros2 topic list -t' },
      { label: 'Topic Hz (/scan)', cmd: 'ros2 topic hz /scan --window 5' },
      { label: 'Topic Hz (/cmd_vel)', cmd: 'ros2 topic hz /cmd_vel --window 5' },
      { label: 'Param Dump', cmd: 'ros2 param dump /porter_orchestrator' },
      { label: 'TF Tree', cmd: 'ros2 run tf2_tools view_frames' },
    ],
  },
  {
    group: 'Build',
    commands: [
      { label: 'Build All', cmd: 'cd ~/porter_ws && colcon build --symlink-install --cmake-args -Wno-dev' },
      { label: 'Build ydlidar_driver', cmd: 'cd ~/porter_ws && colcon build --packages-select ydlidar_driver --symlink-install' },
      { label: 'Build porter_orchestrator', cmd: 'cd ~/porter_ws && colcon build --packages-select porter_orchestrator --symlink-install' },
      { label: 'Build porter_ai_assistant', cmd: 'cd ~/porter_ws && colcon build --packages-select porter_ai_assistant --symlink-install' },
      { label: 'Source Workspace', cmd: 'source ~/porter_ws/install/setup.bash && echo "Workspace sourced"' },
    ],
  },
  {
    group: 'Recording',
    commands: [
      { label: 'Record All Topics', cmd: 'ros2 bag record -a -o porter_bag' },
      { label: 'Record Key Topics', cmd: 'ros2 bag record /scan /cmd_vel /odom /orchestrator/state -o porter_key_bag' },
      { label: 'Play Last Bag', cmd: 'ros2 bag play porter_bag' },
    ],
  },
];

export function CommandsPage(): React.ReactElement {
  const commandOutput = useRos2Store((s) => s.commandOutput);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [commandOutput]);

  const handleRunCommand = (cmd: string) => {
    vscode.postMessage({ type: 'runCommand', cmd });
  };

  return (
    <div style={{ padding: '12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600, flexShrink: 0 }}>
        ROS 2 Commands
      </h2>

      {/* Command Groups */}
      <div style={{ flex: 1, overflow: 'auto', marginBottom: '12px' }}>
        {COMMAND_GROUPS.map((group) => (
          <div key={group.group} style={{ marginBottom: '16px' }}>
            <h3 style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: 'var(--vscode-descriptionForeground)',
              marginBottom: '8px',
              letterSpacing: '0.5px',
            }}>
              {group.group}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {group.commands.map((cmd) => (
                <div
                  key={cmd.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <button
                    onClick={() => handleRunCommand(cmd.cmd)}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--vscode-button-secondaryBackground)',
                      color: 'var(--vscode-button-secondaryForeground)',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cmd.label}
                  </button>
                  <span style={{
                    fontSize: '9px',
                    color: 'var(--vscode-descriptionForeground)',
                    fontFamily: 'var(--vscode-editor-font-family, monospace)',
                    paddingLeft: '4px',
                    maxWidth: '260px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {cmd.cmd}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Output Log */}
      <div style={{ flexShrink: 0, height: '200px' }}>
        <h3 style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          color: 'var(--vscode-descriptionForeground)',
          marginBottom: '4px',
          letterSpacing: '0.5px',
        }}>
          Output
        </h3>
        <div
          ref={logRef}
          style={{
            height: 'calc(100% - 20px)',
            overflow: 'auto',
            background: 'var(--vscode-terminal-background, #1a1a1a)',
            border: '1px solid var(--vscode-panel-border, #333)',
            borderRadius: '4px',
            padding: '6px 8px',
            fontFamily: 'var(--vscode-editor-font-family, monospace)',
            fontSize: '11px',
          }}
        >
          {commandOutput.length === 0 ? (
            <div style={{ color: 'var(--vscode-descriptionForeground)' }}>
              Run a command to see output here.
            </div>
          ) : (
            commandOutput.map((entry, idx) => (
              <div key={idx} style={{ marginBottom: '8px' }}>
                <div style={{
                  color: 'var(--vscode-textLink-foreground)',
                  fontWeight: 600,
                  marginBottom: '2px',
                }}>
                  $ {entry.cmd}
                </div>
                <pre style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: entry.exitCode === 0 ? 'var(--vscode-foreground)' : '#f44336',
                }}>
                  {entry.output}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
