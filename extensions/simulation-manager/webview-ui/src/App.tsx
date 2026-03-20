// Copyright 2026 VirtusCo
// Root application component with 6-tab navigation and message routing

import React, { useEffect } from 'react';
import { useSimStore, Page } from './store/simStore';
import { vscode } from './vscodeApi';
import LaunchPage from './pages/LaunchPage';
import URDFPage from './pages/URDFPage';
import Nav2Page from './pages/Nav2Page';
import BagsPage from './pages/BagsPage';
import ScenariosPage from './pages/ScenariosPage';
import WorldsPage from './pages/WorldsPage';

const TABS: { id: Page; label: string }[] = [
  { id: 'launch', label: 'Launch' },
  { id: 'urdf', label: 'URDF' },
  { id: 'nav2', label: 'Nav2' },
  { id: 'bags', label: 'Bags' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'worlds', label: 'Worlds' },
];

export default function App(): React.ReactElement {
  const activePage = useSimStore((s) => s.activePage);
  const setActivePage = useSimStore((s) => s.setActivePage);
  const setProfiles = useSimStore((s) => s.setProfiles);
  const setProcesses = useSimStore((s) => s.setProcesses);
  const setBagFiles = useSimStore((s) => s.setBagFiles);
  const setRecording = useSimStore((s) => s.setRecording);
  const setNav2Params = useSimStore((s) => s.setNav2Params);
  const setURDFData = useSimStore((s) => s.setURDFData);
  const setScenarios = useSimStore((s) => s.setScenarios);
  const setScenarioResult = useSimStore((s) => s.setScenarioResult);
  const setWorlds = useSimStore((s) => s.setWorlds);
  const setNotification = useSimStore((s) => s.setNotification);
  const notification = useSimStore((s) => s.notification);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case 'profilesData':
          setProfiles(msg.profiles, msg.activeProfileId);
          break;
        case 'processStatus':
          setProcesses(msg.processes);
          break;
        case 'bagList':
          setBagFiles(msg.bags);
          break;
        case 'recordingStatus':
          setRecording(msg.recording, msg.elapsed_s);
          break;
        case 'nav2Params':
          setNav2Params(msg.params, msg.schema);
          break;
        case 'urdfData':
          setURDFData(msg.links, msg.joints, msg.warnings);
          break;
        case 'scenarioList':
          setScenarios(msg.scenarios);
          break;
        case 'scenarioResult':
          setScenarioResult(msg.result);
          break;
        case 'worldList':
          setWorlds(msg.worlds);
          break;
        case 'error':
          setNotification({ type: 'error', message: msg.message });
          break;
        case 'info':
          setNotification({ type: 'info', message: msg.message });
          break;
      }
    };

    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'requestStatus' });
    return () => window.removeEventListener('message', handler);
  }, [setProfiles, setProcesses, setBagFiles, setRecording, setNav2Params, setURDFData, setScenarios, setScenarioResult, setWorlds, setNotification]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification, setNotification]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--vscode-editor-background)',
      color: 'var(--vscode-foreground)',
      fontFamily: 'var(--vscode-font-family)',
      fontSize: 'var(--vscode-font-size)',
    }}>
      {/* Notification bar */}
      {notification && (
        <div style={{
          padding: '6px 12px',
          background: notification.type === 'error' ? '#c6282833' : '#2e7d3233',
          color: notification.type === 'error' ? '#ef9a9a' : '#a5d6a7',
          fontSize: '12px',
          borderBottom: '1px solid var(--vscode-panel-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0 4px',
            }}
          >x</button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--vscode-panel-border)',
        background: 'var(--vscode-sideBar-background)',
        flexShrink: 0,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivePage(tab.id)}
            style={{
              flex: 1,
              padding: '8px 4px',
              border: 'none',
              borderBottom: activePage === tab.id ? '2px solid var(--vscode-textLink-foreground)' : '2px solid transparent',
              background: activePage === tab.id ? 'var(--vscode-editor-background)' : 'transparent',
              color: activePage === tab.id ? 'var(--vscode-textLink-foreground)' : 'var(--vscode-descriptionForeground)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activePage === tab.id ? 600 : 400,
              fontFamily: 'inherit',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {activePage === 'launch' && <LaunchPage />}
        {activePage === 'urdf' && <URDFPage />}
        {activePage === 'nav2' && <Nav2Page />}
        {activePage === 'bags' && <BagsPage />}
        {activePage === 'scenarios' && <ScenariosPage />}
        {activePage === 'worlds' && <WorldsPage />}
      </div>
    </div>
  );
}
