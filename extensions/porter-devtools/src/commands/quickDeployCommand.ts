import * as vscode from 'vscode';
import * as fs from 'fs';

import { GitHubService } from '../services/githubService';
import { ChecksumService } from '../services/checksumService';
import { EsptoolService } from '../services/esptoolService';
import { WestFlashService } from '../services/westFlashService';
import { SshService } from '../services/sshService';
import { DeviceDetectionService } from '../services/deviceDetectionService';
import { ReleasesTreeProvider, ReleaseTreeItem } from '../providers/releasesTreeProvider';
import { Logger } from '../utils/logger';
import { Settings } from '../config/settings';
import { ArtifactType, FlashMode, DeviceType } from '../models/enums';
import { PorterRelease, ReleaseArtifact, SerialDevice } from '../models/types';


// ── Dependencies ──────────────────────────────────────────────────────

interface QuickDeployDeps {
    readonly githubService: GitHubService;
    readonly checksumService: ChecksumService;
    readonly esptoolService: EsptoolService;
    readonly westFlashService: WestFlashService;
    readonly sshService: SshService;
    readonly deviceDetectionService: DeviceDetectionService;
    readonly releasesTreeProvider: ReleasesTreeProvider;
    readonly logger: Logger;
}

// ── Artifact-to-target mapping ────────────────────────────────────────

interface DeployTarget {
    readonly artifact: ReleaseArtifact;
    readonly targetLabel: string;
    readonly targetDetail: string;
    readonly action: 'flash_motor' | 'flash_sensor' | 'deploy_docker' | 'deploy_gui' | 'skip';
}

// ── Registration ──────────────────────────────────────────────────────

export function register(deps: QuickDeployDeps): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand(
            'porterRobot.quickDeploy',
            (item?: ReleaseTreeItem) => quickDeploy(item, deps),
        ),
    ];
}

// ── Quick Deploy workflow ─────────────────────────────────────────────

async function quickDeploy(
    item: ReleaseTreeItem | undefined,
    deps: QuickDeployDeps,
): Promise<void> {
    const { githubService, checksumService, esptoolService, westFlashService,
        sshService, deviceDetectionService, releasesTreeProvider, logger } = deps;

    // 1. Resolve which release
    let release: PorterRelease | undefined;
    if (item?.data.kind === 'release') {
        release = item.data.release;
    } else {
        release = await pickRelease(githubService, logger);
    }

    if (!release) {
        return;
    }

    logger.info(`Quick Deploy started for ${release.tag}`);

    // 2. Auto-map artifacts to targets
    const targets = mapArtifactsToTargets(release);

    if (targets.length === 0) {
        vscode.window.showWarningMessage(`No deployable artifacts found in ${release.tag}.`);
        return;
    }

    // 3. Detect connected hardware
    const devices = await deviceDetectionService.scanDevices();
    const rpiConfigured = Settings.rpi.host.length > 0;
    const flashMode = Settings.flash.mode;

    // 4. Show confirmation with auto-mapped deployment plan
    const plan = buildDeploymentPlan(targets, devices, rpiConfigured, flashMode);
    const confirmed = await showDeploymentPlan(release.tag, plan);

    if (!confirmed) {
        logger.info('Quick Deploy cancelled by user');
        return;
    }

    // 5. Execute the full workflow
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Quick Deploy — ${release.tag}`,
            cancellable: true,
        },
        async (progress, token) => {
            const totalSteps = plan.filter(p => p.action !== 'skip').length * 2; // download + deploy
            let currentStep = 0;

            const reportStep = (msg: string): void => {
                currentStep++;
                const pct = Math.round((currentStep / totalSteps) * 100);
                progress.report({ message: msg, increment: pct - (currentStep > 1 ? Math.round(((currentStep - 1) / totalSteps) * 100) : 0) });
            };

            const results: DeployResult[] = [];

            for (const target of plan) {
                if (token.isCancellationRequested) {
                    break;
                }

                if (target.action === 'skip') {
                    results.push({ target, success: false, skipped: true, message: target.skipReason ?? 'Skipped' });
                    continue;
                }

                // Step A: Download artifact
                reportStep(`Downloading ${target.artifact.name}...`);
                const localPath = Settings.resolveArtifactPath(release.tag, target.artifact.name);

                try {
                    const exists = await fileExists(localPath);
                    if (!exists) {
                        await githubService.downloadArtifact(
                            target.artifact,
                            release.tag,
                            (dp) => {
                                progress.report({ message: `Downloading ${target.artifact.name} (${dp.percentage}%)` });
                            },
                        );
                        releasesTreeProvider.markArtifactDownloaded(release.tag, target.artifact.name, localPath);
                    } else {
                        logger.info(`Already downloaded: ${target.artifact.name}`);
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    results.push({ target, success: false, skipped: false, message: `Download failed: ${msg}` });
                    continue;
                }

                if (token.isCancellationRequested) {
                    break;
                }

                // Verify checksum
                try {
                    const sumsPath = Settings.resolveArtifactPath(release.tag, 'SHA256SUMS.txt');
                    if (await fileExists(sumsPath)) {
                        const expected = await checksumService.parseSha256Sums(sumsPath);
                        const hash = expected.get(target.artifact.name);
                        if (hash) {
                            const actual = await checksumService.computeSha256(localPath);
                            if (actual !== hash) {
                                results.push({ target, success: false, skipped: false, message: 'Checksum mismatch — file may be corrupted' });
                                continue;
                            }
                        }
                    }
                } catch {
                    // Checksum verification is best-effort
                }

                // Step B: Flash or deploy
                reportStep(`${target.actionLabel}...`);

                try {
                    switch (target.action) {
                        case 'flash_motor':
                        case 'flash_sensor': {
                            const port = target.assignedPort;
                            if (!port) {
                                results.push({ target, success: false, skipped: false, message: 'No ESP32 port assigned' });
                                continue;
                            }

                            if (flashMode === FlashMode.Esptool) {
                                await esptoolService.flash(
                                    {
                                        port,
                                        firmwarePath: localPath,
                                        chip: Settings.flash.chip,
                                        baudRate: Settings.flash.baudRate,
                                        flashAddress: Settings.flash.address,
                                        mode: FlashMode.Esptool,
                                    },
                                    (fp) => {
                                        progress.report({ message: `Flashing ${target.artifact.name} (${fp.percentage}%)` });
                                    },
                                );
                            } else {
                                const buildDir = Settings.west.buildDir;
                                if (!buildDir) {
                                    results.push({ target, success: false, skipped: false, message: 'West build directory not configured' });
                                    continue;
                                }
                                await westFlashService.flash(buildDir, port, (fp) => {
                                    progress.report({ message: `Flashing via west (${fp.percentage}%)` });
                                });
                            }
                            results.push({ target, success: true, skipped: false, message: `Flashed to ${port}` });
                            break;
                        }

                        case 'deploy_docker': {
                            const host = Settings.rpi.host;
                            const username = Settings.rpi.username;
                            const keyPath = Settings.rpi.sshKeyPath;
                            const composePath = Settings.rpi.dockerComposePath;

                            await sshService.connect(host, username, keyPath);
                            await sshService.deployDockerImage(localPath, release.tag, composePath);
                            sshService.disconnect();
                            results.push({ target, success: true, skipped: false, message: `Deployed to ${host}` });
                            break;
                        }

                        case 'deploy_gui': {
                            const host = Settings.rpi.host;
                            const username = Settings.rpi.username;
                            const keyPath = Settings.rpi.sshKeyPath;
                            const guiPath = Settings.rpi.guiInstallPath;

                            if (!sshService.isConnected()) {
                                await sshService.connect(host, username, keyPath);
                            }
                            await sshService.deployFlutterGui(localPath, guiPath);
                            sshService.disconnect();
                            results.push({ target, success: true, skipped: false, message: `Deployed to ${host}` });
                            break;
                        }
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    results.push({ target, success: false, skipped: false, message: msg });
                    logger.error(`Quick Deploy step failed: ${target.artifact.name}`, msg);
                }
            }

            // Show summary
            showDeployResults(release.tag, results, logger);
        },
    );
}

// ── Artifact classification ───────────────────────────────────────────

function mapArtifactsToTargets(release: PorterRelease): DeployTarget[] {
    const targets: DeployTarget[] = [];

    for (const artifact of release.assets) {
        switch (artifact.type) {
            case ArtifactType.MotorFirmware:
                targets.push({
                    artifact,
                    targetLabel: 'ESP32 #1 — Motor Controller',
                    targetDetail: 'Flash motor_controller.bin via esptool/west',
                    action: 'flash_motor',
                });
                break;
            case ArtifactType.SensorFirmware:
                targets.push({
                    artifact,
                    targetLabel: 'ESP32 #2 — Sensor Fusion',
                    targetDetail: 'Flash sensor_fusion.bin via esptool/west',
                    action: 'flash_sensor',
                });
                break;
            case ArtifactType.DockerImage:
                targets.push({
                    artifact,
                    targetLabel: 'Raspberry Pi — Docker',
                    targetDetail: 'Upload + docker load + docker compose up',
                    action: 'deploy_docker',
                });
                break;
            case ArtifactType.FlutterGui:
                targets.push({
                    artifact,
                    targetLabel: 'Raspberry Pi — Flutter GUI',
                    targetDetail: 'Upload + extract bundle',
                    action: 'deploy_gui',
                });
                break;
            default:
                // Checksums, build info, debug ELFs — not deployable
                break;
        }
    }

    return targets;
}

// ── Deployment plan ───────────────────────────────────────────────────

interface PlannedDeploy {
    readonly artifact: ReleaseArtifact;
    readonly action: 'flash_motor' | 'flash_sensor' | 'deploy_docker' | 'deploy_gui' | 'skip';
    readonly actionLabel: string;
    readonly targetLabel: string;
    readonly assignedPort?: string;
    readonly ready: boolean;
    readonly skipReason?: string;
}

interface DeployResult {
    readonly target: PlannedDeploy;
    readonly success: boolean;
    readonly skipped: boolean;
    readonly message: string;
}

function buildDeploymentPlan(
    targets: DeployTarget[],
    devices: readonly SerialDevice[],
    rpiConfigured: boolean,
    flashMode: FlashMode,
): PlannedDeploy[] {
    // Try to auto-assign ESP32 ports based on identified device type
    const motorPort = devices.find(d => d.deviceType === DeviceType.MotorController)?.port;
    const sensorPort = devices.find(d => d.deviceType === DeviceType.SensorFusion)?.port;

    // If devices aren't identified yet, assign by order (first = motor, second = sensor)
    const unidentifiedPorts = devices
        .filter(d => d.deviceType === DeviceType.Unknown)
        .map(d => d.port);

    return targets.map((target): PlannedDeploy => {
        switch (target.action) {
            case 'flash_motor': {
                const port = motorPort ?? unidentifiedPorts[0];
                if (!port) {
                    return {
                        ...target,
                        actionLabel: 'Flash Motor Controller',
                        ready: false,
                        skipReason: 'No ESP32 connected',
                        action: 'skip',
                    };
                }
                return {
                    ...target,
                    actionLabel: `Flash Motor Controller → ${port} (${flashMode})`,
                    assignedPort: port,
                    ready: true,
                };
            }

            case 'flash_sensor': {
                const port = sensorPort ?? unidentifiedPorts[1] ?? unidentifiedPorts[0];
                if (!port) {
                    return {
                        ...target,
                        actionLabel: 'Flash Sensor Fusion',
                        ready: false,
                        skipReason: 'No ESP32 connected',
                        action: 'skip',
                    };
                }
                return {
                    ...target,
                    actionLabel: `Flash Sensor Fusion → ${port} (${flashMode})`,
                    assignedPort: port,
                    ready: true,
                };
            }

            case 'deploy_docker': {
                if (!rpiConfigured) {
                    return {
                        ...target,
                        actionLabel: 'Deploy Docker Image',
                        ready: false,
                        skipReason: 'RPi not configured (set porterRobot.rpi.host)',
                        action: 'skip',
                    };
                }
                return {
                    ...target,
                    actionLabel: `Deploy Docker Image → ${Settings.rpi.host}`,
                    ready: true,
                };
            }

            case 'deploy_gui': {
                if (!rpiConfigured) {
                    return {
                        ...target,
                        actionLabel: 'Deploy Flutter GUI',
                        ready: false,
                        skipReason: 'RPi not configured (set porterRobot.rpi.host)',
                        action: 'skip',
                    };
                }
                return {
                    ...target,
                    actionLabel: `Deploy Flutter GUI → ${Settings.rpi.host}`,
                    ready: true,
                };
            }

            default:
                return {
                    ...target,
                    actionLabel: target.targetLabel,
                    ready: false,
                    action: 'skip',
                };
        }
    });
}

// ── Confirmation dialog ───────────────────────────────────────────────

async function showDeploymentPlan(
    releaseTag: string,
    plan: PlannedDeploy[],
): Promise<boolean> {
    const readySteps = plan.filter(p => p.action !== 'skip');
    const skippedSteps = plan.filter(p => p.action === 'skip');

    const lines: string[] = [`Deploy ${releaseTag} to Porter Robot?\n`];

    if (readySteps.length > 0) {
        lines.push('WILL EXECUTE:');
        for (const step of readySteps) {
            lines.push(`  ✓ ${step.actionLabel}`);
        }
    }

    if (skippedSteps.length > 0) {
        lines.push('\nSKIPPED (hardware not available):');
        for (const step of skippedSteps) {
            lines.push(`  ✗ ${step.targetLabel} — ${step.skipReason}`);
        }
    }

    if (readySteps.length === 0) {
        vscode.window.showWarningMessage(
            `No hardware available for ${releaseTag}. Connect ESP32 devices or configure RPi first.`,
        );
        return false;
    }

    const result = await vscode.window.showInformationMessage(
        lines.join('\n'),
        { modal: true },
        'Deploy',
        'Cancel',
    );

    return result === 'Deploy';
}

// ── Results summary ───────────────────────────────────────────────────

function showDeployResults(
    releaseTag: string,
    results: DeployResult[],
    logger: Logger,
): void {
    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success && !r.skipped);
    const skipped = results.filter(r => r.skipped);

    logger.info(`--- Quick Deploy Results: ${releaseTag} ---`);
    for (const r of results) {
        const icon = r.success ? 'OK' : r.skipped ? 'SKIP' : 'FAIL';
        logger.info(`  [${icon}] ${r.target.artifact.name} → ${r.message}`);
    }
    logger.info(`--- ${succeeded.length} succeeded, ${failed.length} failed, ${skipped.length} skipped ---`);

    if (failed.length === 0 && succeeded.length > 0) {
        vscode.window.showInformationMessage(
            `Quick Deploy ${releaseTag} complete: ${succeeded.length} artifact(s) deployed successfully.`,
        );
    } else if (failed.length > 0) {
        const failNames = failed.map(r => r.target.artifact.name).join(', ');
        vscode.window.showWarningMessage(
            `Quick Deploy ${releaseTag}: ${succeeded.length} succeeded, ${failed.length} failed (${failNames}).`,
            'Show Output',
        ).then((action) => {
            if (action === 'Show Output') {
                logger.show();
            }
        });
    } else {
        vscode.window.showWarningMessage(
            `Quick Deploy ${releaseTag}: No artifacts were deployed. Connect hardware and try again.`,
        );
    }
}

// ── Release picker ────────────────────────────────────────────────────

async function pickRelease(
    githubService: GitHubService,
    logger: Logger,
): Promise<PorterRelease | undefined> {
    let releases: PorterRelease[];
    try {
        releases = await githubService.listReleases();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Failed to fetch releases for Quick Deploy', msg);
        vscode.window.showErrorMessage(`Failed to fetch releases: ${msg}`);
        return undefined;
    }

    if (releases.length === 0) {
        vscode.window.showInformationMessage('No releases available.');
        return undefined;
    }

    interface ReleaseQuickPick extends vscode.QuickPickItem {
        readonly release: PorterRelease;
    }

    const items: ReleaseQuickPick[] = releases.map((r, i) => ({
        label: r.tag,
        description: [
            r.prerelease ? '(prerelease)' : i === 0 ? '(latest)' : '',
            new Date(r.date).toLocaleDateString(),
        ].filter(Boolean).join('  '),
        detail: `${r.assets.length} artifacts — ${r.assets.map(a => a.name).join(', ')}`,
        release: r,
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select release version to deploy',
        title: 'Quick Deploy — Select Version',
    });

    return selected?.release;
}

// ── Helpers ───────────────────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
}
