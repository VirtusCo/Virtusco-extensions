// Copyright 2026 VirtusCo
// Board & Peripherals sidebar TreeView provider

import * as vscode from 'vscode';
import { getBoardById, BoardDefinition, PeripheralCapability } from '../project/boardDatabase';

type TreeItem = BoardHeaderItem | PeripheralItem | InfoItem;

class BoardHeaderItem extends vscode.TreeItem {
  constructor(
    public readonly board: BoardDefinition,
  ) {
    super(board.name, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${board.vendor} · ${board.arch}`;
    this.iconPath = new vscode.ThemeIcon('circuit-board');
    this.contextValue = 'board';
  }
}

class PeripheralItem extends vscode.TreeItem {
  constructor(
    public readonly peripheral: PeripheralCapability,
  ) {
    super(peripheral.label, vscode.TreeItemCollapsibleState.None);

    const details: string[] = [];
    if (peripheral.instances) details.push(`${peripheral.instances} instances`);
    if (peripheral.channels) details.push(`${peripheral.channels} channels`);
    if (peripheral.pins) details.push(`${peripheral.pins} pins`);
    this.description = details.join(', ');

    if (peripheral.notes) {
      this.tooltip = peripheral.notes;
    }

    this.iconPath = peripheralIcon(peripheral.type);
    this.contextValue = 'peripheral';
  }
}

class InfoItem extends vscode.TreeItem {
  constructor(label: string, description: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon('info');
    this.contextValue = 'info';
  }
}

export class BoardTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _boardId: string;

  constructor() {
    this._boardId = vscode.workspace.getConfiguration('virtus').get('selectedBoard', 'esp32_devkitc_wroom');

    // Listen for config changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('virtus.selectedBoard')) {
        this._boardId = vscode.workspace.getConfiguration('virtus').get('selectedBoard', 'esp32_devkitc_wroom');
        this._onDidChangeTreeData.fire(undefined);
      }
    });
  }

  get currentBoardId(): string {
    return this._boardId;
  }

  get currentBoard(): BoardDefinition | undefined {
    return getBoardById(this._boardId);
  }

  refresh(): void {
    this._boardId = vscode.workspace.getConfiguration('virtus').get('selectedBoard', 'esp32_devkitc_wroom');
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      // Root level
      const board = getBoardById(this._boardId);
      if (!board) {
        return [new InfoItem('No board selected', 'Click "Select Board"')];
      }
      return [
        new BoardHeaderItem(board),
      ];
    }

    if (element instanceof BoardHeaderItem) {
      const board = element.board;
      const items: TreeItem[] = [
        new InfoItem('CPU', board.cpu),
        new InfoItem('Flash', board.flash),
        new InfoItem('RAM', board.ram),
        new InfoItem('west -b', board.westBoard),
      ];

      // Add separator-like item
      items.push(new InfoItem('── Peripherals ──', `${board.peripherals.length} available`));

      // Add peripheral items
      for (const p of board.peripherals) {
        items.push(new PeripheralItem(p));
      }

      return items;
    }

    return [];
  }
}

function peripheralIcon(type: string): vscode.ThemeIcon {
  switch (type) {
    case 'gpio': return new vscode.ThemeIcon('plug');
    case 'pwm': return new vscode.ThemeIcon('pulse');
    case 'uart': return new vscode.ThemeIcon('arrow-swap');
    case 'i2c': return new vscode.ThemeIcon('git-merge');
    case 'spi': return new vscode.ThemeIcon('layers');
    case 'adc': return new vscode.ThemeIcon('graph');
    case 'ble': return new vscode.ThemeIcon('radio-tower');
    case 'wifi': return new vscode.ThemeIcon('globe');
    case 'usb': return new vscode.ThemeIcon('plug');
    case 'dac': return new vscode.ThemeIcon('graph-line');
    case 'touch': return new vscode.ThemeIcon('hand');
    default: return new vscode.ThemeIcon('extensions');
  }
}
