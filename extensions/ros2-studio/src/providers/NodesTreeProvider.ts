// Copyright 2026 VirtusCo
// Tree data provider for ROS 2 nodes, grouped by package

import * as vscode from 'vscode';
import { NodeHealth } from '../types';

/**
 * Tree item representing either a package group or a node.
 */
class NodeTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly nodeHealth?: NodeHealth
  ) {
    super(label, collapsibleState);

    if (nodeHealth) {
      this.description = `pub:${nodeHealth.pub_count} sub:${nodeHealth.sub_count}`;

      switch (nodeHealth.status) {
        case 'alive':
          this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'));
          break;
        case 'dead':
          this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconFailed'));
          break;
        case 'degraded':
          this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
          break;
      }

      this.tooltip = `${nodeHealth.name}\nPackage: ${nodeHealth.package}\nStatus: ${nodeHealth.status}\nPublishers: ${nodeHealth.pub_count}\nSubscribers: ${nodeHealth.sub_count}`;
    } else {
      this.iconPath = new vscode.ThemeIcon('package');
    }
  }
}

export class NodesTreeProvider implements vscode.TreeDataProvider<NodeTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<NodeTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _nodes: NodeHealth[] = [];

  /**
   * Updates the node list and refreshes the tree.
   */
  updateNodes(nodes: NodeHealth[]): void {
    this._nodes = nodes;
    this.refresh();
  }

  /**
   * Fires a tree data change event.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: NodeTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: NodeTreeItem): NodeTreeItem[] {
    if (!element) {
      // Root: group by package
      const groups = new Map<string, NodeHealth[]>();
      for (const node of this._nodes) {
        const pkg = node.package || 'unknown';
        if (!groups.has(pkg)) {
          groups.set(pkg, []);
        }
        groups.get(pkg)!.push(node);
      }

      return Array.from(groups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([pkg]) => new NodeTreeItem(
          pkg,
          vscode.TreeItemCollapsibleState.Expanded
        ));
    }

    // Children: nodes in this package
    const pkg = element.label as string;
    return this._nodes
      .filter((n) => (n.package || 'unknown') === pkg)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => new NodeTreeItem(
        n.name,
        vscode.TreeItemCollapsibleState.None,
        n
      ));
  }
}
