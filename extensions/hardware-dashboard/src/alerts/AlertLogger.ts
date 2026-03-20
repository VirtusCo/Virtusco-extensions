// Copyright 2026 VirtusCo

import * as fs from 'fs';
import * as path from 'path';
import type { Alert } from '../types';

const LOG_DIR = '.virtus-hw';
const LOG_FILE = 'power-events.jsonl';
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Appends alerts to a JSONL file for persistent event logging.
 * Supports log rotation at 10MB and CSV export.
 */
export class AlertLogger {
  private logPath: string;
  private logDir: string;

  constructor(workspacePath: string) {
    this.logDir = path.join(workspacePath, LOG_DIR);
    this.logPath = path.join(this.logDir, LOG_FILE);
    this.ensureDir();
  }

  /** Append an alert to the JSONL log file */
  append(alert: Alert): void {
    this.ensureDir();
    this.rotateIfNeeded();

    const line = JSON.stringify(alert) + '\n';
    try {
      fs.appendFileSync(this.logPath, line, 'utf-8');
    } catch (err) {
      console.error('Failed to write alert log:', err);
    }
  }

  /** Read all logged events */
  readAll(): Alert[] {
    if (!fs.existsSync(this.logPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.map((line) => JSON.parse(line) as Alert);
    } catch {
      return [];
    }
  }

  /** Export all events to a CSV string */
  exportToCsv(): string {
    const events = this.readAll();
    const header = 'timestamp,id,severity,field,message,value,threshold\n';
    const rows = events.map((e) => {
      const ts = new Date(e.timestamp).toISOString();
      const msg = `"${e.message.replace(/"/g, '""')}"`;
      return `${ts},${e.id},${e.severity},${e.field},${msg},${e.value},${e.threshold}`;
    });
    return header + rows.join('\n');
  }

  /** Get the path to the log file */
  getLogPath(): string {
    return this.logPath;
  }

  /** Clear all logged events */
  clear(): void {
    try {
      if (fs.existsSync(this.logPath)) {
        fs.writeFileSync(this.logPath, '', 'utf-8');
      }
    } catch (err) {
      console.error('Failed to clear alert log:', err);
    }
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private rotateIfNeeded(): void {
    try {
      if (!fs.existsSync(this.logPath)) {
        return;
      }
      const stats = fs.statSync(this.logPath);
      if (stats.size >= MAX_LOG_SIZE) {
        const rotatedPath = this.logPath + '.' + Date.now() + '.bak';
        fs.renameSync(this.logPath, rotatedPath);
      }
    } catch {
      // Ignore rotation errors
    }
  }
}
