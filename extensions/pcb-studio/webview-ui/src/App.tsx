// Copyright 2026 VirtusCo

import { useEffect } from 'react';
import { usePCBStore, ActivePage } from './store/pcbStore';
import { SchematicPage } from './pages/SchematicPage';
import { SyncPage } from './pages/SyncPage';
import { BOMPage } from './pages/BOMPage';
import { DiffPage } from './pages/DiffPage';
import { ImpactPage } from './pages/ImpactPage';
import { BuilderPage } from './pages/BuilderPage';
import { ComponentsPage } from './pages/ComponentsPage';
import { PCBLayoutPage } from './pages/PCBLayoutPage';
import { GerberViewerPage } from './pages/GerberViewerPage';
import { DRCPage } from './pages/DRCPage';
import { CostPage } from './pages/CostPage';

const TABS: { id: ActivePage; label: string }[] = [
  { id: 'schematic', label: 'Schematic' },
  { id: 'sync', label: 'Sync' },
  { id: 'bom', label: 'BOM' },
  { id: 'diff', label: 'Diff' },
  { id: 'impact', label: 'Impact' },
  { id: 'builder', label: 'Builder' },
  { id: 'components', label: 'Components' },
  { id: 'pcblayout', label: 'PCB Layout' },
  { id: 'gerber', label: 'Gerber Viewer' },
  { id: 'drc', label: 'DRC' },
  { id: 'cost', label: 'Cost' },
];

export function App() {
  const activePage = usePCBStore((s) => s.activePage);
  const setActivePage = usePCBStore((s) => s.setActivePage);
  const setSchematicSvg = usePCBStore((s) => s.setSchematicSvg);
  const setSchematicStats = usePCBStore((s) => s.setSchematicStats);
  const setSyncResults = usePCBStore((s) => s.setSyncResults);
  const setBomEntries = usePCBStore((s) => s.setBomEntries);
  const setDiffResult = usePCBStore((s) => s.setDiffResult);
  const setImpactResults = usePCBStore((s) => s.setImpactResults);
  const setBuilderLibrary = usePCBStore((s) => s.setBuilderLibrary);
  const setDrcViolations = usePCBStore((s) => s.setDrcViolations);
  const setGerberFiles = usePCBStore((s) => s.setGerberFiles);
  const setCostEstimate = usePCBStore((s) => s.setCostEstimate);
  const setPcbDesign = usePCBStore((s) => s.setPcbDesign);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'schematic':
          setSchematicSvg(message.svg);
          setSchematicStats(message.stats);
          break;
        case 'syncResults':
          setSyncResults(message.results);
          setActivePage('sync');
          break;
        case 'bom':
          setBomEntries(message.entries);
          break;
        case 'diff':
          setDiffResult(message.result);
          setActivePage('diff');
          break;
        case 'impact':
          setImpactResults(message.results);
          break;
        case 'builderLibrary':
          setBuilderLibrary(message.components);
          break;
        case 'drcResults':
          setDrcViolations(message.violations);
          setActivePage('drc');
          break;
        case 'gerberGenerated':
          setGerberFiles(message.gerbers);
          setActivePage('gerber');
          break;
        case 'costEstimate':
          setCostEstimate(message.estimate);
          setActivePage('cost');
          break;
        case 'pcbDesignUpdate':
          setPcbDesign(message.design);
          break;
        case 'info':
          setActivePage('builder');
          break;
        case 'error':
          console.error('[PCB Studio]', message.message);
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [
    setSchematicSvg,
    setSchematicStats,
    setSyncResults,
    setBomEntries,
    setDiffResult,
    setImpactResults,
    setBuilderLibrary,
    setDrcViolations,
    setGerberFiles,
    setCostEstimate,
    setPcbDesign,
    setActivePage,
  ]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--vscode-editor-background)',
      color: 'var(--vscode-editor-foreground)',
      fontFamily: 'var(--vscode-font-family)',
      fontSize: 'var(--vscode-font-size)',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--vscode-panel-border)',
        background: 'var(--vscode-editorGroupHeader-tabsBackground)',
        flexShrink: 0,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivePage(tab.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activePage === tab.id
                ? '2px solid var(--vscode-focusBorder)'
                : '2px solid transparent',
              background: activePage === tab.id
                ? 'var(--vscode-tab-activeBackground)'
                : 'transparent',
              color: activePage === tab.id
                ? 'var(--vscode-tab-activeForeground)'
                : 'var(--vscode-tab-inactiveForeground)',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--vscode-font-family)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activePage === 'schematic' && <SchematicPage />}
        {activePage === 'sync' && <SyncPage />}
        {activePage === 'bom' && <BOMPage />}
        {activePage === 'diff' && <DiffPage />}
        {activePage === 'impact' && <ImpactPage />}
        {activePage === 'builder' && <BuilderPage />}
        {activePage === 'components' && <ComponentsPage />}
        {activePage === 'pcblayout' && <PCBLayoutPage />}
        {activePage === 'gerber' && <GerberViewerPage />}
        {activePage === 'drc' && <DRCPage />}
        {activePage === 'cost' && <CostPage />}
      </div>
    </div>
  );
}
