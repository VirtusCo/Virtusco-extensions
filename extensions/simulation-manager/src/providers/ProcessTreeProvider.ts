// Copyright 2026 VirtusCo
// TreeDataProvider showing tracked simulation processes with status icons

import * as vscode from 'vscode';
import { ProcessInfo } from '../types';

export class ProcessTreeProvider implements vscode.TreeDataProvider<ProcessTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ProcessTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _processes: ProcessInfo[] = [];

  updateProcesses(processes: ProcessInfo[]): void {
    this._processes = processes;
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProcessTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(_element?: ProcessTreeItem): ProcessTreeItem[] {
    if (_element) {
      return [];
    }

    if (this._processes.length === 0) {
      return [new ProcessTreeItem('No processes running', '', 'stopped', 0, 0)];
    }

    return this._processes.map((p) => {
      return new ProcessTreeItem(p.name, p.id, p.status, p.pid, p.startTime);
    });
  }
}

class ProcessTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly processId: string,
    public readonly status: 'running' | 'stopped' | 'error',
    public readonly pid: number,
    public readonly startTime: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);

    const statusIcon = status === 'running'
      ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.runAction'))
      : status === 'error'
        ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('errorForeground'))
        : new vscode.ThemeIcon('circle-outline');

    this.iconPath = statusIcon;

    if (pid > 0) {
      const uptime = startTime > 0 ? this._formatUptime(Date.now() - startTime) : '';
      this.description = `PID ${pid}${uptime ? ' | ' + uptime : ''}`;
    } else {
      this.description = '';
    }

    this.tooltip = `${label}\nStatus: ${status}\nPID: ${pid}`;
  }

  private _formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    return `${minutes}m ${remainingSecs}s`;
  }
}
