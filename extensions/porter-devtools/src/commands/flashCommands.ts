import * as vscode from 'vscode';
import * as fs from 'fs';

import { EsptoolService } from '../services/esptoolService';
import { WestFlashService } from '../services/westFlashService';
import { DeviceDetectionService } from '../services/deviceDetectionService';
import { ChecksumService } from '../services/checksumService';
import { Logger } from '../utils/logger';
import { Settings } from '../config/settings';
import { FlashMode, DeviceType } from '../models/enums';
import { FlashConfig, SerialDevice } from '../models/types';

// ── Dependencies interface ──────────────────────────────────────────────

interface FlashCommandDeps {
    readonly esptoolService: EsptoolService;
    readonly westFlashService: WestFlashService;
    readonly deviceDetectionService: DeviceDetectionService;
    readonly checksumService: ChecksumService;
    readonly logger: Logger;
}

// ── Registration ────────────────────────────────────────────────────────

/**
 * Registers all ESP32 flash-related commands.
 *
 * Supports two flash modes:
 *   - **esptool** — flashes pre-built `.bin` files downloaded from GitHub Releases.
 *   - **west** — flashes from a local Zephyr build directory via `west flash`.
 *
 * The active mode is controlled by `porterRobot.flash.mode` and can be toggled
 * with the `porterRobot.selectFlashMode` command.
 */
export function register(deps: FlashCommandDeps): vscode.Disposable[] {
    const { esptoolService, westFlashService, deviceDetectionService, logger } = deps;

    return [
        vscode.commands.registerCommand(
            'porterRobot.flashMotorController',
            () => flashFirmware(DeviceType.MotorController, deps),
        ),

        vscode.commands.registerCommand(
            'porterRobot.flashSensorFusion',
            () => flashFirmware(DeviceType.SensorFusion, deps),
        ),

        vscode.commands.registerCommand(
            'porterRobot.flashCustom',
            () => flashCustom(esptoolService, deviceDetectionService, logger),
        ),

        vscode.commands.registerCommand(
            'porterRobot.westFlashMotor',
            () => westFlashDirect(DeviceType.MotorController, westFlashService, logger),
        ),

        vscode.commands.registerCommand(
            'porterRobot.westFlashSensor',
            () => westFlashDirect(DeviceType.SensorFusion, westFlashService, logger),
        ),

        vscode.commands.registerCommand(
            'porterRobot.selectFlashMode',
            () => selectFlashMode(logger),
        ),
    ];
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Human-readable labels for firmware targets. */
const FIRMWARE_LABELS: Readonly<Record<DeviceType, string>> = {
    [DeviceType.MotorController]: 'Motor Controller',
    [DeviceType.SensorFusion]: 'Sensor Fusion',
    [DeviceType.Unknown]: 'Unknown',
};

/** Expected binary filenames per device type. */
const FIRMWARE_FILENAMES: Readonly<Partial<Record<DeviceType, string>>> = {
    [DeviceType.MotorController]: 'motor_controller.bin',
    [DeviceType.SensorFusion]: 'sensor_fusion.bin',
};

// ── Flash firmware (auto-dispatch) ──────────────────────────────────────

/**
 * Auto-dispatches to esptool or west flash based on `Settings.flash.mode`.
 */
async function flashFirmware(
    deviceType: DeviceType,
    deps: FlashCommandDeps,
): Promise<void> {
    const mode = Settings.flash.mode;
    const label = FIRMWARE_LABELS[deviceType];

    deps.logger.info(`Flash ${label} requested (mode: ${mode})`);

    if (mode === FlashMode.West) {
        await flashViaWest(deviceType, deps.westFlashService, deps.logger);
    } else {
        await flashViaEsptool(deviceType, deps);
    }
}

// ── Esptool flash flow ──────────────────────────────────────────────────

async function flashViaEsptool(
    deviceType: DeviceType,
    deps: FlashCommandDeps,
): Promise<void> {
    const { esptoolService, deviceDetectionService, checksumService, logger } = deps;
    const label = FIRMWARE_LABELS[deviceType];
    const filename = FIRMWARE_FILENAMES[deviceType];

    if (!filename) {
        vscode.window.showErrorMessage(`No firmware filename configured for device type: ${label}.`);
        return;
    }

    // 1. Select serial port
    const port = await pickSerialPort(deviceDetectionService, logger);
    if (!port) {
        return; // User cancelled
    }

    // 2. Locate the firmware binary from the latest downloaded version
    const firmwarePath = await findDownloadedFirmware(filename, logger);
    if (!firmwarePath) {
        return;
    }

    // 3. Verify checksum if SHA256SUMS.txt is available
    const checksumOk = await verifyFirmwareChecksum(firmwarePath, filename, checksumService, logger);
    if (!checksumOk) {
        const proceed = await vscode.window.showWarningMessage(
            `Checksum verification failed for ${filename}. The file may be corrupted. Flash anyway?`,
            { modal: true },
            'Flash Anyway',
        );
        if (proceed !== 'Flash Anyway') {
            logger.info('User cancelled flash after checksum mismatch');
            return;
        }
    }

    // 4. Flash with progress
    const config: FlashConfig = {
        port,
        firmwarePath,
        chip: Settings.flash.chip,
        baudRate: Settings.flash.baudRate,
        flashAddress: Settings.flash.address,
        mode: FlashMode.Esptool,
    };

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Flashing ${label}`,
            cancellable: true,
        },
        async (progress, token) => {
            token.onCancellationRequested(() => {
                logger.info(`Flash ${label} cancelled by user`);
                esptoolService.cancel();
            });

            try {
                await esptoolService.flash(config, (flashProgress) => {
                    progress.report({
                        message: flashProgress.message,
                        increment: undefined,
                    });
                    // Report absolute percentage — VS Code handles delta internally
                    // when we omit `increment` and provide only `message`.
                });

                vscode.window.showInformationMessage(
                    `${label} firmware flashed successfully to ${port}.`,
                );
            } catch (err: unknown) {
                if (token.isCancellationRequested) {
                    vscode.window.showWarningMessage(`Flash ${label} was cancelled.`);
                    return;
                }

                const message = err instanceof Error ? err.message : String(err);
                logger.error(`Flash ${label} failed`, message);
                vscode.window.showErrorMessage(
                    `Failed to flash ${label}: ${message}`,
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

// ── West flash flow ─────────────────────────────────────────────────────

async function flashViaWest(
    deviceType: DeviceType,
    westFlashService: WestFlashService,
    logger: Logger,
): Promise<void> {
    const label = FIRMWARE_LABELS[deviceType];

    // Resolve build directory
    const buildDir = await resolveBuildDir(logger);
    if (!buildDir) {
        return;
    }

    await executeWestFlash(buildDir, label, westFlashService, logger);
}

async function westFlashDirect(
    deviceType: DeviceType,
    westFlashService: WestFlashService,
    logger: Logger,
): Promise<void> {
    const label = FIRMWARE_LABELS[deviceType];

    const buildDir = await resolveBuildDir(logger);
    if (!buildDir) {
        return;
    }

    await executeWestFlash(buildDir, label, westFlashService, logger);
}

async function executeWestFlash(
    buildDir: string,
    label: string,
    westFlashService: WestFlashService,
    logger: Logger,
): Promise<void> {
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `West Flash: ${label}`,
            cancellable: true,
        },
        async (progress, token) => {
            token.onCancellationRequested(() => {
                logger.info(`West flash ${label} cancelled by user`);
                westFlashService.cancel();
            });

            try {
                progress.report({ message: 'Starting west flash...' });

                await westFlashService.flash(buildDir, undefined, (flashProgress) => {
                    progress.report({ message: flashProgress.message });
                });

                vscode.window.showInformationMessage(
                    `${label} flashed successfully via west.`,
                );
            } catch (err: unknown) {
                if (token.isCancellationRequested) {
                    vscode.window.showWarningMessage(`West flash ${label} was cancelled.`);
                    return;
                }

                const message = err instanceof Error ? err.message : String(err);
                logger.error(`West flash ${label} failed`, message);
                vscode.window.showErrorMessage(
                    `Failed to flash ${label} via west: ${message}`,
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

// ── Flash custom binary ─────────────────────────────────────────────────

async function flashCustom(
    esptoolService: EsptoolService,
    deviceDetectionService: DeviceDetectionService,
    logger: Logger,
): Promise<void> {
    logger.info('Flash Custom binary requested');

    // 1. Select serial port
    const port = await pickSerialPort(deviceDetectionService, logger);
    if (!port) {
        return;
    }

    // 2. Browse for binary file
    const fileUris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
            'Firmware Binary': ['bin', 'hex', 'elf'],
            'All Files': ['*'],
        },
        openLabel: 'Select Firmware Binary',
        title: 'Select firmware binary to flash',
    });

    if (!fileUris || fileUris.length === 0) {
        logger.info('User cancelled firmware file selection');
        return;
    }

    const firmwarePath = fileUris[0].fsPath;

    // 3. Input flash address
    const address = await vscode.window.showInputBox({
        prompt: 'Enter flash address (hex)',
        value: Settings.flash.address,
        placeHolder: '0x1000',
        validateInput: (value) => {
            if (!/^0x[0-9a-fA-F]+$/.test(value.trim())) {
                return 'Enter a valid hex address (e.g., 0x1000)';
            }
            return undefined;
        },
    });

    if (address === undefined) {
        logger.info('User cancelled address input');
        return;
    }

    // 4. Flash
    const config: FlashConfig = {
        port,
        firmwarePath,
        chip: Settings.flash.chip,
        baudRate: Settings.flash.baudRate,
        flashAddress: address.trim(),
        mode: FlashMode.Esptool,
    };

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Flashing Custom Binary',
            cancellable: true,
        },
        async (progress, token) => {
            token.onCancellationRequested(() => {
                logger.info('Custom flash cancelled by user');
                esptoolService.cancel();
            });

            try {
                await esptoolService.flash(config, (flashProgress) => {
                    progress.report({ message: flashProgress.message });
                });

                vscode.window.showInformationMessage(
                    `Custom firmware flashed successfully to ${port}.`,
                );
            } catch (err: unknown) {
                if (token.isCancellationRequested) {
                    vscode.window.showWarningMessage('Custom flash was cancelled.');
                    return;
                }

                const message = err instanceof Error ? err.message : String(err);
                logger.error('Custom flash failed', message);
                vscode.window.showErrorMessage(
                    `Failed to flash custom binary: ${message}`,
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

// ── Select flash mode ───────────────────────────────────────────────────

async function selectFlashMode(logger: Logger): Promise<void> {
    const currentMode = Settings.flash.mode;

    const items: vscode.QuickPickItem[] = [
        {
            label: 'esptool',
            description: 'Flash pre-built .bin files from GitHub Releases',
            detail: currentMode === FlashMode.Esptool ? '(currently selected)' : undefined,
        },
        {
            label: 'west',
            description: 'Flash from a local Zephyr build directory via west flash',
            detail: currentMode === FlashMode.West ? '(currently selected)' : undefined,
        },
    ];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Current flash mode: ${currentMode}`,
        title: 'Select Flash Mode',
    });

    if (!selected) {
        return;
    }

    const newMode = selected.label === 'west' ? FlashMode.West : FlashMode.Esptool;

    if (newMode === currentMode) {
        logger.info(`Flash mode unchanged: ${currentMode}`);
        return;
    }

    await Settings.flash.setMode(newMode);
    logger.info(`Flash mode changed to: ${newMode}`);
    vscode.window.showInformationMessage(`Flash mode set to: ${newMode}`);
}

// ── Shared utility functions ────────────────────────────────────────────

/**
 * Shows a quick-pick of detected serial ports and returns the selected port path,
 * or `undefined` if the user cancels.
 *
 * If only one device is detected, it is auto-selected.
 */
async function pickSerialPort(
    deviceDetectionService: DeviceDetectionService,
    logger: Logger,
): Promise<string | undefined> {
    const devices = await deviceDetectionService.scanDevices();

    if (devices.length === 0) {
        vscode.window.showErrorMessage(
            'No serial devices detected. Check that the ESP32 is connected via USB and try scanning again.',
        );
        return undefined;
    }

    if (devices.length === 1) {
        logger.info(`Auto-selected single detected port: ${devices[0].port}`);
        return devices[0].port;
    }

    const items: vscode.QuickPickItem[] = devices.map((d) => ({
        label: d.port,
        description: formatDeviceDescription(d),
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select serial port',
        title: 'Serial Port',
    });

    return selected?.label;
}

function formatDeviceDescription(device: SerialDevice): string {
    const parts: string[] = [];

    if (device.deviceType !== DeviceType.Unknown) {
        parts.push(FIRMWARE_LABELS[device.deviceType]);
    }
    if (device.manufacturer) {
        parts.push(device.manufacturer);
    }
    if (device.vendorId && device.productId) {
        parts.push(`VID:PID ${device.vendorId}:${device.productId}`);
    }

    return parts.length > 0 ? parts.join(' — ') : 'Unknown Device';
}

/**
 * Finds the most recently downloaded firmware binary by searching the
 * artifacts directory for versioned subdirectories containing the file.
 */
async function findDownloadedFirmware(
    filename: string,
    logger: Logger,
): Promise<string | undefined> {
    const artifactsDir = Settings.artifactsDir;

    try {
        await fs.promises.access(artifactsDir, fs.constants.R_OK);
    } catch {
        vscode.window.showErrorMessage(
            `Artifacts directory not found: ${artifactsDir}. ` +
            'Download a release first using the Releases panel.',
        );
        return undefined;
    }

    // List version directories, sorted by modification time descending
    let versionDirs: string[];
    try {
        const entries = await fs.promises.readdir(artifactsDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory());

        // Sort by modification time, newest first
        const withStats = await Promise.all(
            dirs.map(async (d) => {
                const fullPath = `${artifactsDir}/${d.name}`;
                const stat = await fs.promises.stat(fullPath);
                return { name: d.name, mtime: stat.mtimeMs };
            }),
        );
        withStats.sort((a, b) => b.mtime - a.mtime);
        versionDirs = withStats.map((d) => d.name);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to list artifacts directory', message);
        vscode.window.showErrorMessage(
            `Failed to read artifacts directory: ${message}`,
        );
        return undefined;
    }

    // Search for the firmware file in each version directory
    for (const version of versionDirs) {
        const candidatePath = Settings.resolveArtifactPath(version, filename);
        try {
            await fs.promises.access(candidatePath, fs.constants.R_OK);
            logger.info(`Found firmware: ${candidatePath}`);
            return candidatePath;
        } catch {
            // Not in this version directory, continue searching
        }
    }

    vscode.window.showErrorMessage(
        `Firmware file "${filename}" not found in any downloaded release. ` +
        'Download it from the Releases panel first.',
        'Open Releases',
    ).then((action) => {
        if (action === 'Open Releases') {
            vscode.commands.executeCommand('porterRobot.refreshReleases');
        }
    });

    return undefined;
}

/**
 * Verifies a firmware binary against SHA256SUMS.txt in the same directory.
 *
 * Returns `true` if checksum matches or if SHA256SUMS.txt is not available
 * (verification skipped). Returns `false` only on actual mismatch.
 */
async function verifyFirmwareChecksum(
    firmwarePath: string,
    filename: string,
    checksumService: ChecksumService,
    logger: Logger,
): Promise<boolean> {
    const dir = firmwarePath.substring(0, firmwarePath.lastIndexOf('/'));
    // Also handle Windows backslash paths
    const dirWin = firmwarePath.substring(0, firmwarePath.lastIndexOf('\\'));
    const artifactsDir = dir.length > dirWin.length ? dir : dirWin;

    const sumsPath = `${artifactsDir}/SHA256SUMS.txt`;

    try {
        await fs.promises.access(sumsPath, fs.constants.R_OK);
    } catch {
        // No checksums file available — skip verification
        logger.info('SHA256SUMS.txt not found, skipping checksum verification');
        return true;
    }

    try {
        const expectedMap = await checksumService.parseSha256Sums(sumsPath);
        const expectedHash = expectedMap.get(filename);

        if (!expectedHash) {
            logger.info(`No checksum entry for ${filename} in SHA256SUMS.txt, skipping`);
            return true;
        }

        const actualHash = await checksumService.computeSha256(firmwarePath);
        const match = actualHash === expectedHash;

        if (match) {
            logger.info(`Checksum verified for ${filename}`);
        } else {
            logger.error(
                `Checksum mismatch for ${filename}: expected ${expectedHash}, got ${actualHash}`,
            );
        }

        return match;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(`Checksum verification error for ${filename}: ${message}`);
        // Treat verification errors as non-blocking
        return true;
    }
}

/**
 * Resolves the Zephyr build directory from settings or by prompting the user.
 */
async function resolveBuildDir(logger: Logger): Promise<string | undefined> {
    const configured = Settings.west.buildDir;

    if (configured) {
        try {
            await fs.promises.access(configured, fs.constants.R_OK);
            logger.info(`Using configured build dir: ${configured}`);
            return configured;
        } catch {
            logger.warn(`Configured build dir not accessible: ${configured}`);
        }
    }

    // Prompt user to browse for build directory
    const folderUris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Build Directory',
        title: 'Select Zephyr build directory (contains zephyr/zephyr.elf)',
    });

    if (!folderUris || folderUris.length === 0) {
        logger.info('User cancelled build directory selection');
        return undefined;
    }

    const selectedDir = folderUris[0].fsPath;

    // Offer to save the selection
    const save = await vscode.window.showInformationMessage(
        `Save "${selectedDir}" as the default build directory?`,
        'Save',
        'Use Once',
    );

    if (save === 'Save') {
        await Settings.west.setBuildDir(selectedDir);
        logger.info(`Saved build dir to settings: ${selectedDir}`);
    }

    return selectedDir;
}
