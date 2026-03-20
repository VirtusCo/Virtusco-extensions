import * as vscode from 'vscode';
import * as fs from 'fs';

import { SshService } from '../services/sshService';
import { Logger } from '../utils/logger';
import { Settings } from '../config/settings';

// ── Dependencies interface ──────────────────────────────────────────────

interface DeployCommandDeps {
    readonly sshService: SshService;
    readonly logger: Logger;
}

// ── Registration ────────────────────────────────────────────────────────

/**
 * Registers all Raspberry Pi deployment commands.
 *
 * Deploy commands upload pre-built artifacts to the RPi via SSH/SFTP and
 * restart the relevant services. The RPi must be configured first via
 * `porterRobot.configureRpi`.
 */
export function register(deps: DeployCommandDeps): vscode.Disposable[] {
    const { sshService, logger } = deps;

    return [
        vscode.commands.registerCommand(
            'porterRobot.deployDocker',
            () => deployDocker(sshService, logger),
        ),

        vscode.commands.registerCommand(
            'porterRobot.deployFlutterGui',
            () => deployFlutterGui(sshService, logger),
        ),

        vscode.commands.registerCommand(
            'porterRobot.configureRpi',
            () => configureRpi(sshService, logger),
        ),
    ];
}

// ── Validation ──────────────────────────────────────────────────────────

/**
 * Checks that the RPi connection is configured (host is non-empty).
 * Shows an error message with an action to run configuration if not set up.
 *
 * @returns `true` if the RPi is configured, `false` otherwise.
 */
function validateRpiConfigured(logger: Logger): boolean {
    const host = Settings.rpi.host;

    if (!host) {
        logger.warn('RPi deployment attempted but host is not configured');
        vscode.window.showErrorMessage(
            'Raspberry Pi is not configured. Set up the SSH connection first.',
            'Configure RPi',
        ).then((action) => {
            if (action === 'Configure RPi') {
                vscode.commands.executeCommand('porterRobot.configureRpi');
            }
        });
        return false;
    }

    return true;
}

// ── Deploy Docker image ─────────────────────────────────────────────────

async function deployDocker(sshService: SshService, logger: Logger): Promise<void> {
    logger.info('Deploy Docker image requested');

    if (!validateRpiConfigured(logger)) {
        return;
    }

    // Find the Docker image tarball in the latest downloaded release
    const imagePath = await findDockerImage(logger);
    if (!imagePath) {
        return;
    }

    const host = Settings.rpi.host;
    const username = Settings.rpi.username;
    const sshKeyPath = Settings.rpi.sshKeyPath;
    const dockerComposePath = Settings.rpi.dockerComposePath;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Deploying Docker Image to RPi',
            cancellable: true,
        },
        async (progress, token) => {
            try {
                // Step 1: Connect SSH
                progress.report({ message: 'Connecting to RPi...' });
                logger.info(`Connecting to ${username}@${host}`);

                await sshService.connect(host, username, sshKeyPath);

                if (token.isCancellationRequested) {
                    await disconnectQuietly(sshService, logger);
                    return;
                }

                // Step 2: Upload and deploy
                progress.report({ message: 'Uploading Docker image...' });

                await sshService.deployDockerImage(imagePath, 'latest', dockerComposePath);

                if (token.isCancellationRequested) {
                    await disconnectQuietly(sshService, logger);
                    vscode.window.showWarningMessage('Docker deployment was cancelled.');
                    return;
                }

                vscode.window.showInformationMessage(
                    `Docker image deployed successfully to ${host}.`,
                );
                logger.info('Docker deployment completed successfully');
            } catch (err: unknown) {
                if (token.isCancellationRequested) {
                    vscode.window.showWarningMessage('Docker deployment was cancelled.');
                    return;
                }

                const message = err instanceof Error ? err.message : String(err);
                logger.error('Docker deployment failed', message);
                vscode.window.showErrorMessage(
                    `Failed to deploy Docker image: ${message}`,
                    'Show Output',
                ).then((action) => {
                    if (action === 'Show Output') {
                        logger.show();
                    }
                });
            } finally {
                await disconnectQuietly(sshService, logger);
            }
        },
    );
}

// ── Deploy Flutter GUI ──────────────────────────────────────────────────

async function deployFlutterGui(sshService: SshService, logger: Logger): Promise<void> {
    logger.info('Deploy Flutter GUI requested');

    if (!validateRpiConfigured(logger)) {
        return;
    }

    // Find the Flutter GUI tarball in the latest downloaded release
    const guiPath = await findFlutterGui(logger);
    if (!guiPath) {
        return;
    }

    const host = Settings.rpi.host;
    const username = Settings.rpi.username;
    const sshKeyPath = Settings.rpi.sshKeyPath;
    const guiInstallPath = Settings.rpi.guiInstallPath;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Deploying Flutter GUI to RPi',
            cancellable: true,
        },
        async (progress, token) => {
            try {
                // Step 1: Connect SSH
                progress.report({ message: 'Connecting to RPi...' });
                logger.info(`Connecting to ${username}@${host}`);

                await sshService.connect(host, username, sshKeyPath);

                if (token.isCancellationRequested) {
                    await disconnectQuietly(sshService, logger);
                    return;
                }

                // Step 2: Upload and deploy
                progress.report({ message: 'Uploading Flutter GUI bundle...' });

                await sshService.deployFlutterGui(guiPath, guiInstallPath);

                if (token.isCancellationRequested) {
                    await disconnectQuietly(sshService, logger);
                    vscode.window.showWarningMessage('Flutter GUI deployment was cancelled.');
                    return;
                }

                vscode.window.showInformationMessage(
                    `Flutter GUI deployed successfully to ${host}.`,
                );
                logger.info('Flutter GUI deployment completed successfully');
            } catch (err: unknown) {
                if (token.isCancellationRequested) {
                    vscode.window.showWarningMessage('Flutter GUI deployment was cancelled.');
                    return;
                }

                const message = err instanceof Error ? err.message : String(err);
                logger.error('Flutter GUI deployment failed', message);
                vscode.window.showErrorMessage(
                    `Failed to deploy Flutter GUI: ${message}`,
                    'Show Output',
                ).then((action) => {
                    if (action === 'Show Output') {
                        logger.show();
                    }
                });
            } finally {
                await disconnectQuietly(sshService, logger);
            }
        },
    );
}

// ── Configure RPi ───────────────────────────────────────────────────────

async function configureRpi(sshService: SshService, logger: Logger): Promise<void> {
    logger.info('Configure RPi requested');

    // Step 1: Host / IP address
    const host = await vscode.window.showInputBox({
        prompt: 'Enter Raspberry Pi hostname or IP address',
        value: Settings.rpi.host || '',
        placeHolder: '192.168.1.100 or porter-rpi.local',
        validateInput: (value) => {
            const trimmed = value.trim();
            if (!trimmed) {
                return 'Host is required';
            }
            // Basic validation: non-empty, no spaces
            if (/\s/.test(trimmed)) {
                return 'Host must not contain spaces';
            }
            return undefined;
        },
    });

    if (host === undefined) {
        logger.info('User cancelled RPi configuration at host step');
        return;
    }

    // Step 2: Username
    const username = await vscode.window.showInputBox({
        prompt: 'Enter SSH username',
        value: Settings.rpi.username,
        placeHolder: 'pi',
        validateInput: (value) => {
            if (!value.trim()) {
                return 'Username is required';
            }
            return undefined;
        },
    });

    if (username === undefined) {
        logger.info('User cancelled RPi configuration at username step');
        return;
    }

    // Step 3: SSH key path
    const sshKeyItems: vscode.QuickPickItem[] = [
        {
            label: 'Use default key',
            description: Settings.rpi.sshKeyPath,
            detail: 'Use the default SSH private key path',
        },
        {
            label: 'Browse for key file...',
            description: 'Select an SSH private key from disk',
        },
    ];

    const keyChoice = await vscode.window.showQuickPick(sshKeyItems, {
        placeHolder: 'Select SSH authentication method',
        title: 'SSH Key',
    });

    if (!keyChoice) {
        logger.info('User cancelled RPi configuration at SSH key step');
        return;
    }

    let sshKeyPath: string;

    if (keyChoice.label === 'Browse for key file...') {
        const keyUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select SSH Private Key',
            title: 'Select SSH private key file',
            filters: {
                'All Files': ['*'],
            },
        });

        if (!keyUris || keyUris.length === 0) {
            logger.info('User cancelled SSH key file selection');
            return;
        }

        sshKeyPath = keyUris[0].fsPath;
    } else {
        sshKeyPath = Settings.rpi.sshKeyPath;
    }

    // Validate the SSH key file exists
    try {
        await fs.promises.access(sshKeyPath, fs.constants.R_OK);
    } catch {
        const proceed = await vscode.window.showWarningMessage(
            `SSH key file not found: ${sshKeyPath}. Save configuration anyway?`,
            'Save Anyway',
            'Cancel',
        );
        if (proceed !== 'Save Anyway') {
            return;
        }
    }

    // Step 4: Test connection
    const shouldTest = await vscode.window.showInformationMessage(
        `Test connection to ${username.trim()}@${host.trim()}?`,
        'Test Connection',
        'Skip',
    );

    if (shouldTest === 'Test Connection') {
        const connectionOk = await testRpiConnection(
            host.trim(),
            username.trim(),
            sshKeyPath,
            sshService,
            logger,
        );

        if (!connectionOk) {
            const saveAnyway = await vscode.window.showWarningMessage(
                'Connection test failed. Save configuration anyway?',
                'Save Anyway',
                'Cancel',
            );
            if (saveAnyway !== 'Save Anyway') {
                return;
            }
        }
    }

    // Step 5: Save to settings
    await Settings.rpi.setHost(host.trim());
    await Settings.rpi.setUsername(username.trim());
    await Settings.rpi.setSshKeyPath(sshKeyPath);

    logger.info(`RPi configured: ${username.trim()}@${host.trim()}`);
    vscode.window.showInformationMessage(
        `Raspberry Pi configured: ${username.trim()}@${host.trim()}`,
    );
}

// ── Utility functions ───────────────────────────────────────────────────

/**
 * Tests the SSH connection to the RPi with a progress indicator.
 *
 * @returns `true` if the connection succeeds, `false` otherwise.
 */
async function testRpiConnection(
    host: string,
    username: string,
    sshKeyPath: string,
    sshService: SshService,
    logger: Logger,
): Promise<boolean> {
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Testing connection to ${host}...`,
            cancellable: false,
        },
        async () => {
            try {
                await sshService.connect(host, username, sshKeyPath);
                await sshService.disconnect();
                logger.info(`Connection test to ${host} succeeded`);
                vscode.window.showInformationMessage(
                    `Successfully connected to ${username}@${host}.`,
                );
                return true;
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`Connection test to ${host} failed`, message);
                vscode.window.showErrorMessage(
                    `Connection test failed: ${message}`,
                    'Show Output',
                ).then((action) => {
                    if (action === 'Show Output') {
                        logger.show();
                    }
                });
                return false;
            }
        },
    );
}

/**
 * Finds the most recently downloaded Docker image tarball in the artifacts directory.
 */
async function findDockerImage(logger: Logger): Promise<string | undefined> {
    return findArtifactByPattern(/^porter-robot-[\d.]+\.tar\.gz$/, 'Docker image', logger);
}

/**
 * Finds the most recently downloaded Flutter GUI tarball in the artifacts directory.
 */
async function findFlutterGui(logger: Logger): Promise<string | undefined> {
    return findArtifactByPattern(/^porter-gui-linux-x64-[\d.]+\.tar\.gz$/, 'Flutter GUI bundle', logger);
}

/**
 * Searches the artifacts directory for a file matching the given pattern,
 * looking in the most recently modified version directories first.
 */
async function findArtifactByPattern(
    pattern: RegExp,
    label: string,
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

        for (const dir of withStats) {
            const versionDir = `${artifactsDir}/${dir.name}`;
            const files = await fs.promises.readdir(versionDir);

            const match = files.find((f) => pattern.test(f));
            if (match) {
                const fullPath = `${versionDir}/${match}`;
                logger.info(`Found ${label}: ${fullPath}`);
                return fullPath;
            }
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to search for ${label}`, message);
    }

    vscode.window.showErrorMessage(
        `${label} not found in any downloaded release. ` +
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
 * Disconnects the SSH service without throwing. Logs any errors.
 */
async function disconnectQuietly(sshService: SshService, logger: Logger): Promise<void> {
    try {
        await sshService.disconnect();
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('Error disconnecting SSH', message);
    }
}
