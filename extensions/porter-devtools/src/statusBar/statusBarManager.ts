import * as vscode from 'vscode';

import { Logger } from '../utils/logger';

/**
 * Manages status bar items showing connection status for ESP32 devices,
 * Raspberry Pi target, and the current firmware release version.
 *
 * All three items are created in the constructor and disposed together.
 */
export class StatusBarManager implements vscode.Disposable {
    private readonly esp32Item: vscode.StatusBarItem;
    private readonly rpiItem: vscode.StatusBarItem;
    private readonly versionItem: vscode.StatusBarItem;

    constructor(private readonly logger: Logger) {
        // ESP32 device count — highest priority, leftmost
        this.esp32Item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100,
        );
        this.esp32Item.command = 'porterRobot.refreshDevices';
        this.esp32Item.tooltip = 'Porter: ESP32 devices — click to refresh';
        this.updateEsp32Count(0);

        // RPi connection status
        this.rpiItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99,
        );
        this.rpiItem.command = 'porterRobot.configureRpi';
        this.rpiItem.tooltip = 'Porter: Raspberry Pi — click to configure';
        this.updateRpiStatus(false);

        // Firmware version / latest release
        this.versionItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            98,
        );
        this.versionItem.command = 'porterRobot.refreshReleases';
        this.versionItem.tooltip = 'Porter: Latest release — click to refresh';
        this.updateVersion('--');
    }

    /**
     * Updates the ESP32 status bar item to reflect the number of connected devices.
     */
    updateEsp32Count(count: number): void {
        if (count > 0) {
            this.esp32Item.text = `$(plug) ${count} ESP32`;
            this.esp32Item.backgroundColor = undefined;
        } else {
            this.esp32Item.text = '$(debug-disconnect) No ESP32';
            this.esp32Item.backgroundColor = new vscode.ThemeColor(
                'statusBarItem.warningBackground',
            );
        }
        this.logger.debug(`Status bar: ESP32 count updated to ${count}`);
    }

    /**
     * Updates the RPi status bar item to reflect connectivity.
     *
     * @param connected Whether the RPi is reachable.
     * @param host Optional hostname or IP to display in the tooltip.
     */
    updateRpiStatus(connected: boolean, host?: string): void {
        if (connected) {
            this.rpiItem.text = '$(remote) RPi: Online';
            this.rpiItem.backgroundColor = undefined;
            this.rpiItem.tooltip = host
                ? `Porter: RPi ${host} — connected`
                : 'Porter: Raspberry Pi — connected';
        } else {
            this.rpiItem.text = '$(warning) RPi: Offline';
            this.rpiItem.backgroundColor = new vscode.ThemeColor(
                'statusBarItem.warningBackground',
            );
            this.rpiItem.tooltip = 'Porter: Raspberry Pi — click to configure';
        }
        this.logger.debug(`Status bar: RPi status updated — connected=${connected}`);
    }

    /**
     * Updates the version status bar item with the given release version string.
     */
    updateVersion(version: string): void {
        this.versionItem.text = `$(tag) ${version}`;
        this.versionItem.tooltip = `Porter: Release ${version} — click to refresh`;
        this.logger.debug(`Status bar: version updated to ${version}`);
    }

    /**
     * Shows all status bar items.
     */
    show(): void {
        this.esp32Item.show();
        this.rpiItem.show();
        this.versionItem.show();
    }

    /**
     * Hides all status bar items.
     */
    hide(): void {
        this.esp32Item.hide();
        this.rpiItem.hide();
        this.versionItem.hide();
    }

    /**
     * Disposes all status bar items.
     */
    dispose(): void {
        this.esp32Item.dispose();
        this.rpiItem.dispose();
        this.versionItem.dispose();
    }
}
