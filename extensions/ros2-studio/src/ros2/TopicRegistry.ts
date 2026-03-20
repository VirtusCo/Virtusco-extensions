// Copyright 2026 VirtusCo
// Registry of known Porter robot ROS 2 topics

import { TopicDef } from '../types';

/**
 * All 13 known Porter robot topics with expected types and publish rates.
 */
export const VIRTUS_TOPICS: TopicDef[] = [
  {
    name: '/scan',
    type: 'sensor_msgs/msg/LaserScan',
    category: 'sensor',
    hz_expected: 7.0,
  },
  {
    name: '/scan/processed',
    type: 'sensor_msgs/msg/LaserScan',
    category: 'sensor',
    hz_expected: 7.0,
  },
  {
    name: '/cmd_vel',
    type: 'geometry_msgs/msg/Twist',
    category: 'control',
    hz_expected: 20.0,
  },
  {
    name: '/odom',
    type: 'nav_msgs/msg/Odometry',
    category: 'navigation',
    hz_expected: 20.0,
  },
  {
    name: '/sensor_fusion',
    type: 'sensor_msgs/msg/Range',
    category: 'sensor',
    hz_expected: 10.0,
  },
  {
    name: '/diagnostics',
    type: 'diagnostic_msgs/msg/DiagnosticArray',
    category: 'diagnostics',
    hz_expected: 1.0,
  },
  {
    name: '/orchestrator/state',
    type: 'std_msgs/msg/String',
    category: 'control',
    hz_expected: 1.0,
  },
  {
    name: '/ai_assistant/query',
    type: 'std_msgs/msg/String',
    category: 'ai',
    hz_expected: 0.0,
  },
  {
    name: '/ai_assistant/response',
    type: 'std_msgs/msg/String',
    category: 'ai',
    hz_expected: 0.0,
  },
  {
    name: '/esp32_bridge/rx',
    type: 'std_msgs/msg/UInt8MultiArray',
    category: 'bridge',
    hz_expected: 10.0,
  },
  {
    name: '/esp32_bridge/tx',
    type: 'std_msgs/msg/UInt8MultiArray',
    category: 'bridge',
    hz_expected: 10.0,
  },
  {
    name: '/map',
    type: 'nav_msgs/msg/OccupancyGrid',
    category: 'navigation',
    hz_expected: 0.5,
  },
  {
    name: '/tf',
    type: 'tf2_msgs/msg/TFMessage',
    category: 'navigation',
    hz_expected: 50.0,
  },
];

/**
 * Lookup a topic definition by name.
 */
export function findTopicDef(name: string): TopicDef | undefined {
  return VIRTUS_TOPICS.find((t) => t.name === name);
}

/**
 * Get all topics in a given category.
 */
export function getTopicsByCategory(category: TopicDef['category']): TopicDef[] {
  return VIRTUS_TOPICS.filter((t) => t.category === category);
}
