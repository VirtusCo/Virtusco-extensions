// Copyright 2026 VirtusCo

import * as vscode from 'vscode';
import type { Alert, AlertSeverity } from '../types';

/**
 * Tree data provider for the alerts sidebar view.
 * Shows active alerts with severity icons (red/yellow/blue).
 */
export class AlertsTreeProvider implements vscode.TreeDataProvider<AlertTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AlertTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private alerts: Alert[] = [];

  getTreeItem(element: AlertTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(_element?: AlertTreeItem): AlertTreeItem[] {
    if (this.alerts.length === 0) {
      return [new AlertTreeItem('No active alerts', 'info', '', 0)];
    }
    return this.alerts.map((alert) => {
      const time = new Date(alert.timestamp).toLocaleTimeString();
      return new AlertTreeItem(
        alert.message,
        alert.severity,
        `${time} | ${alert.field}`,
        alert.timestamp,
      );
    });
  }

  /** Add a new alert and refresh the tree */
  addAlert(alert: Alert): void {
    // Keep most recent first, limit to 50
    this.alerts.unshift(alert);
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(0, 50);
    }
    this.refresh();
  }

  /** Clear all alerts and refresh the tree */
  clearAlerts(): void {
    this.alerts = [];
    this.refresh();
  }

  /** Get current alert count */
  getCount(): number {
    return this.alerts.length;
  }

  /** Trigger tree refresh */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

class AlertTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    severity: AlertSeverity,
    description: string,
    timestamp: number,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.tooltip = `[${severity.toUpperCase()}] ${label}\n${new Date(timestamp).toISOString()}`;

    // Icon based on severity
    switch (severity) {
      case 'critical':
        this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
        break;
      case 'warning':
        this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
        break;
      case 'info':
        this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('charts.blue'));
        break;
    }
  }
}
