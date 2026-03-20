import * as vscode from 'vscode';

import { Logger } from './utils/logger';
import { Settings } from './config/settings';

import { GitHubService } from './services/githubService';
import { SerialService } from './services/serialService';
import { DeviceDetectionService } from './services/deviceDetectionService';
import { EsptoolService } from './services/esptoolService';
import { WestFlashService } from './services/westFlashService';
import { SshService } from './services/sshService';
import { ChecksumService } from './services/checksumService';

import { DevicesTreeProvider } from './providers/devicesTreeProvider';
import { ReleasesTreeProvider } from './providers/releasesTreeProvider';
import { ActionsTreeProvider } from './providers/actionsTreeProvider';

import { StatusBarManager } from './statusBar/statusBarManager';
import { SerialMonitorPanel } from './views/serialMonitorPanel';

import * as flashCommands from './commands/flashCommands';
import * as deployCommands from './commands/deployCommands';
import * as releaseCommands from './commands/releaseCommands';
import * as serialCommands from './commands/serialCommands';
import * as deviceCommands from './commands/deviceCommands';
import * as quickDeployCommand from './commands/quickDeployCommand';


export function activate(context: vscode.ExtensionContext): void {
    const logger = new Logger();
    logger.info('Porter DevTools activating...');

    // ── Services ──────────────────────────────────────────────
    const githubService = new GitHubService(logger);
    const serialService = new SerialService(logger);
    const deviceDetection = new DeviceDetectionService(serialService, logger);
    const esptoolService = new EsptoolService(logger);
    const westFlashService = new WestFlashService(logger);
    const sshService = new SshService(logger);
    const checksumService = new ChecksumService(logger);

    // ── TreeView Providers ────────────────────────────────────
    const devicesProvider = new DevicesTreeProvider(logger);
    const releasesProvider = new ReleasesTreeProvider(logger);
    const actionsProvider = new ActionsTreeProvider(logger);

    const devicesView = vscode.window.createTreeView('porterRobot.devicesView', {
        treeDataProvider: devicesProvider,
        showCollapseAll: true,
    });

    const releasesView = vscode.window.createTreeView('porterRobot.releasesView', {
        treeDataProvider: releasesProvider,
        showCollapseAll: true,
    });

    const actionsView = vscode.window.createTreeView('porterRobot.actionsView', {
        treeDataProvider: actionsProvider,
    });

    // ── Status Bar ────────────────────────────────────────────
    const statusBar = new StatusBarManager(logger);
    statusBar.show();

    // ── Wire Device Detection Events ──────────────────────────
    deviceDetection.onDevicesChanged((event) => {
        const devices = deviceDetection.getDevices();
        devicesProvider.setDevices(devices);
        statusBar.updateEsp32Count(devices.length);

        actionsProvider.updateState({
            esp32Connected: devices.length > 0,
            rpiConnected: sshService.isConnected(),
            motorFirmwareReady: false,
            sensorFirmwareReady: false,
            dockerImageReady: false,
            flutterGuiReady: false,
            anyArtifactsDownloaded: false,
            flashMode: Settings.flash.mode,
        });

        if (event.added.length > 0) {
            const names = event.added.map(d => d.port).join(', ');
            logger.info(`Device(s) connected: ${names}`);
        }
        if (event.removed.length > 0) {
            const names = event.removed.map(d => d.port).join(', ');
            logger.info(`Device(s) disconnected: ${names}`);
        }
    });

    // ── Register Commands ─────────────────────────────────────
    const flashDisposables = flashCommands.register({
        esptoolService,
        westFlashService,
        deviceDetectionService: deviceDetection,
        checksumService,
        logger,
    });

    const deployDisposables = deployCommands.register({
        sshService,
        logger,
    });

    const releaseDisposables = releaseCommands.register({
        githubService,
        checksumService,
        releasesTreeProvider: releasesProvider,
        logger,
    });

    const serialDisposables = serialCommands.register({
        serialService,
        deviceDetectionService: deviceDetection,
        logger,
        extensionUri: context.extensionUri,
    });

    const deviceDisposables = deviceCommands.register({
        deviceDetectionService: deviceDetection,
        devicesTreeProvider: devicesProvider,
        logger,
    });

    const quickDeployDisposables = quickDeployCommand.register({
        githubService,
        checksumService,
        esptoolService,
        westFlashService,
        sshService,
        deviceDetectionService: deviceDetection,
        releasesTreeProvider: releasesProvider,
        logger,
    });

    // ── Push All Disposables ──────────────────────────────────
    context.subscriptions.push(
        logger,
        githubService,
        serialService,
        deviceDetection,
        esptoolService,
        westFlashService,
        sshService,
        devicesView,
        releasesView,
        actionsView,
        statusBar,
        ...flashDisposables,
        ...deployDisposables,
        ...releaseDisposables,
        ...serialDisposables,
        ...deviceDisposables,
        ...quickDeployDisposables,
    );

    // ── Start Background Tasks ────────────────────────────────
    deviceDetection.startPolling(Settings.devicePollIntervalMs);

    // Load releases on activation (non-blocking)
    void githubService.listReleases().then((releases) => {
        releasesProvider.setReleases(releases);
        if (releases.length > 0) {
            statusBar.updateVersion(releases[0].tag);
        }
    }).catch((err: Error) => {
        logger.warn('Failed to load releases on startup:', err.message);
    });

    logger.info('Porter DevTools activated successfully');
}

export function deactivate(): void {
    SerialMonitorPanel.currentPanel?.dispose();
}
