// Copyright 2026 VirtusCo

import * as vscode from 'vscode';
import { checkAll, install, openExtension } from '../installer/ExtensionInstaller';
import { ExtensionInfo } from '../types';

class ExtensionTreeItem extends vscode.TreeItem {
  constructor(public readonly ext: ExtensionInfo) {
    super(ext.name, vscode.TreeItemCollapsibleState.None);

    this.description = ext.installed
      ? `v${ext.version || '?.?.?'}`
      : 'Not installed';

    this.tooltip = ext.description;

    this.iconPath = new vscode.ThemeIcon(
      ext.installed ? 'check' : 'cloud-download',
      ext.installed
        ? new vscode.ThemeColor('charts.green')
        : new vscode.ThemeColor('charts.yellow')
    );

    this.contextValue = ext.installed ? 'installed' : 'notInstalled';

    this.command = {
      command: ext.installed
        ? 'virtuscoSuite.treeOpenExtension'
        : 'virtuscoSuite.treeInstallExtension',
      title: ext.installed ? 'Open' : 'Install',
      arguments: [ext],
    };
  }
}

export class ExtensionsTreeProvider
  implements vscode.TreeDataProvider<ExtensionTreeItem>
{
  private _onDidChangeTreeData =
    new vscode.EventEmitter<ExtensionTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ExtensionTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ExtensionTreeItem[] {
    const extensions = checkAll();
    return extensions.map((ext) => new ExtensionTreeItem(ext));
  }

  public registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'virtuscoSuite.treeOpenExtension',
        (ext: ExtensionInfo) => {
          openExtension(ext.openCommand);
        }
      )
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'virtuscoSuite.treeInstallExtension',
        async (ext: ExtensionInfo) => {
          await install(ext.id);
          this.refresh();
        }
      )
    );
  }
}
