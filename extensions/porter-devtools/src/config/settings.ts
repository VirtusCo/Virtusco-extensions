import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

import { FlashMode } from '../models/enums';
import {
    ESP32_CHIP,
    ESP32_FLASH_ADDRESS,
    ESP32_FLASH_BAUD,
    ESP32_MONITOR_BAUD,
    GITHUB_OWNER,
    GITHUB_REPO,
    DEVICE_POLL_INTERVAL_MS,
} from '../constants';

const SECTION = 'porterRobot';

function get<T>(key: string, fallback: T): T {
    return vscode.workspace.getConfiguration(SECTION).get<T>(key, fallback);
}

async function set(key: string, value: unknown, global = true): Promise<void> {
    const target = global
        ? vscode.ConfigurationTarget.Global
        : vscode.ConfigurationTarget.Workspace;
    await vscode.workspace.getConfiguration(SECTION).update(key, value, target);
}

export const Settings = {
    github: {
        get token(): string { return get<string>('github.token', ''); },
        get owner(): string { return get<string>('github.owner', GITHUB_OWNER); },
        get repo(): string { return get<string>('github.repo', GITHUB_REPO); },
        setToken: (v: string): Promise<void> => set('github.token', v),
    },

    flash: {
        get mode(): FlashMode {
            const raw = get<string>('flash.mode', 'esptool');
            return raw === 'west' ? FlashMode.West : FlashMode.Esptool;
        },
        get baudRate(): number { return get<number>('flash.baudRate', ESP32_FLASH_BAUD); },
        get address(): string { return get<string>('flash.address', ESP32_FLASH_ADDRESS); },
        get chip(): string { return get<string>('flash.chip', ESP32_CHIP); },
        setMode: (v: FlashMode): Promise<void> => set('flash.mode', v),
    },

    esptool: {
        get path(): string { return get<string>('esptool.path', ''); },
        setPath: (v: string): Promise<void> => set('esptool.path', v),
    },

    west: {
        get path(): string { return get<string>('west.path', ''); },
        get buildDir(): string { return get<string>('west.buildDir', ''); },
        setPath: (v: string): Promise<void> => set('west.path', v),
        setBuildDir: (v: string): Promise<void> => set('west.buildDir', v),
    },

    rpi: {
        get host(): string { return get<string>('rpi.host', ''); },
        get username(): string { return get<string>('rpi.username', 'pi'); },
        get sshKeyPath(): string {
            const raw = get<string>('rpi.sshKeyPath', '~/.ssh/id_rsa');
            return raw.replace(/^~/, os.homedir());
        },
        get dockerComposePath(): string {
            return get<string>('rpi.dockerComposePath', '/home/pi/porter/docker/docker-compose.prod.yml');
        },
        get guiInstallPath(): string {
            return get<string>('rpi.guiInstallPath', '/home/pi/porter/gui');
        },
        setHost: (v: string): Promise<void> => set('rpi.host', v),
        setUsername: (v: string): Promise<void> => set('rpi.username', v),
        setSshKeyPath: (v: string): Promise<void> => set('rpi.sshKeyPath', v),
    },

    serial: {
        get baudRate(): number { return get<number>('serial.baudRate', ESP32_MONITOR_BAUD); },
        get autoScroll(): boolean { return get<boolean>('serial.autoScroll', true); },
    },

    get artifactsDir(): string {
        const raw = get<string>('artifactsDir', '~/.porter-robot/artifacts');
        return raw.replace(/^~/, os.homedir());
    },

    get devicePollIntervalMs(): number {
        return get<number>('deviceDetection.pollIntervalMs', DEVICE_POLL_INTERVAL_MS);
    },

    resolveArtifactPath(version: string, filename: string): string {
        return path.join(Settings.artifactsDir, version, filename);
    },

    resolveVersionDir(version: string): string {
        return path.join(Settings.artifactsDir, version);
    },
} as const;
