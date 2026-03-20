import React from 'react';
// Copyright 2026 VirtusCo

import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  BackgroundVariant,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { usePCBStore } from '../store/pcbStore';
import { vscode } from '../vscodeApi';
import { BuilderNode } from '../components/BuilderNode';

const CATEGORY_ORDER = ['Passive', 'IC', 'Sensor', 'Power', 'Connector'];
const CATEGORY_COLORS: Record<string, string> = {
  Passive: '#888', IC: '#569cd6', Sensor: '#4caf50', Power: '#ff9800', Connector: '#9c27b0',
};

function getCategoryForType(type: string): string {
  const map: Record<string, string> = {
    'Resistor': 'Passive',
    'Capacitor': 'Passive',
    'Diode': 'Passive',
    'LED': 'Passive',
    'BTS7960': 'IC',
    'ESP32-WROOM': 'IC',
    'Arduino Nano': 'IC',
    'VL53L0X': 'Sensor',
    'HC-SR04': 'Sensor',
    'RCWL-0516': 'Sensor',
    'LM7805': 'Power',
    'AMS1117-3.3': 'Power',
    'Relay Module': 'Power',
    'USB-C': 'Connector',
  };
  return map[type] || 'Other';
}

let idCounter = 0;
function genId(): string {
  return `comp_${Date.now()}_${idCounter++}`;
}

export function BuilderPage() {
  const library = usePCBStore((s) => s.builderLibrary);
  const clearBuilder = usePCBStore((s) => s.clearBuilder);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const nodeTypes: NodeTypes = useMemo(() => ({
    builderComponent: BuilderNode,
  }), []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
  }, []);

  const wrapperRef = useCallback((node: HTMLDivElement | null) => {
    if (node) (window as unknown as Record<string, unknown>).__pcbWrapper = node;
  }, []);

  const addComponentToCanvas = useCallback((template: typeof library[0], position: { x: number; y: number }) => {
    const id = genId();
    const newNode: Node = {
      id,
      type: 'builderComponent',
      position,
      data: { component: { ...template, id } },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [library]);

  const handleAddComponent = (templateType: string) => {
    const template = library.find((c) => c.type === templateType);
    if (!template) return;
    addComponentToCanvas(template, { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 });
  };

  const onDragStart = useCallback((e: React.DragEvent, compType: string) => {
    e.dataTransfer.setData('application/pcb-component', compType);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const compType = e.dataTransfer.getData('application/pcb-component');
    if (!compType) return;
    const template = library.find((c) => c.type === compType);
    if (!template) return;

    const wrapper = (window as unknown as Record<string, unknown>).__pcbWrapper as HTMLDivElement | null;
    const bounds = wrapper?.getBoundingClientRect();
    const x = bounds ? e.clientX - bounds.left - 80 : 200 + Math.random() * 200;
    const y = bounds ? e.clientY - bounds.top - 30 : 100 + Math.random() * 200;

    addComponentToCanvas(template, { x, y });
  }, [library, addComponentToCanvas]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [clipboard, setClipboard] = useState<Node | null>(null);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => { setSelectedNodeId(null); setContextMenu(null); }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    setSelectedNodeId(node.id);
  }, []);

  const handleContextAction = useCallback((action: string) => {
    if (!contextMenu) return;
    const node = nodes.find(n => n.id === contextMenu.nodeId);
    switch (action) {
      case 'copy': if (node) setClipboard(node); break;
      case 'cut':
        if (node) { setClipboard(node); setNodes(nds => nds.filter(n => n.id !== contextMenu.nodeId)); setEdges(eds => eds.filter(e => e.source !== contextMenu.nodeId && e.target !== contextMenu.nodeId)); setSelectedNodeId(null); }
        break;
      case 'duplicate':
        if (node) { const id = genId(); setNodes(nds => [...nds, { ...node, id, position: { x: node.position.x + 40, y: node.position.y + 40 } }]); setSelectedNodeId(id); }
        break;
      case 'delete':
        setNodes(nds => nds.filter(n => n.id !== contextMenu.nodeId));
        setEdges(eds => eds.filter(e => e.source !== contextMenu.nodeId && e.target !== contextMenu.nodeId));
        setSelectedNodeId(null);
        break;
    }
    setContextMenu(null);
  }, [contextMenu, nodes]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedNodeId) { setNodes(nds => nds.filter(n => n.id !== selectedNodeId)); setEdges(eds => eds.filter(ed => ed.source !== selectedNodeId && ed.target !== selectedNodeId)); setSelectedNodeId(null); }
      if (e.ctrlKey && e.key === 'c' && selectedNodeId) { const n = nodes.find(nd => nd.id === selectedNodeId); if (n) setClipboard(n); }
      if (e.ctrlKey && e.key === 'v' && clipboard) { const id = genId(); setNodes(nds => [...nds, { ...clipboard, id, position: { x: clipboard.position.x + 60, y: clipboard.position.y + 60 } }]); setSelectedNodeId(id); }
      if (e.ctrlKey && e.key === 'x' && selectedNodeId) { const n = nodes.find(nd => nd.id === selectedNodeId); if (n) { setClipboard(n); setNodes(nds => nds.filter(nd => nd.id !== selectedNodeId)); setEdges(eds => eds.filter(ed => ed.source !== selectedNodeId && ed.target !== selectedNodeId)); setSelectedNodeId(null); } }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, nodes, clipboard]);

  const handleExportKicad = () => {
    const components = nodes.map(n => (n.data as unknown as { component: unknown }).component);
    vscode.postMessage({ type: 'exportKicad', schematic: { name: 'Untitled', components, wires: [] } });
  };

  const handleSaveVirtussch = () => {
    const components = nodes.map(n => (n.data as unknown as { component: unknown }).component);
    vscode.postMessage({ type: 'saveVirtussch', schematic: { name: 'Untitled', components, wires: [] } });
  };

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  // Group library by category
  const grouped = useMemo(() => {
    const groups: Record<string, typeof library> = {};
    for (const comp of library) {
      const cat = getCategoryForType(comp.type);
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(comp);
    }
    return groups;
  }, [library]);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left palette */}
      <div style={{
        width: '200px',
        borderRight: '1px solid var(--vscode-panel-border)',
        overflow: 'auto',
        background: 'var(--vscode-sideBar-background)',
        flexShrink: 0,
      }}>
        <div style={{
          padding: '8px',
          fontSize: '11px',
          fontWeight: 'bold',
          color: 'var(--vscode-descriptionForeground)',
          textTransform: 'uppercase',
          borderBottom: '1px solid var(--vscode-panel-border)',
        }}>
          Component Library
        </div>
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (!items) {
            return null;
          }
          return (
            <div key={cat}>
              <div style={{
                padding: '6px 8px',
                fontSize: '10px',
                fontWeight: 'bold',
                color: 'var(--vscode-descriptionForeground)',
                textTransform: 'uppercase',
                background: 'var(--vscode-editorWidget-background)',
              }}>
                {cat}
              </div>
              {items.map((comp) => (
                <div
                  key={comp.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, comp.type)}
                  onClick={() => handleAddComponent(comp.type)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: '100%',
                    padding: '6px 12px',
                    borderBottom: '1px solid var(--vscode-panel-border)',
                    background: 'transparent',
                    color: 'var(--vscode-foreground)',
                    cursor: 'grab',
                    textAlign: 'left',
                    fontSize: '12px',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget).style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)'; }}
                  onMouseLeave={(e) => { (e.currentTarget).style.background = 'transparent'; }}
                  title={`Drag to canvas or click to add — ${comp.name} (${comp.pins.length} pins)`}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: CATEGORY_COLORS[cat] || '#888', flexShrink: 0 }} />
                  {comp.name}
                  <span style={{
                    fontSize: '10px',
                    color: 'var(--vscode-descriptionForeground)',
                    marginLeft: 'auto',
                  }}>
                    {comp.pins.length}p
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Center canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Toolbar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          gap: '8px',
          padding: '8px 12px',
          background: 'var(--vscode-editorWidget-background)',
          borderBottom: '1px solid var(--vscode-panel-border)',
        }}>
          <button
            onClick={handleExportKicad}
            disabled={nodes.length === 0}
            style={{
              padding: '4px 10px',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '2px',
              cursor: nodes.length > 0 ? 'pointer' : 'default',
              fontSize: '11px',
              opacity: nodes.length > 0 ? 1 : 0.5,
            }}
          >
            Export .kicad_sch
          </button>
          <button
            onClick={handleSaveVirtussch}
            disabled={nodes.length === 0}
            style={{
              padding: '4px 10px',
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
              borderRadius: '2px',
              cursor: nodes.length > 0 ? 'pointer' : 'default',
              fontSize: '11px',
              opacity: nodes.length > 0 ? 1 : 0.5,
            }}
          >
            Save .virtussch
          </button>
          <button
            onClick={() => { setNodes([]); setEdges([]); clearBuilder(); }}
            style={{
              padding: '4px 10px',
              background: 'transparent',
              color: 'var(--vscode-errorForeground)',
              border: '1px solid var(--vscode-errorForeground)',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Clear
          </button>
          <span style={{
            marginLeft: 'auto',
            fontSize: '11px',
            color: 'var(--vscode-descriptionForeground)',
            alignSelf: 'center',
          }}>
            {nodes.length} components, {edges.length} wires
          </span>
        </div>

        {/* React Flow canvas */}
        <div ref={wrapperRef} style={{ width: '100%', height: '100%', paddingTop: '40px' }}
          onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onNodeContextMenu={onNodeContextMenu}
              onPaneClick={onPaneClick}
              fitView
              snapToGrid snapGrid={[16, 16]}
              defaultEdgeOptions={{ animated: true }}
              style={{ background: 'var(--vscode-editor-background)' }}
            >
              <Controls
                style={{
                  background: 'var(--vscode-editorWidget-background)',
                  borderRadius: '4px',
                  border: '1px solid var(--vscode-panel-border)',
                }}
              />
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--vscode-editorLineNumber-foreground)" />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>

      {/* Right: Config Panel */}
      {selectedNode && (() => {
        const comp = (selectedNode.data as unknown as { component: { type: string; name: string; value: string; pins: { id: string; name: string; dir: string }[] } }).component;
        if (!comp) return null;
        return (
          <div style={{ width: 240, borderLeft: '1px solid var(--vscode-panel-border)', background: 'var(--vscode-sideBar-background)', overflow: 'auto', flexShrink: 0, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{comp.name}</span>
              <button onClick={() => { setNodes(nds => nds.filter(n => n.id !== selectedNodeId)); setEdges(eds => eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId)); setSelectedNodeId(null); }}
                style={{ background: '#f44', color: '#fff', border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>Delete</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 12 }}>
              {comp.type} | {comp.pins.length} pins
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>Reference</label>
              <input type="text" value={comp.name} onChange={e => {
                setNodes(nds => nds.map(n => n.id === selectedNodeId ? { ...n, data: { ...n.data, component: { ...comp, name: e.target.value } } } : n));
              }} style={{ width: '100%', padding: '3px 6px', fontSize: 12, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border, #555)', borderRadius: 3, outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>Value</label>
              <input type="text" value={comp.value} onChange={e => {
                setNodes(nds => nds.map(n => n.id === selectedNodeId ? { ...n, data: { ...n.data, component: { ...comp, value: e.target.value } } } : n));
              }} style={{ width: '100%', padding: '3px 6px', fontSize: 12, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border, #555)', borderRadius: 3, outline: 'none' }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Pins</div>
            {comp.pins.map((pin: { id: string; name: string; dir: string }) => (
              <div key={pin.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', borderBottom: '1px solid var(--vscode-panel-border)' }}>
                <span>{pin.name}</span>
                <span style={{ color: pin.dir === 'in' ? '#4caf50' : pin.dir === 'out' ? '#f44336' : '#2196f3', fontSize: 10 }}>{pin.dir}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Context Menu */}
      {contextMenu && (
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000, background: 'var(--vscode-menu-background, #252526)', border: '1px solid var(--vscode-menu-border, #454545)', borderRadius: 4, padding: '4px 0', minWidth: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
          onClick={e => e.stopPropagation()}>
          {[{ label: 'Copy', action: 'copy' }, { label: 'Cut', action: 'cut' }, { label: 'Duplicate', action: 'duplicate' }, { label: 'Delete', action: 'delete' }].map(item => (
            <div key={item.action} onClick={() => handleContextAction(item.action)}
              style={{ padding: '6px 16px', fontSize: 12, cursor: 'pointer', color: item.action === 'delete' ? '#f44336' : 'var(--vscode-menu-foreground, #ccc)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--vscode-menu-selectionBackground, #094771)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
