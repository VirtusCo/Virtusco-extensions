// Copyright 2026 VirtusCo
// Main App component — sidebar nav + page router + message listener

import React, { useEffect } from 'react';
import { useRos2Store, PageId } from './store/ros2Store';
import { TopicMonitorPage } from './pages/TopicMonitorPage';
import { NodeGraphPage } from './pages/NodeGraphPage';
import { FSMViewerPage } from './pages/FSMViewerPage';
import { BridgeDebuggerPage } from './pages/BridgeDebuggerPage';
import { LaunchBuilderPage } from './pages/LaunchBuilderPage';
import { CommandsPage } from './pages/CommandsPage';

const NAV_ITEMS: { id: PageId; label: string }[] = [
  { id: 'topics', label: 'Topics' },
  { id: 'graph', label: 'Graph' },
  { id: 'fsm', label: 'FSM' },
  { id: 'bridge', label: 'Bridge' },
  { id: 'launch', label: 'Launch' },
  { id: 'commands', label: 'Commands' },
];

export function App(): React.ReactElement {
  const activePage = useRos2Store((s) => s.activePage);
  const setActivePage = useRos2Store((s) => s.setActivePage);
  const setRos2Status = useRos2Store((s) => s.setRos2Status);
  const setNodeGraph = useRos2Store((s) => s.setNodeGraph);
  const pushFsmState = useRos2Store((s) => s.pushFsmState);
  const pushBridgeFrame = useRos2Store((s) => s.pushBridgeFrame);
  const updateTopic = useRos2Store((s) => s.updateTopic);
  const setCommandOutput = useRos2Store((s) => s.setCommandOutput);
  const setLaunchCode = useRos2Store((s) => s.setLaunchCode);

  // ── Message Listener ─────────────────────────────────────────

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || !msg.type) {
        return;
      }

      switch (msg.type) {
        case 'ros2Status':
          setRos2Status(msg.status);
          break;
        case 'nodeGraph':
          setNodeGraph(msg.graph);
          break;
        case 'fsmState':
          pushFsmState(msg.state);
          break;
        case 'bridgeFrame':
          pushBridgeFrame(msg.frame);
          break;
        case 'topicMessage':
          updateTopic(msg.topic, { lastMessage: msg.data });
          break;
        case 'topicHz':
          updateTopic(msg.topic, { hz: msg.hz });
          break;
        case 'nodeAlert':
          // Handled via nodeGraph update
          break;
        case 'commandOutput':
          setCommandOutput(msg.cmd, msg.output, msg.exitCode);
          break;
        case 'launchGenerated':
          setLaunchCode(msg.code);
          break;
        case 'launchSaved':
          // Could show a notification
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setRos2Status, setNodeGraph, pushFsmState, pushBridgeFrame, updateTopic, setCommandOutput, setLaunchCode]);

  // ── Render ────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Navigation Bar */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid var(--vscode-panel-border, #333)',
        background: 'var(--vscode-sideBar-background, #252526)',
        flexShrink: 0,
      }}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activePage === item.id
                ? '2px solid var(--vscode-textLink-foreground, #3794ff)'
                : '2px solid transparent',
              background: activePage === item.id
                ? 'var(--vscode-editor-background, #1e1e1e)'
                : 'transparent',
              color: activePage === item.id
                ? 'var(--vscode-foreground, #ccc)'
                : 'var(--vscode-descriptionForeground, #888)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activePage === item.id ? 600 : 400,
              fontFamily: 'var(--vscode-font-family)',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Page Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activePage === 'topics' && <TopicMonitorPage />}
        {activePage === 'graph' && <NodeGraphPage />}
        {activePage === 'fsm' && <FSMViewerPage />}
        {activePage === 'bridge' && <BridgeDebuggerPage />}
        {activePage === 'launch' && <LaunchBuilderPage />}
        {activePage === 'commands' && <CommandsPage />}
      </div>
    </div>
  );
}
