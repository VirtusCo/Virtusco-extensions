// Copyright 2026 VirtusCo
// ROS 2 bag recording, playback, and file management

import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { BagFile, BagPreset } from '../types';
import { launchCmdParts, spawnOpts } from '../platform/PlatformUtils';

export const BAG_PRESETS: BagPreset[] = [
  {
    id: 'all',
    label: 'All Topics',
    topics: ['-a'],
  },
  {
    id: 'nav2_debug',
    label: 'Nav2 Debug',
    topics: ['/cmd_vel', '/odom', '/scan', '/tf', '/tf_static', '/map', '/plan', '/local_plan'],
  },
  {
    id: 'sensor_fusion',
    label: 'Sensor Fusion',
    topics: ['/scan', '/scan/processed', '/environment', '/diagnostics', '/porter/health_status'],
  },
  {
    id: 'ai_interaction',
    label: 'AI Interaction',
    topics: ['/porter/ai_query', '/porter/ai_response', '/porter/state', '/cmd_vel'],
  },
];

export class BagManager {
  private _recordProc: ChildProcess | null = null;
  private _playProc: ChildProcess | null = null;
  private _recordStartTime = 0;
  private _onRecordingChange?: (recording: boolean) => void;

  setOnRecordingChange(callback: (recording: boolean) => void): void {
    this._onRecordingChange = callback;
  }

  get isRecording(): boolean {
    return this._recordProc !== null;
  }

  get recordingElapsed(): number {
    if (!this._recordStartTime) return 0;
    return Math.floor((Date.now() - this._recordStartTime) / 1000);
  }

  scanBags(dir: string): BagFile[] {
    if (!fs.existsSync(dir)) {
      return [];
    }

    const bags: BagFile[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // ROS 2 bag directories contain metadata.yaml and .mcap or .db3 files
        const metaPath = path.join(fullPath, 'metadata.yaml');
        if (fs.existsSync(metaPath)) {
          const size = this._getDirSize(fullPath);
          bags.push({
            name: entry.name,
            path: fullPath,
            size_mb: Math.round((size / (1024 * 1024)) * 100) / 100,
            duration_s: this._inferDuration(entry.name),
            topics_count: this._countTopics(metaPath),
            annotations: [],
          });
        }
      } else if (entry.name.endsWith('.mcap') || entry.name.endsWith('.db3')) {
        const stat = fs.statSync(fullPath);
        bags.push({
          name: entry.name,
          path: fullPath,
          size_mb: Math.round((stat.size / (1024 * 1024)) * 100) / 100,
          duration_s: this._inferDuration(entry.name),
          topics_count: 0,
          annotations: [],
        });
      }
    }

    return bags;
  }

  startRecording(topics: string[], name: string): void {
    if (this._recordProc) {
      return;
    }

    const args = ['bag', 'record', '-o', name, ...topics];
    const cmd = `ros2 ${args.join(' ')}`;
    const { command, args: cmdArgs } = launchCmdParts(cmd);
    const opts = spawnOpts();

    this._recordProc = spawn(command, cmdArgs, opts);
    this._recordStartTime = Date.now();

    this._recordProc.on('exit', () => {
      this._recordProc = null;
      this._recordStartTime = 0;
      this._onRecordingChange?.(false);
    });

    this._recordProc.on('error', () => {
      this._recordProc = null;
      this._recordStartTime = 0;
      this._onRecordingChange?.(false);
    });

    this._onRecordingChange?.(true);
  }

  stopRecording(): void {
    if (this._recordProc) {
      try {
        if (process.platform === 'win32') {
          this._recordProc.kill();
        } else {
          this._recordProc.kill('SIGINT');
        }
      } catch {
        // Process already exited
      }
      this._recordProc = null;
      this._recordStartTime = 0;
      this._onRecordingChange?.(false);
    }
  }

  playBag(bagPath: string, rate: number): void {
    this.stopPlayback();

    const cmd = `ros2 bag play ${bagPath} --rate ${rate}`;
    const { command, args } = launchCmdParts(cmd);
    const opts = spawnOpts();

    this._playProc = spawn(command, args, opts);

    this._playProc.on('exit', () => {
      this._playProc = null;
    });

    this._playProc.on('error', () => {
      this._playProc = null;
    });
  }

  stopPlayback(): void {
    if (this._playProc) {
      try {
        this._playProc.kill();
      } catch {
        // Process already exited
      }
      this._playProc = null;
    }
  }

  deleteBag(bagPath: string): void {
    if (fs.existsSync(bagPath)) {
      const stat = fs.statSync(bagPath);
      if (stat.isDirectory()) {
        fs.rmSync(bagPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(bagPath);
      }
    }
  }

  private _getDirSize(dirPath: string): number {
    let size = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isFile()) {
          size += fs.statSync(fullPath).size;
        }
      }
    } catch {
      // Ignore read errors
    }
    return size;
  }

  private _inferDuration(name: string): number {
    // Try to extract duration from common naming patterns like "bag_60s" or "2024-01-01_120s"
    const match = name.match(/(\d+)s/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private _countTopics(metadataPath: string): number {
    try {
      const content = fs.readFileSync(metadataPath, 'utf-8');
      const topicMatches = content.match(/topic_metadata:/g);
      return topicMatches ? topicMatches.length : 0;
    } catch {
      return 0;
    }
  }
}
