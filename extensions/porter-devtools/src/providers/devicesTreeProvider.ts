import * as vscode from 'vscode';

import { SerialDevice } from '../models/types';
import { ConnectionStatus, DeviceType } from '../models/enums';
import { Settings } from '../config/settings';
import { Logger } from '../utils/logger';
import { TREE_ITEM_CONTEXT } from '../constants';

/**
 * Tree item representing a device, category, or status entry in the Devices panel.
 */
export class DeviceTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemContextValue: string,
        public readonly device?: SerialDevice,
    ) {
        super(label, collapsibleState);
        this.contextValue = itemContextValue;
    }
}

/**
 * TreeDataProvider for the Devices sidebar panel.
 *
 * Displays two top-level categories:
 *   - ESP32 Devices: lists detected serial devices with status icons and inline actions
 *   - Raspberry Pi: shows the configured RPi target and its connection status
 */
export class DevicesTreeProvider implements vscode.TreeDataProvider<DeviceTreeItem> {

    private readonly _onDidChangeTreeData = new vscode.EventEmitter<DeviceTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<DeviceTreeItem | undefined | void> =
        this._onDidChangeTreeData.event;

    private devices: readonly SerialDevice[] = [];
    private rpiStatus: ConnectionStatus = ConnectionStatus.Disconnected;

    constructor(private readonly logger: Logger) {}

    /**
     * Fires the tree-change event so VS Code re-renders the view.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Replaces the current list of detected ESP32 serial devices and refreshes the tree.
     */
    setDevices(devices: readonly SerialDevice[]): void {
        this.devices = Object.freeze([...devices]);
        this.logger.info(`DevicesTreeProvider: updated device list (${devices.length} device(s))`);
        this.refresh();
    }

    /**
     * Updates the Raspberry Pi connection status and refreshes the tree.
     */
    setRpiStatus(status: ConnectionStatus): void {
        this.rpiStatus = status;
        this.logger.info(`DevicesTreeProvider: RPi status changed to ${status}`);
        this.refresh();
    }

    getTreeItem(element: DeviceTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DeviceTreeItem): DeviceTreeItem[] {
        if (!element) {
            return this.getRootItems();
        }

        if (element.label === 'ESP32 Devices') {
            return this.getEsp32Children();
        }

        if (element.label === 'Raspberry Pi') {
            return this.getRpiChildren();
        }

        return [];
    }

    // ── private helpers ─────────────────────────────────────────────────

    private getRootItems(): DeviceTreeItem[] {
        const esp32Category = new DeviceTreeItem(
            'ESP32 Devices',
            vscode.TreeItemCollapsibleState.Expanded,
            TREE_ITEM_CONTEXT.CATEGORY,
        );
        esp32Category.iconPath = new vscode.ThemeIcon('circuit-board');

        const rpiCategory = new DeviceTreeItem(
            'Raspberry Pi',
            vscode.TreeItemCollapsibleState.Expanded,
            TREE_ITEM_CONTEXT.CATEGORY,
        );
        rpiCategory.iconPath = new vscode.ThemeIcon('server');

        return [esp32Category, rpiCategory];
    }

    private getEsp32Children(): DeviceTreeItem[] {
        if (this.devices.length === 0) {
            const empty = new DeviceTreeItem(
                'No devices detected',
                vscode.TreeItemCollapsibleState.None,
                TREE_ITEM_CONTEXT.CATEGORY,
            );
            empty.description = 'Plug in an ESP32 via USB';
            empty.iconPath = new vscode.ThemeIcon('info');
            return [empty];
        }

        return this.devices.map((device) => this.createEsp32Item(device));
    }

    private createEsp32Item(device: SerialDevice): DeviceTreeItem {
        const deviceLabel = this.formatDeviceTypeLabel(device.deviceType);
        const item = new DeviceTreeItem(
            device.port,
            vscode.TreeItemCollapsibleState.None,
            TREE_ITEM_CONTEXT.ESP32_DEVICE,
            device,
        );

        item.description = deviceLabel;
        item.iconPath = this.getStatusIcon(device.status);
        item.tooltip = this.buildEsp32Tooltip(device);

        return item;
    }

    private getRpiChildren(): DeviceTreeItem[] {
        const host = Settings.rpi.host;

        if (!host) {
            const notConfigured = new DeviceTreeItem(
                'Not configured',
                vscode.TreeItemCollapsibleState.None,
                TREE_ITEM_CONTEXT.RPI_TARGET,
            );
            notConfigured.description = 'Run "Configure RPi" to set up';
            notConfigured.iconPath = new vscode.ThemeIcon('debug-disconnect');
            notConfigured.command = {
                command: 'porterRobot.configureRpi',
                title: 'Configure RPi',
            };
            return [notConfigured];
        }

        const statusLabel = this.formatConnectionStatusLabel(this.rpiStatus);
        const item = new DeviceTreeItem(
            host,
            vscode.TreeItemCollapsibleState.None,
            TREE_ITEM_CONTEXT.RPI_TARGET,
        );

        item.description = statusLabel;
        item.iconPath = this.getStatusIcon(this.rpiStatus);
        item.tooltip = this.buildRpiTooltip(host);

        return [item];
    }

    private getStatusIcon(status: ConnectionStatus): vscode.ThemeIcon {
        switch (status) {
            case ConnectionStatus.Connected:
                return new vscode.ThemeIcon('plug', new vscode.ThemeColor('testing.iconPassed'));
            case ConnectionStatus.Flashing:
            case ConnectionStatus.Deploying:
                return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.yellow'));
            case ConnectionStatus.Error:
                return new vscode.ThemeIcon('debug-disconnect', new vscode.ThemeColor('testing.iconFailed'));
            case ConnectionStatus.Disconnected:
            default:
                return new vscode.ThemeIcon('debug-disconnect');
        }
    }

    private formatDeviceTypeLabel(type: DeviceType): string {
        switch (type) {
            case DeviceType.MotorController:
                return 'Motor Controller';
            case DeviceType.SensorFusion:
                return 'Sensor Fusion';
            case DeviceType.Unknown:
            default:
                return 'Unknown Device';
        }
    }

    private formatConnectionStatusLabel(status: ConnectionStatus): string {
        switch (status) {
            case ConnectionStatus.Connected:
                return 'Connected';
            case ConnectionStatus.Disconnected:
                return 'Disconnected';
            case ConnectionStatus.Flashing:
                return 'Flashing...';
            case ConnectionStatus.Deploying:
                return 'Deploying...';
            case ConnectionStatus.Error:
                return 'Error';
            default:
                return 'Unknown';
        }
    }

    private buildEsp32Tooltip(device: SerialDevice): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${device.port}** — ${this.formatDeviceTypeLabel(device.deviceType)}\n\n`);
        md.appendMarkdown(`- **Status:** ${this.formatConnectionStatusLabel(device.status)}\n`);
        if (device.manufacturer) {
            md.appendMarkdown(`- **Manufacturer:** ${device.manufacturer}\n`);
        }
        if (device.vendorId && device.productId) {
            md.appendMarkdown(`- **VID/PID:** ${device.vendorId}:${device.productId}\n`);
        }
        if (device.serialNumber) {
            md.appendMarkdown(`- **Serial:** ${device.serialNumber}\n`);
        }
        return md;
    }

    private buildRpiTooltip(host: string): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**Raspberry Pi Target**\n\n`);
        md.appendMarkdown(`- **Host:** ${host}\n`);
        md.appendMarkdown(`- **User:** ${Settings.rpi.username}\n`);
        md.appendMarkdown(`- **Status:** ${this.formatConnectionStatusLabel(this.rpiStatus)}\n`);
        md.appendMarkdown(`- **Docker Compose:** ${Settings.rpi.dockerComposePath}\n`);
        return md;
    }
}
