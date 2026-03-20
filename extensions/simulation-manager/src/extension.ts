// Copyright 2026 VirtusCo
// Virtus Simulation Manager — Extension entry point

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getProfiles, getById } from './launch/ProfileManager';
import { ProfileRunner } from './launch/ProfileRunner';
import { ProcessTracker } from './launch/ProcessTracker';
import { BagManager, BAG_PRESETS } from './bags/BagManager';
import { loadParams, saveParams } from './nav2/Nav2ParamLoader';
import { NAV2_SCHEMA } from './nav2/Nav2ParamSchema';
import { loadScenarios, saveScenario } from './scenarios/ScenarioStore';
import { ScenarioRunner } from './scenarios/ScenarioRunner';
import { StatusViewProvider } from './providers/StatusViewProvider';
import { ProcessTreeProvider } from './providers/ProcessTreeProvider';
import { SimManagerPanel } from './panel/SimManagerPanel';
import { WebviewMessage, URDFLink, URDFJoint, WorldFile } from './types';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Virtus Simulation Manager');
  outputChannel.appendLine('Virtus Simulation Manager activated');

  // ── Core Services ────────────────────────────────────────────────

  const processTracker = new ProcessTracker();
  const profileRunner = new ProfileRunner(processTracker);
  const bagManager = new BagManager();
  const scenarioRunner = new ScenarioRunner();

  // ── Sidebar Providers ────────────────────────────────────────────

  const statusProvider = new StatusViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      StatusViewProvider.viewType,
      statusProvider
    )
  );

  const processProvider = new ProcessTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('virtusSim.processesView', processProvider)
  );

  // ── Status Update Loop ──────────────────────────────────────────

  const updateStatus = (): void => {
    const processes = processTracker.getAll();
    const profiles = getProfiles();
    const activeId = profileRunner.activeProfileId;

    statusProvider.updateStatus(profiles, activeId, processes);
    processProvider.updateProcesses(processes);

    if (SimManagerPanel.currentPanel) {
      SimManagerPanel.currentPanel.sendProcessStatus(processes);
      SimManagerPanel.currentPanel.sendProfilesData(profiles, activeId);
    }
  };

  processTracker.setOnChange(updateStatus);

  const statusInterval = setInterval(updateStatus, 2000);
  context.subscriptions.push({ dispose: () => clearInterval(statusInterval) });

  // ── Bag Recording Status ────────────────────────────────────────

  bagManager.setOnRecordingChange((recording) => {
    if (SimManagerPanel.currentPanel) {
      SimManagerPanel.currentPanel.sendRecordingStatus(recording, bagManager.recordingElapsed);
    }
  });

  // ── Panel Message Handler ───────────────────────────────────────

  const handlePanelMessage = async (msg: WebviewMessage): Promise<void> => {
    const panel = SimManagerPanel.currentPanel;
    if (!panel) return;

    switch (msg.type) {
      case 'launchProfile': {
        const profile = getById(msg.profileId);
        if (profile) {
          outputChannel.appendLine(`[launch] Starting profile: ${profile.label}`);
          profileRunner.launchProfile(profile);
          updateStatus();
        }
        break;
      }

      case 'stopAll':
        outputChannel.appendLine('[launch] Stopping all processes');
        profileRunner.stopAll();
        updateStatus();
        break;

      case 'stopProcess':
        profileRunner.stopProcess(msg.processId);
        updateStatus();
        break;

      case 'recordBag': {
        const preset = BAG_PRESETS.find((p) => p.id === msg.preset);
        const topics = preset ? preset.topics : ['-a'];
        outputChannel.appendLine(`[bag] Recording: ${msg.name} (${msg.preset})`);
        bagManager.startRecording(topics, msg.name);
        break;
      }

      case 'stopRecording':
        outputChannel.appendLine('[bag] Stopping recording');
        bagManager.stopRecording();
        break;

      case 'playBag':
        outputChannel.appendLine(`[bag] Playing: ${msg.path} at ${msg.rate}x`);
        bagManager.playBag(msg.path, msg.rate);
        break;

      case 'stopPlayback':
        bagManager.stopPlayback();
        break;

      case 'deleteBag':
        bagManager.deleteBag(msg.path);
        refreshBagList(panel);
        break;

      case 'loadNav2Params': {
        try {
          const params = loadParams(msg.path);
          panel.sendNav2Params(params, NAV2_SCHEMA);
        } catch (err) {
          panel.sendError(`Failed to load params: ${err}`);
        }
        break;
      }

      case 'saveNav2Params': {
        try {
          saveParams(msg.path, msg.params);
          panel.sendInfo('Parameters saved successfully');
        } catch (err) {
          panel.sendError(`Failed to save params: ${err}`);
        }
        break;
      }

      case 'resetNav2Defaults': {
        const defaults: Record<string, unknown> = {};
        for (const group of NAV2_SCHEMA) {
          for (const param of group.params) {
            defaults[param.key] = param.default;
          }
        }
        panel.sendNav2Params(defaults, NAV2_SCHEMA);
        break;
      }

      case 'browseFile': {
        const filters: Record<string, string[]> = {};
        if (msg.purpose === 'urdf') {
          filters['URDF Files'] = ['urdf', 'xacro', 'xml'];
        } else if (msg.purpose === 'nav2') {
          filters['YAML Files'] = ['yaml', 'yml'];
        } else {
          filters['All Files'] = ['*'];
        }

        const result = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters,
        });

        if (result && result.length > 0) {
          const filePath = result[0].fsPath;
          if (msg.purpose === 'urdf') {
            parseURDF(filePath, panel);
          } else if (msg.purpose === 'nav2') {
            try {
              const params = loadParams(filePath);
              panel.sendNav2Params(params, NAV2_SCHEMA);
            } catch (err) {
              panel.sendError(`Failed to load params: ${err}`);
            }
          }
        }
        break;
      }

      case 'parseURDF':
        parseURDF(msg.path, panel);
        break;

      case 'loadScenarios': {
        const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const scenarioDir = wsFolder ? path.join(wsFolder, 'scenarios') : '';
        const scenarios = loadScenarios(scenarioDir);
        panel.sendScenarioList(scenarios);
        break;
      }

      case 'runScenario': {
        outputChannel.appendLine(`[scenario] Running: ${msg.scenario.name}`);
        try {
          const result = await scenarioRunner.runScenario(msg.scenario);
          panel.sendScenarioResult(result);
          outputChannel.appendLine(`[scenario] Result: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.elapsed_s}s)`);
        } catch (err) {
          panel.sendError(`Scenario failed: ${err}`);
        }
        break;
      }

      case 'saveScenario': {
        const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsFolder) {
          panel.sendError('No workspace folder open');
          break;
        }
        const scenarioDir = path.join(wsFolder, 'scenarios');
        const fileName = msg.scenario.name.toLowerCase().replace(/\s+/g, '_') + '.virtusscenario';
        saveScenario(path.join(scenarioDir, fileName), msg.scenario);
        panel.sendInfo(`Scenario saved: ${fileName}`);
        break;
      }

      case 'scanWorlds': {
        const worlds = scanWorldFiles();
        panel.sendWorldList(worlds);
        break;
      }

      case 'switchWorld': {
        outputChannel.appendLine(`[world] Switching to: ${msg.worldPath}`);
        vscode.workspace.getConfiguration('virtus-sim').update('defaultWorld', path.basename(msg.worldPath), true);
        panel.sendInfo(`World set to: ${path.basename(msg.worldPath)}. Restart Gazebo to apply.`);
        break;
      }

      case 'requestStatus':
        updateStatus();
        break;
    }
  };

  // ── Helper Functions ────────────────────────────────────────────

  function refreshBagList(panel: SimManagerPanel): void {
    const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (wsFolder) {
      const bags = bagManager.scanBags(path.join(wsFolder, 'bags'));
      panel.sendBagList(bags);
    }
  }

  function parseURDF(filePath: string, panel: SimManagerPanel): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const links: URDFLink[] = [];
      const joints: URDFJoint[] = [];
      const warnings: string[] = [];

      // Simple XML parsing for URDF
      const linkMatches = content.matchAll(/<link\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/link>/g);
      for (const match of linkMatches) {
        const name = match[1];
        const body = match[2];
        const hasVisual = /<visual/.test(body);
        const hasCollision = /<collision/.test(body);
        const hasInertial = /<inertial/.test(body);

        let visual = 'none';
        const visualGeomMatch = body.match(/<visual[\s\S]*?<geometry[\s\S]*?<(\w+)/);
        if (visualGeomMatch) visual = visualGeomMatch[1];

        let collision = 'none';
        const collisionGeomMatch = body.match(/<collision[\s\S]*?<geometry[\s\S]*?<(\w+)/);
        if (collisionGeomMatch) collision = collisionGeomMatch[1];

        links.push({ name, visual, collision });

        if (!hasVisual) warnings.push(`Link "${name}" has no visual element`);
        if (!hasCollision) warnings.push(`Link "${name}" has no collision element`);
        if (!hasInertial) warnings.push(`Link "${name}" has no inertial element`);
      }

      const jointMatches = content.matchAll(/<joint\s+name="([^"]+)"\s+type="([^"]+)"[^>]*>([\s\S]*?)<\/joint>/g);
      for (const match of jointMatches) {
        const name = match[1];
        const type = match[2] as URDFJoint['type'];
        const body = match[3];

        const parentMatch = body.match(/<parent\s+link="([^"]+)"/);
        const childMatch = body.match(/<child\s+link="([^"]+)"/);
        const originMatch = body.match(/<origin\s+([^/]*)\/?>/);
        const axisMatch = body.match(/<axis\s+xyz="([^"]+)"/);
        const limitMatch = body.match(/<limit\s+([^/]*)\/?>/);

        let xyz = '0 0 0';
        let rpy = '0 0 0';
        if (originMatch) {
          const xyzM = originMatch[1].match(/xyz="([^"]+)"/);
          const rpyM = originMatch[1].match(/rpy="([^"]+)"/);
          if (xyzM) xyz = xyzM[1];
          if (rpyM) rpy = rpyM[1];
        }

        const limits: URDFJoint['limits'] = {};
        if (limitMatch) {
          const lowerM = limitMatch[1].match(/lower="([^"]+)"/);
          const upperM = limitMatch[1].match(/upper="([^"]+)"/);
          const effortM = limitMatch[1].match(/effort="([^"]+)"/);
          const velocityM = limitMatch[1].match(/velocity="([^"]+)"/);
          if (lowerM) limits.lower = parseFloat(lowerM[1]);
          if (upperM) limits.upper = parseFloat(upperM[1]);
          if (effortM) limits.effort = parseFloat(effortM[1]);
          if (velocityM) limits.velocity = parseFloat(velocityM[1]);
        }

        const parent = parentMatch ? parentMatch[1] : 'unknown';
        const child = childMatch ? childMatch[1] : 'unknown';

        if (parent === 'unknown') warnings.push(`Joint "${name}" has no parent link`);
        if (child === 'unknown') warnings.push(`Joint "${name}" has no child link`);

        // Check for undefined link references
        const linkNames = links.map((l) => l.name);
        if (parent !== 'unknown' && !linkNames.includes(parent)) {
          warnings.push(`Joint "${name}" references undefined parent link "${parent}"`);
        }
        if (child !== 'unknown' && !linkNames.includes(child)) {
          warnings.push(`Joint "${name}" references undefined child link "${child}"`);
        }

        joints.push({
          name,
          type,
          parent,
          child,
          origin: { xyz, rpy },
          axis: axisMatch ? axisMatch[1] : '0 0 1',
          limits,
        });
      }

      panel.sendURDFData(links, joints, warnings);
    } catch (err) {
      panel.sendError(`Failed to parse URDF: ${err}`);
    }
  }

  function scanWorldFiles(): WorldFile[] {
    const worlds: WorldFile[] = [];
    const defaultWorld = vscode.workspace.getConfiguration('virtus-sim').get('defaultWorld', 'airport_terminal.world');

    const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!wsFolder) return worlds;

    // Search common world file locations
    const searchDirs = [
      path.join(wsFolder, 'worlds'),
      path.join(wsFolder, 'simulation', 'worlds'),
      path.join(wsFolder, 'src', 'porter_description', 'worlds'),
    ];

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && (entry.name.endsWith('.world') || entry.name.endsWith('.sdf'))) {
            worlds.push({
              name: entry.name,
              path: path.join(dir, entry.name),
              active: entry.name === defaultWorld,
            });
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    return worlds;
  }

  // ── Commands ─────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('virtusSim.openSimManager', () => {
      const panel = SimManagerPanel.createOrShow(context);
      panel.setOnMessage(handlePanelMessage);

      // Send initial data
      updateStatus();
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (wsFolder) {
        const bags = bagManager.scanBags(path.join(wsFolder, 'bags'));
        panel.sendBagList(bags);
      }
      panel.sendScenarioList(loadScenarios(
        wsFolder ? path.join(wsFolder, 'scenarios') : ''
      ));
      panel.sendWorldList(scanWorldFiles());
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtusSim.launchProfile', async (profileId?: string) => {
      let id = profileId;
      if (!id) {
        const profiles = getProfiles();
        const picked = await vscode.window.showQuickPick(
          profiles.map((p) => ({ label: p.label, description: p.description, id: p.id })),
          { placeHolder: 'Select a launch profile' }
        );
        if (!picked) return;
        id = picked.id;
      }
      const profile = getById(id);
      if (profile) {
        outputChannel.appendLine(`[launch] Starting profile: ${profile.label}`);
        profileRunner.launchProfile(profile);
        updateStatus();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtusSim.stopAll', () => {
      outputChannel.appendLine('[launch] Stopping all processes');
      profileRunner.stopAll();
      updateStatus();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtusSim.recordBag', async () => {
      const preset = await vscode.window.showQuickPick(
        BAG_PRESETS.map((p) => ({ label: p.label, id: p.id })),
        { placeHolder: 'Select recording preset' }
      );
      if (!preset) return;

      const name = await vscode.window.showInputBox({
        prompt: 'Bag file name',
        value: `porter_bag_${Date.now()}`,
      });
      if (!name) return;

      const topics = BAG_PRESETS.find((p) => p.id === preset.id)?.topics ?? ['-a'];
      outputChannel.appendLine(`[bag] Recording: ${name} (${preset.label})`);
      bagManager.startRecording(topics, name);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('virtusSim.stopRecording', () => {
      outputChannel.appendLine('[bag] Stopping recording');
      bagManager.stopRecording();
    })
  );

  context.subscriptions.push(outputChannel);
}

export function deactivate(): void {
  SimManagerPanel.currentPanel?.dispose();
}
