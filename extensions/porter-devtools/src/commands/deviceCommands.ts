import * as vscode from 'vscode';

import { DeviceDetectionService } from '../services/deviceDetectionService';
import { DevicesTreeProvider, DeviceTreeItem } from '../providers/devicesTreeProvider';
import { Logger } from '../utils/logger';
import { DeviceType } from '../models/enums';

// ── Dependencies interface ──────────────────────────────────────────────

interface DeviceCommandDeps {
    readonly deviceDetectionService: DeviceDetectionService;
    readonly devicesTreeProvider: DevicesTreeProvider;
    readonly logger: Logger;
}

// ── Registration ────────────────────────────────────────────────────────

/**
 * Registers device scanning and identification commands.
 *
 * These commands drive the Devices sidebar panel, allowing the user to
 * scan for connected ESP32 boards and identify which firmware (motor
 * controller vs sensor fusion) is running on each port via Porter binary
 * protocol probing.
 */
export function register(deps: DeviceCommandDeps): vscode.Disposable[] {
    const { deviceDetectionService, devicesTreeProvider, logger } = deps;

    return [
        vscode.commands.registerCommand(
            'porterRobot.refreshDevices',
            () => refreshDevices(deviceDetectionService, devicesTreeProvider, logger),
        ),

        vscode.commands.registerCommand(
            'porterRobot.identifyDevice',
            (item?: DeviceTreeItem) =>
                identifyDevice(item, deviceDetectionService, devicesTreeProvider, logger),
        ),
    ];
}

// ── Human-readable labels ───────────────────────────────────────────────

const DEVICE_TYPE_LABELS: Readonly<Record<DeviceType, string>> = {
    [DeviceType.MotorController]: 'Motor Controller (ESP32 #1)',
    [DeviceType.SensorFusion]: 'Sensor Fusion (ESP32 #2)',
    [DeviceType.Unknown]: 'Unknown (no response to protocol probe)',
};

// ── Refresh devices ─────────────────────────────────────────────────────

async function refreshDevices(
    deviceDetectionService: DeviceDetectionService,
    devicesTreeProvider: DevicesTreeProvider,
    logger: Logger,
): Promise<void> {
    logger.info('Refresh Devices requested');

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Scanning for devices...',
            cancellable: false,
        },
        async () => {
            try {
                const devices = await deviceDetectionService.scanDevices();
                devicesTreeProvider.setDevices(devices);

                if (devices.length === 0) {
                    vscode.window.showInformationMessage(
                        'No ESP32 devices found. Check that a device is connected via USB.',
                    );
                } else {
                    const portList = devices.map((d) => d.port).join(', ');
                    vscode.window.showInformationMessage(
                        `Found ${devices.length} device(s): ${portList}`,
                    );
                }

                logger.info(`Device scan complete: ${devices.length} device(s) found`);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                logger.error('Device scan failed', message);
                vscode.window.showErrorMessage(
                    `Device scan failed: ${message}`,
                    'Show Output',
                ).then((action) => {
                    if (action === 'Show Output') {
                        logger.show();
                    }
                });
            }
        },
    );
}

// ── Identify device ─────────────────────────────────────────────────────

/**
 * Identifies which firmware is running on a device by sending Porter binary
 * protocol probe packets.
 *
 * Can be invoked from the tree view (with a DeviceTreeItem argument) or
 * from the command palette (no argument — user picks from a quick-pick).
 */
async function identifyDevice(
    item: DeviceTreeItem | undefined,
    deviceDetectionService: DeviceDetectionService,
    devicesTreeProvider: DevicesTreeProvider,
    logger: Logger,
): Promise<void> {
    // Resolve the port — from tree item or user selection
    let port: string | undefined = item?.device?.port;

    if (!port) {
        port = await pickDevicePort(deviceDetectionService, logger);
        if (!port) {
            return; // User cancelled or no devices
        }
    }

    logger.info(`Identify Device requested for ${port}`);

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Identifying device on ${port}...`,
            cancellable: false,
        },
        async () => {
            try {
                const deviceType = await deviceDetectionService.identifyDevice(port);
                const label = DEVICE_TYPE_LABELS[deviceType];

                vscode.window.showInformationMessage(
                    `Device on ${port}: ${label}`,
                );

                logger.info(`Device identified on ${port}: ${deviceType}`);

                // Refresh the tree to reflect the identified device type
                const devices = await deviceDetectionService.scanDevices();
                devicesTreeProvider.setDevices(
                    devices.map((d) =>
                        d.port === port ? { ...d, deviceType } : d,
                    ),
                );
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`Device identification failed on ${port}`, message);
                vscode.window.showErrorMessage(
                    `Failed to identify device on ${port}: ${message}`,
                    'Show Output',
                ).then((action) => {
                    if (action === 'Show Output') {
                        logger.show();
                    }
                });
            }
        },
    );
}

// ── Port selection ──────────────────────────────────────────────────────

/**
 * Shows a quick-pick of detected devices for identification, returning
 * the selected port path or `undefined` if the user cancels.
 */
async function pickDevicePort(
    deviceDetectionService: DeviceDetectionService,
    logger: Logger,
): Promise<string | undefined> {
    const devices = deviceDetectionService.getDevices();

    if (devices.length === 0) {
        vscode.window.showWarningMessage(
            'No devices connected. Plug in an ESP32 via USB and scan for devices first.',
        );
        return undefined;
    }

    interface DeviceQuickPickItem extends vscode.QuickPickItem {
        readonly port: string;
    }

    const items: DeviceQuickPickItem[] = devices.map((d) => ({
        label: d.port,
        description: d.deviceType === DeviceType.Unknown
            ? 'Unidentified'
            : DEVICE_TYPE_LABELS[d.deviceType],
        detail: d.manufacturer
            ? `Manufacturer: ${d.manufacturer}`
            : undefined,
        port: d.port,
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select device to identify',
        title: 'Identify Device',
    });

    if (!selected) {
        logger.info('User cancelled device selection for identification');
        return undefined;
    }

    return selected.port;
}
