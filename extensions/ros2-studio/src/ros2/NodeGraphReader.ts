// Copyright 2026 VirtusCo
// Builds a node graph from live ROS 2 introspection data

import { ROS2Bridge } from './ROS2Bridge';
import { NodeHealth, GraphEdge, NodeGraphData } from '../types';

/**
 * Required nodes — if these are not found, they are reported as dead.
 */
export const REQUIRED_NODES: string[] = [
  '/ydlidar_driver',
  '/porter_lidar_processor',
  '/porter_orchestrator',
  '/esp32_motor_bridge',
  '/esp32_sensor_bridge',
  '/porter_ai_assistant',
];

/**
 * Color mapping per package name (used by webview for styling).
 */
export const PACKAGE_COLORS: Record<string, string> = {
  ydlidar_driver: '#2196f3',      // blue
  porter_lidar_processor: '#00bcd4', // cyan
  porter_orchestrator: '#9c27b0',    // purple
  porter_esp32_bridge: '#ff9800',    // orange
  porter_ai_assistant: '#4caf50',    // green
  nav2: '#9e9e9e',                   // grey
};

/**
 * Infers the package name from a node name.
 */
function inferPackage(nodeName: string): string {
  const clean = nodeName.replace(/^\//, '');

  if (clean.startsWith('ydlidar')) {
    return 'ydlidar_driver';
  }
  if (clean.includes('lidar_processor')) {
    return 'porter_lidar_processor';
  }
  if (clean.includes('orchestrator') || clean.includes('health_monitor') || clean.includes('state_machine')) {
    return 'porter_orchestrator';
  }
  if (clean.includes('esp32') || clean.includes('motor_bridge') || clean.includes('sensor_bridge')) {
    return 'porter_esp32_bridge';
  }
  if (clean.includes('ai_assistant') || clean.includes('virtue')) {
    return 'porter_ai_assistant';
  }
  if (clean.includes('nav2') || clean.includes('planner') || clean.includes('controller') || clean.includes('bt_navigator') || clean.includes('amcl') || clean.includes('slam')) {
    return 'nav2';
  }

  return 'unknown';
}

/**
 * Reads live node/topic data and builds a graph structure.
 */
export class NodeGraphReader {
  constructor(private readonly bridge: ROS2Bridge) {}

  /**
   * Queries all live nodes and their connections to build a full graph.
   */
  async buildGraph(): Promise<NodeGraphData> {
    const nodeNames = await this.bridge.getNodeList();
    const nodeMap = new Map<string, NodeHealth>();
    const edges: GraphEdge[] = [];

    // Build node entries
    for (const name of nodeNames) {
      const info = await this.bridge.getNodeInfo(name);
      const pkg = inferPackage(name);

      nodeMap.set(name, {
        name,
        package: pkg,
        status: 'alive',
        last_seen: Date.now(),
        pub_count: info.publishers.length,
        sub_count: info.subscribers.length,
      });

      // Build edges from publishers
      for (const pub of info.publishers) {
        // Find subscribers of this topic from other nodes
        for (const otherName of nodeNames) {
          if (otherName === name) {
            continue;
          }
          const otherInfo = await this.bridge.getNodeInfo(otherName);
          const subscribesTo = otherInfo.subscribers.find((s) => s.topic === pub.topic);
          if (subscribesTo) {
            // Avoid duplicate edges
            const exists = edges.some(
              (e) => e.source === name && e.target === otherName && e.topic === pub.topic
            );
            if (!exists) {
              edges.push({
                source: name,
                target: otherName,
                topic: pub.topic,
              });
            }
          }
        }
      }
    }

    // Check for required dead nodes
    for (const required of REQUIRED_NODES) {
      if (!nodeMap.has(required)) {
        nodeMap.set(required, {
          name: required,
          package: inferPackage(required),
          status: 'dead',
          last_seen: 0,
          pub_count: 0,
          sub_count: 0,
        });
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
    };
  }
}
