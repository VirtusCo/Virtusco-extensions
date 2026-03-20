// Copyright 2026 VirtusCo
// ROS 2 CLI bridge — runs ros2 commands (via WSL on Windows)

import * as vscode from 'vscode';
import { ros2Cmd, execAsync, spawnOpts } from '../platform/PlatformUtils';
import { ROS2Status } from '../types';

/**
 * Manages interaction with the ROS 2 environment via CLI commands.
 * On Windows, all commands are prefixed with `wsl` automatically.
 */
export class ROS2Bridge {
  private _status: ROS2Status = {
    connected: false,
    version: '',
    rosbridgeRunning: false,
  };

  private readonly _outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this._outputChannel = outputChannel;
  }

  get status(): ROS2Status {
    return { ...this._status };
  }

  /**
   * Checks whether ROS 2 is available and captures the version string.
   */
  async checkRos2Available(): Promise<ROS2Status> {
    try {
      const cmd = ros2Cmd('ros2 --version');
      const output = await execAsync(cmd, spawnOpts());
      this._status.connected = true;
      this._status.version = output.trim();
      this._outputChannel.appendLine(`[ROS2Bridge] Connected: ${this._status.version}`);
    } catch {
      this._status.connected = false;
      this._status.version = '';
      this._outputChannel.appendLine('[ROS2Bridge] ROS 2 not available');
    }

    return this.status;
  }

  /**
   * Returns a list of active topics with their message types.
   */
  async getTopicList(): Promise<{ name: string; type: string }[]> {
    try {
      const cmd = ros2Cmd('ros2 topic list -t');
      const output = await execAsync(cmd, spawnOpts());

      const topics: { name: string; type: string }[] = [];
      for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        // Format: /topic_name [msg_type]
        const match = trimmed.match(/^(\S+)\s+\[([^\]]+)\]/);
        if (match) {
          topics.push({ name: match[1], type: match[2] });
        }
      }
      return topics;
    } catch (err) {
      this._outputChannel.appendLine(
        `[ROS2Bridge] getTopicList failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return [];
    }
  }

  /**
   * Returns a list of active node names.
   */
  async getNodeList(): Promise<string[]> {
    try {
      const cmd = ros2Cmd('ros2 node list');
      const output = await execAsync(cmd, spawnOpts());

      return output
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    } catch (err) {
      this._outputChannel.appendLine(
        `[ROS2Bridge] getNodeList failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return [];
    }
  }

  /**
   * Gets detailed info about a specific node (publishers, subscribers).
   */
  async getNodeInfo(nodeName: string): Promise<{
    publishers: { topic: string; type: string }[];
    subscribers: { topic: string; type: string }[];
  }> {
    try {
      const cmd = ros2Cmd(`ros2 node info ${nodeName}`);
      const output = await execAsync(cmd, spawnOpts());

      const publishers: { topic: string; type: string }[] = [];
      const subscribers: { topic: string; type: string }[] = [];

      let section: 'none' | 'pub' | 'sub' = 'none';

      for (const line of output.split('\n')) {
        const trimmed = line.trim();

        if (trimmed.includes('Publishers:')) {
          section = 'pub';
          continue;
        }
        if (trimmed.includes('Subscribers:')) {
          section = 'sub';
          continue;
        }
        if (trimmed.includes('Service Servers:') || trimmed.includes('Service Clients:') || trimmed.includes('Action Servers:') || trimmed.includes('Action Clients:')) {
          section = 'none';
          continue;
        }

        // Lines like: /topic_name: msg/Type
        const match = trimmed.match(/^(\S+):\s*(\S+)/);
        if (match && section !== 'none') {
          const entry = { topic: match[1], type: match[2] };
          if (section === 'pub') {
            publishers.push(entry);
          } else {
            subscribers.push(entry);
          }
        }
      }

      return { publishers, subscribers };
    } catch (err) {
      this._outputChannel.appendLine(
        `[ROS2Bridge] getNodeInfo(${nodeName}) failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return { publishers: [], subscribers: [] };
    }
  }

  /**
   * Echoes a single message from a topic and returns the raw text.
   */
  async echoTopicOnce(topicName: string): Promise<string> {
    try {
      const cmd = ros2Cmd(`ros2 topic echo ${topicName} --once`);
      const output = await execAsync(cmd, { ...spawnOpts(), timeout: 10000 });
      return output;
    } catch (err) {
      this._outputChannel.appendLine(
        `[ROS2Bridge] echoTopicOnce(${topicName}) failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return '';
    }
  }

  /**
   * Measures the publish rate (Hz) of a topic.
   */
  async getTopicHz(topicName: string): Promise<number> {
    try {
      const cmd = ros2Cmd(`ros2 topic hz ${topicName} --window 5`);
      // topic hz runs indefinitely; we use a short timeout and parse what we get
      const output = await execAsync(cmd, { ...spawnOpts(), timeout: 8000 });

      // Parse "average rate: 10.00"
      const match = output.match(/average rate:\s*([\d.]+)/);
      if (match) {
        return parseFloat(match[1]);
      }
      return 0;
    } catch (err) {
      // Timeout is expected — parse stderr/stdout from the error
      const errMsg = err instanceof Error ? err.message : String(err);
      const match = errMsg.match(/average rate:\s*([\d.]+)/);
      if (match) {
        return parseFloat(match[1]);
      }
      return 0;
    }
  }
}
