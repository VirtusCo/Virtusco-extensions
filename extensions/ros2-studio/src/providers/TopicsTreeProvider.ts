// Copyright 2026 VirtusCo
// Tree data provider for ROS 2 topics, grouped by Virtus vs Other

import * as vscode from 'vscode';
import { DiscoveredTopic } from '../types';
import { VIRTUS_TOPICS } from '../ros2/TopicRegistry';

/**
 * Tree item representing a topic group or individual topic.
 */
class TopicTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly topicInfo?: DiscoveredTopic
  ) {
    super(label, collapsibleState);

    if (topicInfo) {
      this.description = `${topicInfo.type} | ${topicInfo.hz > 0 ? topicInfo.hz.toFixed(1) + ' Hz' : '--'}`;

      switch (topicInfo.status) {
        case 'ok':
          this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'));
          break;
        case 'silent':
          this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('list.warningForeground'));
          break;
        case 'missing':
          this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconFailed'));
          break;
      }

      this.tooltip = `${topicInfo.name}\nType: ${topicInfo.type}\nHz: ${topicInfo.hz > 0 ? topicInfo.hz.toFixed(1) : 'N/A'}\nStatus: ${topicInfo.status}`;
    } else {
      this.iconPath = new vscode.ThemeIcon('list-tree');
    }
  }
}

export class TopicsTreeProvider implements vscode.TreeDataProvider<TopicTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TopicTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _topics: DiscoveredTopic[] = [];

  /**
   * Updates the topic list and refreshes the tree.
   */
  updateTopics(topics: DiscoveredTopic[]): void {
    this._topics = topics;
    this.refresh();
  }

  /**
   * Fires a tree data change event.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TopicTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TopicTreeItem): TopicTreeItem[] {
    if (!element) {
      // Root: two groups
      const items: TopicTreeItem[] = [];

      const virtusTopicNames = new Set(VIRTUS_TOPICS.map((t) => t.name));
      const hasVirtus = this._topics.some((t) => virtusTopicNames.has(t.name));
      const hasOther = this._topics.some((t) => !virtusTopicNames.has(t.name));

      items.push(new TopicTreeItem(
        `Virtus Topics (${this._topics.filter((t) => virtusTopicNames.has(t.name)).length})`,
        vscode.TreeItemCollapsibleState.Expanded
      ));

      if (hasOther || !hasVirtus) {
        items.push(new TopicTreeItem(
          `Other Topics (${this._topics.filter((t) => !virtusTopicNames.has(t.name)).length})`,
          vscode.TreeItemCollapsibleState.Collapsed
        ));
      }

      return items;
    }

    // Children: topics in the group
    const isVirtusGroup = (element.label as string).startsWith('Virtus');
    const virtusTopicNames = new Set(VIRTUS_TOPICS.map((t) => t.name));

    if (isVirtusGroup) {
      // Show all Virtus topics (even missing ones)
      const discoveredMap = new Map(this._topics.map((t) => [t.name, t]));

      return VIRTUS_TOPICS.map((def) => {
        const discovered = discoveredMap.get(def.name);
        const topicInfo: DiscoveredTopic = discovered ?? {
          name: def.name,
          type: def.type,
          hz: 0,
          status: 'missing',
        };
        return new TopicTreeItem(
          def.name,
          vscode.TreeItemCollapsibleState.None,
          topicInfo
        );
      });
    }

    // Other topics
    return this._topics
      .filter((t) => !virtusTopicNames.has(t.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => new TopicTreeItem(
        t.name,
        vscode.TreeItemCollapsibleState.None,
        t
      ));
  }
}
