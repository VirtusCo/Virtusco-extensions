// Copyright 2026 VirtusCo
// Topic monitor page — table of all ROS 2 topics with Hz, status, and message preview

import React, { useState, useMemo } from 'react';
import { useRos2Store, TopicData } from '../store/ros2Store';
import { vscode } from '../vscodeApi';

const CATEGORIES = ['all', 'sensor', 'navigation', 'control', 'ai', 'bridge', 'diagnostics'] as const;

// Known topic → category mapping
const TOPIC_CATEGORIES: Record<string, string> = {
  '/scan': 'sensor',
  '/scan/processed': 'sensor',
  '/sensor_fusion': 'sensor',
  '/cmd_vel': 'control',
  '/odom': 'navigation',
  '/map': 'navigation',
  '/tf': 'navigation',
  '/diagnostics': 'diagnostics',
  '/orchestrator/state': 'control',
  '/ai_assistant/query': 'ai',
  '/ai_assistant/response': 'ai',
  '/esp32_bridge/rx': 'bridge',
  '/esp32_bridge/tx': 'bridge',
};

// Expected Hz for known topics
const EXPECTED_HZ: Record<string, number> = {
  '/scan': 7.0,
  '/scan/processed': 7.0,
  '/cmd_vel': 20.0,
  '/odom': 20.0,
  '/sensor_fusion': 10.0,
  '/diagnostics': 1.0,
  '/orchestrator/state': 1.0,
  '/esp32_bridge/rx': 10.0,
  '/esp32_bridge/tx': 10.0,
  '/map': 0.5,
  '/tf': 50.0,
};

function getStatusBadge(status: string): { bg: string; text: string } {
  switch (status) {
    case 'ok':
      return { bg: '#4caf50', text: 'OK' };
    case 'silent':
      return { bg: '#ff9800', text: 'Silent' };
    case 'missing':
      return { bg: '#f44336', text: 'Not present' };
    default:
      return { bg: '#888', text: status };
  }
}

function isHzDeviated(topicName: string, actualHz: number): boolean {
  const expected = EXPECTED_HZ[topicName];
  if (!expected || expected === 0 || actualHz === 0) {
    return false;
  }
  return Math.abs(actualHz - expected) / expected > 0.2;
}

export function TopicMonitorPage(): React.ReactElement {
  const topics = useRos2Store((s) => s.topics);
  const [filter, setFilter] = useState<string>('all');
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [subscribedTopics, setSubscribedTopics] = useState<Set<string>>(new Set());

  const topicList = useMemo(() => {
    const list = Array.from(topics.values());
    if (filter === 'all') {
      return list;
    }
    return list.filter((t) => {
      const cat = TOPIC_CATEGORIES[t.name];
      return cat === filter;
    });
  }, [topics, filter]);

  const handleSubscribe = (topicName: string) => {
    vscode.postMessage({ type: 'subscribeTopic', topic: topicName });
    setSubscribedTopics((prev) => new Set([...prev, topicName]));
  };

  const handleUnsubscribe = (topicName: string) => {
    vscode.postMessage({ type: 'unsubscribeTopic', topic: topicName });
    setSubscribedTopics((prev) => {
      const next = new Set(prev);
      next.delete(topicName);
      return next;
    });
  };

  return (
    <div style={{ padding: '12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        flexShrink: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Topic Monitor</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '4px 8px',
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              border: '1px solid var(--vscode-input-border, #444)',
              borderRadius: '3px',
              fontSize: '12px',
            }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
          <button
            onClick={() => setPaused(!paused)}
            style={{
              padding: '4px 10px',
              background: paused ? '#ff9800' : 'var(--vscode-button-secondaryBackground)',
              color: paused ? '#fff' : 'var(--vscode-button-secondaryForeground)',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{
              borderBottom: '1px solid var(--vscode-panel-border, #333)',
              position: 'sticky',
              top: 0,
              background: 'var(--vscode-editor-background)',
              zIndex: 1,
            }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Topic</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Type</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>Hz</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {topicList.map((topic) => {
              const badge = getStatusBadge(topic.status);
              const hzDeviated = isHzDeviated(topic.name, topic.hz);
              const isExpanded = expandedTopic === topic.name;
              const isSub = subscribedTopics.has(topic.name);

              return (
                <React.Fragment key={topic.name}>
                  <tr
                    onClick={() => setExpandedTopic(isExpanded ? null : topic.name)}
                    style={{
                      borderBottom: '1px solid var(--vscode-panel-border, #2a2a2a)',
                      cursor: 'pointer',
                      background: isExpanded ? 'var(--vscode-list-activeSelectionBackground, #094771)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--vscode-editor-font-family, monospace)' }}>
                      {topic.name}
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--vscode-descriptionForeground)' }}>
                      {topic.type}
                    </td>
                    <td style={{
                      padding: '6px 8px',
                      textAlign: 'center',
                      color: hzDeviated ? '#f44336' : 'inherit',
                      fontWeight: hzDeviated ? 600 : 400,
                    }}>
                      {topic.hz > 0 ? topic.hz.toFixed(1) : '--'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontWeight: 600,
                        color: '#fff',
                        background: badge.bg,
                      }}>
                        {badge.text}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          isSub ? handleUnsubscribe(topic.name) : handleSubscribe(topic.name);
                        }}
                        style={{
                          padding: '2px 8px',
                          background: isSub ? '#f44336' : 'var(--vscode-button-background)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '10px',
                        }}
                      >
                        {isSub ? 'Unsub' : 'Sub'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && topic.lastMessage && (
                    <tr>
                      <td colSpan={5} style={{
                        padding: '8px 16px',
                        background: 'var(--vscode-textBlockQuote-background, #1a1a2e)',
                        borderBottom: '1px solid var(--vscode-panel-border, #2a2a2a)',
                      }}>
                        <pre style={{
                          fontFamily: 'var(--vscode-editor-font-family, monospace)',
                          fontSize: '11px',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '200px',
                          overflow: 'auto',
                        }}>
                          {typeof topic.lastMessage === 'string'
                            ? topic.lastMessage
                            : JSON.stringify(topic.lastMessage, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {topicList.length === 0 && (
          <div style={{
            padding: '32px',
            textAlign: 'center',
            color: 'var(--vscode-descriptionForeground)',
          }}>
            No topics found. Connect to ROS 2 to see topics.
          </div>
        )}
      </div>
    </div>
  );
}
