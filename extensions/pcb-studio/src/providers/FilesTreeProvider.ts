// Copyright 2026 VirtusCo

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class SchematicFileItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly fileName: string,
    public readonly componentCount: number
  ) {
    super(fileName, vscode.TreeItemCollapsibleState.None);
    this.tooltip = filePath;
    this.description = `${componentCount} components`;
    this.iconPath = new vscode.ThemeIcon('circuit-board');
    this.command = {
      command: 'virtusPCB.loadSchematic',
      title: 'Load Schematic',
      arguments: [filePath],
    };
    this.contextValue = 'schematicFile';
  }
}

/**
 * Scans workspace for .kicad_sch files and shows them in a tree view
 * with component counts.
 */
export class FilesTreeProvider implements vscode.TreeDataProvider<SchematicFileItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SchematicFileItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _files: SchematicFileItem[] = [];

  constructor() {
    this.refresh();
  }

  public refresh(): void {
    this._files = this._scanWorkspace();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SchematicFileItem): vscode.TreeItem {
    return element;
  }

  getChildren(_element?: SchematicFileItem): Thenable<SchematicFileItem[]> {
    return Promise.resolve(this._files);
  }

  private _scanWorkspace(): SchematicFileItem[] {
    const items: SchematicFileItem[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
      return items;
    }

    for (const folder of workspaceFolders) {
      this._walkForSchematics(folder.uri.fsPath, items);
    }

    return items.sort((a, b) => a.fileName.localeCompare(b.fileName));
  }

  private _walkForSchematics(dir: string, items: SchematicFileItem[]): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'build') {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          this._walkForSchematics(fullPath, items);
        } else if (entry.isFile() && entry.name.endsWith('.kicad_sch')) {
          const componentCount = this._quickComponentCount(fullPath);
          items.push(new SchematicFileItem(fullPath, entry.name, componentCount));
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  private _quickComponentCount(filePath: string): number {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Quick count: number of top-level (symbol entries
      const matches = content.match(/\(symbol\s+\(lib_id/g);
      return matches ? matches.length : 0;
    } catch {
      return 0;
    }
  }
}
