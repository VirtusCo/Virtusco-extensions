import * as vscode from 'vscode';

import { FlashMode } from '../models/enums';
import { Logger } from '../utils/logger';
import { TREE_ITEM_CONTEXT } from '../constants';

/**
 * Snapshot of extension state that determines which actions are enabled.
 */
export interface ActionState {
    readonly esp32Connected: boolean;
    readonly rpiConnected: boolean;
    readonly motorFirmwareReady: boolean;
    readonly sensorFirmwareReady: boolean;
    readonly dockerImageReady: boolean;
    readonly flutterGuiReady: boolean;
    readonly anyArtifactsDownloaded: boolean;
    readonly flashMode: FlashMode;
}

/** Descriptor for a single action row. */
interface ActionDescriptor {
    readonly id: string;
    readonly label: string;
    readonly command: string;
    readonly icon: string;
    readonly prerequisiteLabel: string;
    readonly isReady: (state: ActionState) => boolean;
    readonly extraDescription?: (state: ActionState) => string;
}

/**
 * Tree item representing a context-aware action in the Actions sidebar panel.
 */
export class ActionTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        public readonly actionId: string,
        public readonly ready: boolean,
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = TREE_ITEM_CONTEXT.ACTION;
    }
}

/**
 * TreeDataProvider for the Actions sidebar panel.
 *
 * Displays a flat list of context-aware actions whose enabled/disabled state
 * is derived from the current device and artifact readiness.  Each action
 * shows prerequisites and becomes visually muted when its requirements are
 * not met.
 */
export class ActionsTreeProvider implements vscode.TreeDataProvider<ActionTreeItem> {

    private readonly _onDidChangeTreeData = new vscode.EventEmitter<ActionTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ActionTreeItem | undefined | void> =
        this._onDidChangeTreeData.event;

    private state: ActionState = ActionsTreeProvider.defaultState();

    /** Ordered registry of every action shown in the panel. */
    private static readonly ACTION_DESCRIPTORS: readonly ActionDescriptor[] = [
        {
            id: 'flashMotor',
            label: 'Flash Motor Controller',
            command: 'porterRobot.flashMotorController',
            icon: 'zap',
            prerequisiteLabel: 'requires ESP32 + motor_controller.bin',
            isReady: (s) => s.esp32Connected && s.motorFirmwareReady,
            extraDescription: (s) => `(${s.flashMode === FlashMode.West ? 'west' : 'esptool'})`,
        },
        {
            id: 'flashSensor',
            label: 'Flash Sensor Fusion',
            command: 'porterRobot.flashSensorFusion',
            icon: 'zap',
            prerequisiteLabel: 'requires ESP32 + sensor_fusion.bin',
            isReady: (s) => s.esp32Connected && s.sensorFirmwareReady,
            extraDescription: (s) => `(${s.flashMode === FlashMode.West ? 'west' : 'esptool'})`,
        },
        {
            id: 'deployDocker',
            label: 'Deploy Docker Image to RPi',
            command: 'porterRobot.deployDocker',
            icon: 'rocket',
            prerequisiteLabel: 'requires RPi + docker image',
            isReady: (s) => s.rpiConnected && s.dockerImageReady,
        },
        {
            id: 'deployGui',
            label: 'Deploy Flutter GUI to RPi',
            command: 'porterRobot.deployFlutterGui',
            icon: 'rocket',
            prerequisiteLabel: 'requires RPi + GUI bundle',
            isReady: (s) => s.rpiConnected && s.flutterGuiReady,
        },
        {
            id: 'serialMonitor',
            label: 'Open Serial Monitor',
            command: 'porterRobot.openSerialMonitor',
            icon: 'terminal',
            prerequisiteLabel: 'requires ESP32',
            isReady: (s) => s.esp32Connected,
        },
        {
            id: 'verifyChecksums',
            label: 'Verify Checksums',
            command: 'porterRobot.verifyChecksums',
            icon: 'verified',
            prerequisiteLabel: 'requires downloaded artifacts',
            isReady: (s) => s.anyArtifactsDownloaded,
        },
    ];

    constructor(private readonly logger: Logger) {}

    /**
     * Fires the tree-change event so VS Code re-renders the view.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Receives the current snapshot of device and artifact readiness
     * and refreshes the tree to update action states.
     */
    updateState(state: ActionState): void {
        this.state = Object.freeze({ ...state });
        this.logger.debug('ActionsTreeProvider: state updated', state);
        this.refresh();
    }

    getTreeItem(element: ActionTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ActionTreeItem): ActionTreeItem[] {
        if (element) {
            // Actions are always leaf nodes — no children.
            return [];
        }

        return ActionsTreeProvider.ACTION_DESCRIPTORS.map((descriptor) =>
            this.createActionItem(descriptor),
        );
    }

    // ── private helpers ─────────────────────────────────────────────────

    private createActionItem(descriptor: ActionDescriptor): ActionTreeItem {
        const ready = descriptor.isReady(this.state);

        const item = new ActionTreeItem(descriptor.label, descriptor.id, ready);

        // Build the description line: flash mode suffix (if applicable) + prereq status
        const descriptionParts: string[] = [];
        if (descriptor.extraDescription) {
            descriptionParts.push(descriptor.extraDescription(this.state));
        }
        if (!ready) {
            descriptionParts.push(descriptor.prerequisiteLabel);
        }
        item.description = descriptionParts.join(' — ');

        // Icon: use the specified ThemeIcon with a color tint for ready vs not-ready
        item.iconPath = ready
            ? new vscode.ThemeIcon(descriptor.icon, new vscode.ThemeColor('charts.green'))
            : new vscode.ThemeIcon(descriptor.icon);

        // Tooltip with full detail
        item.tooltip = this.buildActionTooltip(descriptor, ready);

        // When ready, clicking the item triggers the command directly
        if (ready) {
            item.command = {
                command: descriptor.command,
                title: descriptor.label,
            };
        }

        return item;
    }

    private buildActionTooltip(descriptor: ActionDescriptor, ready: boolean): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${descriptor.label}**\n\n`);
        md.appendMarkdown(`- **Status:** ${ready ? 'Ready' : 'Not ready'}\n`);
        md.appendMarkdown(`- **Prerequisites:** ${descriptor.prerequisiteLabel}\n`);

        if (!ready) {
            md.appendMarkdown(`\n*Action is disabled because one or more prerequisites are not met.*\n`);
        }

        return md;
    }

    /** Returns an ActionState where nothing is connected or downloaded. */
    private static defaultState(): ActionState {
        return Object.freeze({
            esp32Connected: false,
            rpiConnected: false,
            motorFirmwareReady: false,
            sensorFirmwareReady: false,
            dockerImageReady: false,
            flutterGuiReady: false,
            anyArtifactsDownloaded: false,
            flashMode: FlashMode.Esptool,
        });
    }
}
