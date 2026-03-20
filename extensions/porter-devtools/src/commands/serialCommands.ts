import * as vscode from 'vscode';

import { SerialService } from '../services/serialService';
import { DeviceDetectionService } from '../services/deviceDetectionService';
import { SerialMonitorPanel } from '../views/serialMonitorPanel';
import { Logger } from '../utils/logger';
import { Settings } from '../config/settings';
import { DeviceType } from '../models/enums';
import { SerialDevice } from '../models/types';

// ── Dependencies interface ──────────────────────────────────────────────

interface SerialCommandDeps {
    readonly serialService: SerialService;
    readonly deviceDetectionService: DeviceDetectionService;
    readonly logger: Logger;
    /** The VS Code extension URI, needed for webview resource resolution. */
    readonly extensionUri: vscode.Uri;
}

// ── Registration ────────────────────────────────────────────────────────

/**
 * Registers serial monitor commands for opening and closing the webview
 * serial terminal.
 *
 * The serial monitor is a webview panel that displays incoming serial data
 * from an ESP32 and allows the user to send text back to the device.
 */
export function register(deps: SerialCommandDeps): vscode.Disposable[] {
    const { serialService, deviceDetectionService, logger, extensionUri } = deps;

    return [
        vscode.commands.registerCommand(
            'porterRobot.openSerialMonitor',
            () => openSerialMonitor(serialService, deviceDetectionService, logger, extensionUri),
        ),

        vscode.commands.registerCommand(
            'porterRobot.closeSerialMonitor',
            () => closeSerialMonitor(logger),
        ),
    ];
}

// ── Open serial monitor ─────────────────────────────────────────────────

async function openSerialMonitor(
    serialService: SerialService,
    deviceDetectionService: DeviceDetectionService,
    logger: Logger,
    extensionUri: vscode.Uri,
): Promise<void> {
    logger.info('Open Serial Monitor requested');

    // 1. Pick a port from detected devices
    const port = await pickSerialPort(deviceDetectionService, logger);
    if (!port) {
        return; // User cancelled or no devices
    }

    const baudRate = Settings.serial.baudRate;

    // 2. Create or reveal the singleton serial monitor panel.
    //    The panel manages serial port connections internally.
    const panel = SerialMonitorPanel.createOrShow(extensionUri, serialService, logger);

    // 3. Open the selected port on the panel
    await panel.openPort(port, baudRate);

    logger.info(`Serial monitor opened on ${port} at ${baudRate} baud`);
}

// ── Close serial monitor ────────────────────────────────────────────────

async function closeSerialMonitor(
    logger: Logger,
): Promise<void> {
    logger.info('Close Serial Monitor requested');

    if (!SerialMonitorPanel.currentPanel) {
        vscode.window.showInformationMessage('No serial monitor is currently open.');
        return;
    }

    SerialMonitorPanel.currentPanel.dispose();
    vscode.window.showInformationMessage('Serial monitor closed.');
}

// ── Port selection ──────────────────────────────────────────────────────

/** Human-readable device type labels. */
const DEVICE_TYPE_LABELS: Readonly<Record<DeviceType, string>> = {
    [DeviceType.MotorController]: 'Motor Controller',
    [DeviceType.SensorFusion]: 'Sensor Fusion',
    [DeviceType.Unknown]: 'Unknown Device',
};

/**
 * Shows a quick-pick of detected serial ports and returns the selected
 * port path, or `undefined` if the user cancels.
 *
 * If no devices are detected, offers the option to scan again or enter
 * a port manually.
 */
async function pickSerialPort(
    deviceDetectionService: DeviceDetectionService,
    logger: Logger,
): Promise<string | undefined> {
    const devices = await deviceDetectionService.scanDevices();

    if (devices.length === 0) {
        const action = await vscode.window.showWarningMessage(
            'No serial devices detected. Connect an ESP32 via USB, or enter the port manually.',
            'Enter Port Manually',
            'Scan Devices',
        );

        if (action === 'Enter Port Manually') {
            const manualPort = await vscode.window.showInputBox({
                prompt: 'Enter serial port path',
                placeHolder: process.platform === 'win32' ? 'COM3' : '/dev/ttyUSB0',
                validateInput: (value) => {
                    if (!value.trim()) {
                        return 'Port path is required';
                    }
                    return undefined;
                },
            });
            return manualPort?.trim();
        }

        if (action === 'Scan Devices') {
            await vscode.commands.executeCommand('porterRobot.refreshDevices');
        }

        return undefined;
    }

    const items: vscode.QuickPickItem[] = devices.map((d) => ({
        label: d.port,
        description: formatDeviceDescription(d),
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select serial port for monitoring',
        title: 'Serial Port',
    });

    if (!selected) {
        logger.info('User cancelled serial port selection');
        return undefined;
    }

    return selected.label;
}

function formatDeviceDescription(device: SerialDevice): string {
    const parts: string[] = [];

    if (device.deviceType !== DeviceType.Unknown) {
        parts.push(DEVICE_TYPE_LABELS[device.deviceType]);
    }
    if (device.manufacturer) {
        parts.push(device.manufacturer);
    }
    if (device.vendorId && device.productId) {
        parts.push(`VID:PID ${device.vendorId}:${device.productId}`);
    }

    return parts.length > 0 ? parts.join(' — ') : 'Serial Device';
}
