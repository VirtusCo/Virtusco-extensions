// Copyright 2026 VirtusCo
// Build & Flash sidebar TreeView provider

import * as vscode from 'vscode';

class ActionItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    command: string,
    icon: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon(icon);
    this.command = {
      command,
      title: label,
    };
    this.contextValue = 'action';
  }
}

export class ActionsTreeProvider implements vscode.TreeDataProvider<ActionItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ActionItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ActionItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ActionItem[] {
    const board = vscode.workspace.getConfiguration('virtus').get('selectedBoard', 'esp32_devkitc_wroom');
    const port = vscode.workspace.getConfiguration('virtus').get('flashPort', '/dev/ttyUSB0');

    return [
      new ActionItem('Open Canvas', 'Node editor', 'virtus.openBuilder', 'circuit-board'),
      new ActionItem('Generate Code', 'From canvas', 'virtus.generateCode', 'code'),
      new ActionItem('Build', board, 'virtus.buildFirmware', 'tools'),
      new ActionItem('Flash', String(port), 'virtus.flashFirmware', 'zap'),
      new ActionItem('Serial Monitor', String(port), 'virtus.openSerialMonitor', 'terminal'),
      new ActionItem('Menuconfig', 'Kconfig editor', 'virtus.runMenuconfig', 'settings-gear'),
      new ActionItem('Clean Build', 'Pristine rebuild', 'virtus.cleanBuild', 'trash'),
    ];
  }
}
