// Copyright 2026 VirtusCo
// URDF viewer: file browser, link/joint inspection, validation warnings

import React, { useState } from 'react';
import { useSimStore } from '../store/simStore';
import { vscode } from '../vscodeApi';

const JOINT_TYPE_COLORS: Record<string, string> = {
  fixed: '#9e9e9e',
  revolute: '#4fc3f7',
  continuous: '#81c784',
  prismatic: '#ffb74d',
  floating: '#ce93d8',
  planar: '#f48fb1',
};

export default function URDFPage(): React.ReactElement {
  const [filePath, setFilePath] = useState('');
  const links = useSimStore((s) => s.urdfLinks);
  const joints = useSimStore((s) => s.urdfJoints);
  const warnings = useSimStore((s) => s.urdfWarnings);

  const handleBrowse = () => {
    vscode.postMessage({ type: 'browseFile', purpose: 'urdf' });
  };

  const handleLoad = () => {
    if (filePath.trim()) {
      vscode.postMessage({ type: 'parseURDF', path: filePath });
    }
  };

  // Build parent-child hierarchy
  const childMap = new Map<string, string[]>();
  const allChildren = new Set<string>();
  for (const joint of joints) {
    if (!childMap.has(joint.parent)) {
      childMap.set(joint.parent, []);
    }
    childMap.get(joint.parent)!.push(joint.child);
    allChildren.add(joint.child);
  }
  const rootLinks = links.filter((l) => !allChildren.has(l.name));

  const renderTree = (linkName: string, depth: number): React.ReactElement[] => {
    const elements: React.ReactElement[] = [];
    const children = childMap.get(linkName) || [];
    for (const child of children) {
      const joint = joints.find((j) => j.parent === linkName && j.child === child);
      elements.push(
        <div key={`${linkName}-${child}`} style={{ paddingLeft: `${depth * 16}px`, fontSize: '11px', padding: '2px 0 2px ' + (depth * 16) + 'px' }}>
          <span style={{ color: 'var(--vscode-descriptionForeground)' }}>{linkName}</span>
          <span style={{ color: 'var(--vscode-descriptionForeground)', margin: '0 4px' }}>&rarr;</span>
          <span style={{
            display: 'inline-block',
            padding: '1px 6px',
            borderRadius: '3px',
            fontSize: '9px',
            fontWeight: 600,
            background: JOINT_TYPE_COLORS[joint?.type || 'fixed'] + '33',
            color: JOINT_TYPE_COLORS[joint?.type || 'fixed'],
            marginRight: '4px',
          }}>
            {joint?.type || '?'}
          </span>
          <span>{child}</span>
        </div>
      );
      elements.push(...renderTree(child, depth + 1));
    }
    return elements;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* File input */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <input
          type="text"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          placeholder="Path to URDF file..."
          style={{
            flex: 1,
            padding: '5px 8px',
            border: '1px solid var(--vscode-input-border)',
            borderRadius: '3px',
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            fontSize: '12px',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleBrowse}
          style={{
            padding: '5px 10px',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            fontFamily: 'inherit',
          }}
        >
          Browse
        </button>
        <button
          onClick={handleLoad}
          style={{
            padding: '5px 10px',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            fontFamily: 'inherit',
          }}
        >
          Load
        </button>
      </div>

      {/* Summary */}
      {links.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '16px',
          padding: '8px 12px',
          background: 'var(--vscode-sideBar-background)',
          borderRadius: '4px',
          fontSize: '12px',
        }}>
          <div><span style={{ fontWeight: 600 }}>{links.length}</span> links</div>
          <div><span style={{ fontWeight: 600 }}>{joints.length}</span> joints</div>
          <div style={{ color: warnings.length > 0 ? '#ffb74d' : '#81c784' }}>
            <span style={{ fontWeight: 600 }}>{warnings.length}</span> warning{warnings.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{
          background: '#ff980020',
          border: '1px solid #ff980040',
          borderRadius: '4px',
          padding: '8px 12px',
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#ffb74d',
            marginBottom: '4px',
            textTransform: 'uppercase',
          }}>
            Validation Warnings
          </div>
          {warnings.map((w, i) => (
            <div key={i} style={{ fontSize: '11px', color: '#ffcc80', padding: '1px 0' }}>
              - {w}
            </div>
          ))}
        </div>
      )}

      {/* Joint List */}
      {joints.length > 0 && (
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--vscode-descriptionForeground)',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            Joints
          </div>
          {joints.map((joint) => (
            <div key={joint.name} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 8px',
              borderBottom: '1px solid var(--vscode-panel-border)',
              fontSize: '12px',
            }}>
              <span style={{
                display: 'inline-block',
                padding: '1px 8px',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 600,
                background: (JOINT_TYPE_COLORS[joint.type] || '#9e9e9e') + '33',
                color: JOINT_TYPE_COLORS[joint.type] || '#9e9e9e',
                minWidth: '70px',
                textAlign: 'center',
              }}>
                {joint.type}
              </span>
              <span style={{ fontWeight: 500 }}>{joint.name}</span>
              <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '10px' }}>
                {joint.parent} &rarr; {joint.child}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Link Tree */}
      {rootLinks.length > 0 && (
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--vscode-descriptionForeground)',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            Link Hierarchy
          </div>
          <div style={{
            background: 'var(--vscode-sideBar-background)',
            borderRadius: '4px',
            padding: '8px 12px',
          }}>
            {rootLinks.map((link) => (
              <React.Fragment key={link.name}>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>{link.name} (root)</div>
                {renderTree(link.name, 1)}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* 3D Preview placeholder */}
      {links.length > 0 && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          border: '1px dashed var(--vscode-panel-border)',
          borderRadius: '4px',
          color: 'var(--vscode-descriptionForeground)',
          fontSize: '12px',
        }}>
          3D preview requires Three.js -- coming soon
        </div>
      )}
    </div>
  );
}
