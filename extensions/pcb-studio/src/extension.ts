// Copyright 2026 VirtusCo

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseKicadSch } from './kicad/SchematicParser';
import { extractNetlist } from './kicad/NetlistExtractor';
import { extractBOM, formatBOMAsCSV } from './kicad/BOMExtractor';
import { renderToSVG } from './kicad/SchematicRenderer';
import { readDTSAliases, checkSync } from './sync/SyncChecker';
import { diffSchematics } from './diff/SchematicDiffer';
import { analyze } from './impact/FirmwareImpactAnalyzer';
import { getLibrary, exportToKicad } from './builder/SchematicBuilder';
import { StatusViewProvider } from './providers/StatusViewProvider';
import { FilesTreeProvider } from './providers/FilesTreeProvider';
import { PCBStudioPanel } from './panel/PCBStudioPanel';
import { KicadSchematic, WebviewMessage, BuilderSchematic } from './types';
import { PCBEngine } from './pcb/PCBEngine';
import { FOOTPRINT_LIBRARY } from './pcb/FootprintLibrary';
import { DesignRuleChecker } from './drc/DesignRuleChecker';
import { GerberGenerator } from './gerber/GerberGenerator';
import { CostEstimator } from './cost/CostEstimator';
import { NetlistExporter } from './pcb/NetlistExporter';

let currentSchematic: KicadSchematic | undefined;
let currentSchematicPath: string = '';
let statusProvider: StatusViewProvider;
let filesProvider: FilesTreeProvider;

const pcbEngine = new PCBEngine();
const drcChecker = new DesignRuleChecker();
const gerberGenerator = new GerberGenerator();
const costEstimator = new CostEstimator();
const netlistExporter = new NetlistExporter();

export function activate(context: vscode.ExtensionContext): void {
  // Register sidebar providers
  statusProvider = new StatusViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      StatusViewProvider.viewType,
      statusProvider
    )
  );

  filesProvider = new FilesTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('virtusPCB.filesView', filesProvider)
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('virtusPCB.openPCBStudio', () => {
      const panel = PCBStudioPanel.createOrShow(context.extensionUri);
      setupPanelHandlers(panel, context);

      // If we have a loaded schematic, send it
      if (currentSchematic) {
        const svg = renderToSVG(currentSchematic);
        const netlist = extractNetlist(currentSchematic);
        panel.sendSchematic(svg, {
          components: currentSchematic.symbols.length,
          nets: netlist.size,
          sheets: 1,
        });
      }

      // Always send builder library
      panel.sendBuilderLibrary(getLibrary());
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtusPCB.loadSchematic', async (filePath?: string) => {
      let schPath = filePath;

      if (!schPath) {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectMany: false,
          filters: { 'KiCad Schematic': ['kicad_sch'] },
          title: 'Select KiCad Schematic',
        });

        if (!uris || uris.length === 0) {
          return;
        }
        schPath = uris[0].fsPath;
      }

      try {
        const content = fs.readFileSync(schPath, 'utf-8');
        currentSchematic = parseKicadSch(content);
        currentSchematicPath = schPath;

        const svg = renderToSVG(currentSchematic);
        const netlist = extractNetlist(currentSchematic);
        const bom = extractBOM(currentSchematic);

        // Update status
        statusProvider.updateStatus(
          schPath,
          'none',
          currentSchematic.symbols.length,
          netlist.size
        );

        // Refresh file tree
        filesProvider.refresh();

        // Send to panel if open
        if (PCBStudioPanel.currentPanel) {
          PCBStudioPanel.currentPanel.sendSchematic(svg, {
            components: currentSchematic.symbols.length,
            nets: netlist.size,
            sheets: 1,
          });
          PCBStudioPanel.currentPanel.sendBOM(bom);
        }

        vscode.window.showInformationMessage(
          `Loaded schematic: ${path.basename(schPath)} (${currentSchematic.symbols.length} components, ${netlist.size} nets)`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to load schematic: ${message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtusPCB.runSyncCheck', async () => {
      if (!currentSchematic) {
        vscode.window.showWarningMessage('No schematic loaded. Load a schematic first.');
        return;
      }

      const config = vscode.workspace.getConfiguration('virtusPCB');
      let overlayPath = config.get<string>('defaultOverlayPath', '');

      if (!overlayPath) {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectMany: false,
          filters: { 'DTS Overlay': ['overlay', 'dts'] },
          title: 'Select DTS Overlay File',
        });

        if (!uris || uris.length === 0) {
          return;
        }
        overlayPath = uris[0].fsPath;
      }

      try {
        const netlist = extractNetlist(currentSchematic);
        const dtsAliases = readDTSAliases(overlayPath);
        const results = checkSync(netlist, dtsAliases);

        const okCount = results.filter((r) => r.status === 'ok').length;
        const hasIssues = results.some((r) => r.status !== 'ok');

        statusProvider.updateStatus(
          currentSchematicPath,
          hasIssues ? 'issues' : 'ok',
          currentSchematic.symbols.length,
          netlist.size
        );

        if (PCBStudioPanel.currentPanel) {
          PCBStudioPanel.currentPanel.sendSyncResults(results);
        }

        vscode.window.showInformationMessage(
          `Sync check complete: ${okCount}/${results.length} OK`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Sync check failed: ${message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtusPCB.exportBOM', async () => {
      if (!currentSchematic) {
        vscode.window.showWarningMessage('No schematic loaded. Load a schematic first.');
        return;
      }

      const bom = extractBOM(currentSchematic);
      const csv = formatBOMAsCSV(bom);

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(
          currentSchematicPath.replace('.kicad_sch', '_bom.csv')
        ),
        filters: { 'CSV': ['csv'] },
        title: 'Export BOM',
      });

      if (saveUri) {
        fs.writeFileSync(saveUri.fsPath, csv, 'utf-8');
        vscode.window.showInformationMessage(
          `BOM exported: ${bom.length} entries to ${path.basename(saveUri.fsPath)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtusPCB.runDiff', async () => {
      if (!currentSchematicPath) {
        vscode.window.showWarningMessage('No schematic loaded. Load a schematic first.');
        return;
      }

      const oldRef = await vscode.window.showInputBox({
        prompt: 'Old git ref (commit/branch)',
        value: 'HEAD~1',
        title: 'Schematic Diff - Old Version',
      });

      const newRef = await vscode.window.showInputBox({
        prompt: 'New git ref (commit/branch)',
        value: 'HEAD',
        title: 'Schematic Diff - New Version',
      });

      if (!oldRef || !newRef) {
        return;
      }

      try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const relPath = path.relative(workspaceRoot, currentSchematicPath).replace(/\\/g, '/');

        // Get old version from git
        const { execSync } = await import('child_process');
        const oldContent = execSync(`git show ${oldRef}:${relPath}`, {
          cwd: workspaceRoot,
          encoding: 'utf-8',
        });
        const newContent = execSync(`git show ${newRef}:${relPath}`, {
          cwd: workspaceRoot,
          encoding: 'utf-8',
        });

        const oldSch = parseKicadSch(oldContent);
        const newSch = parseKicadSch(newContent);
        const diff = diffSchematics(oldSch, newSch);

        if (PCBStudioPanel.currentPanel) {
          PCBStudioPanel.currentPanel.sendDiff(diff);

          // Run impact analysis
          const impacts = analyze(diff, workspaceRoot);
          PCBStudioPanel.currentPanel.sendImpact(impacts);
        }

        const totalChanges =
          diff.nets_added.length +
          diff.nets_removed.length +
          diff.nets_renamed.length +
          diff.components_added.length +
          diff.components_removed.length +
          diff.pins_moved.length;

        vscode.window.showInformationMessage(
          `Diff complete: ${totalChanges} changes detected`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Diff failed: ${message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtusPCB.createSchematic', () => {
      const panel = PCBStudioPanel.createOrShow(context.extensionUri);
      setupPanelHandlers(panel, context);
      panel.sendBuilderLibrary(getLibrary());
      panel.sendInfo('Builder mode: drag components from the palette to create a schematic.');
    })
  );

  // Watch for .kicad_sch file changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.kicad_sch');
  watcher.onDidCreate(() => filesProvider.refresh());
  watcher.onDidDelete(() => filesProvider.refresh());
  watcher.onDidChange(() => filesProvider.refresh());
  context.subscriptions.push(watcher);
}

function setupPanelHandlers(panel: PCBStudioPanel, context: vscode.ExtensionContext): void {
  panel.onMessage(async (message: WebviewMessage) => {
    switch (message.type) {
      case 'loadSchematic':
        vscode.commands.executeCommand('virtusPCB.loadSchematic', message.path);
        break;

      case 'runSyncCheck':
        vscode.commands.executeCommand('virtusPCB.runSyncCheck');
        break;

      case 'exportBOM':
        vscode.commands.executeCommand('virtusPCB.exportBOM');
        break;

      case 'runDiff':
        vscode.commands.executeCommand('virtusPCB.runDiff');
        break;

      case 'openExternal':
        vscode.env.openExternal(vscode.Uri.parse(message.url));
        break;

      case 'openFile': {
        const doc = await vscode.workspace.openTextDocument(message.path);
        const editor = await vscode.window.showTextDocument(doc);
        if (message.line) {
          const position = new vscode.Position(message.line - 1, 0);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(new vscode.Range(position, position));
        }
        break;
      }

      case 'createIssue':
        vscode.env.openExternal(
          vscode.Uri.parse(
            `https://github.com/austin207/Porter-ROS/issues/new?title=${encodeURIComponent(message.title)}&body=${encodeURIComponent(message.body)}`
          )
        );
        break;

      case 'exportKicad': {
        const kicadContent = exportToKicad(message.schematic);
        const saveUri = await vscode.window.showSaveDialog({
          filters: { 'KiCad Schematic': ['kicad_sch'] },
          title: 'Export as KiCad Schematic',
        });
        if (saveUri) {
          fs.writeFileSync(saveUri.fsPath, kicadContent, 'utf-8');
          vscode.window.showInformationMessage(`Exported: ${path.basename(saveUri.fsPath)}`);
        }
        break;
      }

      case 'saveVirtussch': {
        const json = JSON.stringify(message.schematic, null, 2);
        const saveUri = await vscode.window.showSaveDialog({
          filters: { 'Virtus Schematic': ['virtussch'] },
          title: 'Save Virtus Schematic',
        });
        if (saveUri) {
          fs.writeFileSync(saveUri.fsPath, json, 'utf-8');
          vscode.window.showInformationMessage(`Saved: ${path.basename(saveUri.fsPath)}`);
        }
        break;
      }

      case 'requestLibrary':
        panel.sendBuilderLibrary(getLibrary());
        break;

      case 'openStudio':
        // Already open
        break;

      case 'createPCB': {
        const design = pcbEngine.createDesign(
          message.name,
          message.width,
          message.height,
          message.copperLayers
        );
        panel.sendMessage({ type: 'pcbDesignUpdate', design: design as unknown as import('./types').PCBDesignMsg });
        break;
      }

      case 'placePCBFootprint': {
        const fpDef = FOOTPRINT_LIBRARY.find((f) => f.name === message.footprintName);
        if (fpDef) {
          const pads = fpDef.pads.map((p) => ({
            id: p.id,
            x: message.x + p.position.x,
            y: message.y + p.position.y,
            w: p.size.w,
            h: p.size.h,
            shape: p.shape,
            net: p.net || '',
          }));
          panel.sendMessage({
            type: 'pcbFootprintPlaced',
            reference: message.reference,
            pads,
          });
        }
        break;
      }

      case 'addTrace': {
        pcbEngine.addTrace(
          message.net,
          message.layer as import('./pcb/PCBTypes').Layer,
          message.width,
          message.points
        );
        break;
      }

      case 'runDRC': {
        try {
          const design = pcbEngine.getDesign();
          if (message.designRules) {
            pcbEngine.setDesignRules(message.designRules as import('./pcb/PCBTypes').DesignRules);
          }
          const violations = drcChecker.check(design);
          panel.sendMessage({
            type: 'drcResults',
            violations: violations.map((v) => ({
              type: v.type,
              severity: v.severity,
              message: v.message,
              location: v.location,
              items: v.items,
            })),
          });
          vscode.window.showInformationMessage(
            `DRC complete: ${violations.filter((v) => v.severity === 'error').length} errors, ${violations.filter((v) => v.severity === 'warning').length} warnings`
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          panel.sendError(`DRC failed: ${errMsg}`);
        }
        break;
      }

      case 'generateGerber': {
        try {
          const design = pcbEngine.getDesign();
          const result = gerberGenerator.generateAll(design);
          panel.sendMessage({
            type: 'gerberGenerated',
            gerbers: result.gerbers.map((g) => ({
              layer: g.layer,
              filename: g.filename,
              content: g.content,
            })),
            drills: result.drills.map((d) => ({
              filename: d.filename,
              content: d.content,
            })),
          });
          vscode.window.showInformationMessage(
            `Gerber generated: ${result.gerbers.length} layer files + ${result.drills.length} drill files`
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          panel.sendError(`Gerber generation failed: ${errMsg}`);
        }
        break;
      }

      case 'estimateCost': {
        try {
          const design = pcbEngine.getDesign();
          // Update board outline for cost estimation
          design.boardOutline = {
            points: [
              { x: 0, y: 0 },
              { x: message.boardWidth, y: 0 },
              { x: message.boardWidth, y: message.boardHeight },
              { x: 0, y: message.boardHeight },
            ],
            width: message.boardWidth,
            height: message.boardHeight,
          };
          design.designRules.copperLayers = message.layers;
          const estimate = costEstimator.estimatePCBCost(design, message.quantity);
          panel.sendMessage({
            type: 'costEstimate',
            estimate,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          panel.sendError(`Cost estimation failed: ${errMsg}`);
        }
        break;
      }

      case 'exportNetlist': {
        try {
          const design = pcbEngine.getDesign();
          let content: string;
          let ext: string;
          if (message.format === 'ipc356') {
            content = netlistExporter.exportIPC356(design);
            ext = 'ipc';
          } else {
            content = netlistExporter.exportKicadNetlist(design);
            ext = 'net';
          }
          const saveUri = await vscode.window.showSaveDialog({
            filters: { 'Netlist': [ext] },
            title: `Export Netlist (${message.format})`,
          });
          if (saveUri) {
            fs.writeFileSync(saveUri.fsPath, content, 'utf-8');
            vscode.window.showInformationMessage(`Netlist exported: ${path.basename(saveUri.fsPath)}`);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          panel.sendError(`Netlist export failed: ${errMsg}`);
        }
        break;
      }

      case 'autoRoute': {
        try {
          const traces = pcbEngine.autoRouteAll();
          panel.sendMessage({
            type: 'autoRouteResult',
            traces: traces.map((t) => ({
              id: t.id,
              net: t.net,
              layer: t.layer,
              width: t.width,
              points: t.points,
            })),
          });
          vscode.window.showInformationMessage(`Auto-route complete: ${traces.length} traces created`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          panel.sendError(`Auto-route failed: ${errMsg}`);
        }
        break;
      }

      case 'exportGerberFiles': {
        const folderUri = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          title: 'Select output folder for Gerber files',
        });
        if (folderUri && folderUri.length > 0) {
          const folder = folderUri[0].fsPath;
          for (const file of message.files) {
            fs.writeFileSync(path.join(folder, file.filename), file.content, 'utf-8');
          }
          vscode.window.showInformationMessage(`Exported ${message.files.length} Gerber files to ${folder}`);
        }
        break;
      }

      case 'exportCostCSV': {
        const saveUri = await vscode.window.showSaveDialog({
          filters: { 'CSV': ['csv'] },
          title: 'Export Cost Quote',
        });
        if (saveUri) {
          fs.writeFileSync(saveUri.fsPath, message.csv, 'utf-8');
          vscode.window.showInformationMessage(`Cost quote exported: ${path.basename(saveUri.fsPath)}`);
        }
        break;
      }

      case 'scrollToPCBLocation':
        // Handled by webview internally
        break;
    }
  });
}

export function deactivate(): void {
  // Cleanup
}
