// Copyright 2026 VirtusCo

import { useEffect } from 'react';
import { vscode } from './vscodeApi';
import { useSuiteStore, ActivePage } from './store/suiteStore';
import { DashboardPage } from './pages/DashboardPage';
import { InstallerPage } from './pages/InstallerPage';
import { ConfigPage } from './pages/ConfigPage';
import { SetupWizardPage } from './pages/SetupWizardPage';

const TABS: { key: ActivePage; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'installer', label: 'Installer' },
  { key: 'config', label: 'Config' },
  { key: 'setup', label: 'Setup' },
];

export function App() {
  const activePage = useSuiteStore((s) => s.activePage);
  const setActivePage = useSuiteStore((s) => s.setActivePage);
  const setExtensions = useSuiteStore((s) => s.setExtensions);
  const setDependencies = useSuiteStore((s) => s.setDependencies);
  const setWorkspace = useSuiteStore((s) => s.setWorkspace);
  const addAlert = useSuiteStore((s) => s.addAlert);
  const setConfig = useSuiteStore((s) => s.setConfig);
  const setSetupStepComplete = useSuiteStore((s) => s.setSetupStepComplete);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'suiteStatus':
          setExtensions(message.status.extensions);
          setDependencies(message.status.dependencies);
          setWorkspace(message.status.workspace);
          break;
        case 'dependencies':
          setDependencies(message.dependencies);
          break;
        case 'config':
          setConfig(message.config);
          break;
        case 'configSaved':
          addAlert({
            id: Date.now().toString(),
            source: 'Config',
            message: 'Configuration saved successfully.',
            level: 'info',
            timestamp: Date.now(),
          });
          break;
        case 'browsedFile':
          setConfig({
            ...useSuiteStore.getState().config,
            [message.field]: message.path,
          });
          break;
        case 'alert':
          addAlert(message.alert);
          break;
        case 'setupProgress':
          setSetupStepComplete(message.step, message.complete);
          break;
        case 'error':
          addAlert({
            id: Date.now().toString(),
            source: 'System',
            message: message.message,
            level: 'error',
            timestamp: Date.now(),
          });
          break;
        case 'info':
          addAlert({
            id: Date.now().toString(),
            source: 'System',
            message: message.message,
            level: 'info',
            timestamp: Date.now(),
          });
          break;
      }
    };

    window.addEventListener('message', handler);

    // Request initial status
    vscode.postMessage({ type: 'requestStatus' });

    return () => window.removeEventListener('message', handler);
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage />;
      case 'installer': return <InstallerPage />;
      case 'config': return <ConfigPage />;
      case 'setup': return <SetupWizardPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--vscode-panel-border, #333)',
        background: 'var(--vscode-editor-background)',
        flexShrink: 0,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActivePage(tab.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activePage === tab.key
                ? '2px solid var(--vscode-focusBorder, #007acc)'
                : '2px solid transparent',
              background: 'transparent',
              color: activePage === tab.key
                ? 'var(--vscode-foreground)'
                : 'var(--vscode-descriptionForeground)',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'var(--vscode-font-family)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Page content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px',
      }}>
        {renderPage()}
      </div>
    </div>
  );
}
