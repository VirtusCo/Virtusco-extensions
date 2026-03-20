import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

import { Logger } from '../utils/logger';
import { FlashProgress } from '../models/types';
import { FlashState } from '../models/enums';
import { Settings } from '../config/settings';
import { findWest } from '../utils/platformUtils';
import { WEST_FLASH_TIMEOUT_MS } from '../constants';

/**
 * Maps recognized `west flash` output fragments to FlashState values.
 * west flash delegates to esptool for ESP32 targets, so many of the
 * same stage indicators appear.
 */
const STATE_MATCHERS: ReadonlyArray<{ readonly pattern: string; readonly state: FlashState }> = [
    { pattern: 'Flashing',            state: FlashState.Connecting },
    { pattern: 'Using runner',        state: FlashState.Connecting },
    { pattern: 'Connecting',          state: FlashState.Connecting },
    { pattern: 'Chip is',             state: FlashState.Connecting },
    { pattern: 'Erasing flash',       state: FlashState.Erasing },
    { pattern: 'Compressed',          state: FlashState.Erasing },
    { pattern: 'Writing at',          state: FlashState.Writing },
    { pattern: 'Wrote',              state: FlashState.Verifying },
    { pattern: 'Hash of data verified', state: FlashState.Verifying },
    { pattern: 'Board flash complete', state: FlashState.Complete },
    { pattern: 'Hard resetting',      state: FlashState.Complete },
    { pattern: 'Leaving',             state: FlashState.Complete },
];

/**
 * Regex that matches esptool-style progress lines printed by west flash:
 *   "Writing at 0x00001000... (3 %)"
 */
const PROGRESS_REGEX = /Writing at 0x[0-9a-fA-F]+\.\.\.\s*\((\d+)\s*%\)/;

/**
 * Known build output subdirectories to search for within a workspace.
 * These correspond to the Porter Robot's two ESP32 firmware targets.
 */
const BUILD_TARGET_DIRS: readonly string[] = [
    'motor_controller',
    'sensor_fusion',
];

/**
 * Relative path from a build target directory to the Zephyr binary.
 */
const ZEPHYR_BIN_RELATIVE = path.join('build', 'zephyr', 'zephyr.bin');

export class WestFlashService implements vscode.Disposable {
    private readonly logger: Logger;
    private activeProcess: ChildProcess | undefined;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Flashes firmware from a local Zephyr build directory using `west flash`.
     *
     * @param buildDir  Absolute path to the Zephyr build directory (containing
     *                  `zephyr/zephyr.bin`).
     * @param port      Optional serial port. If provided, passed as `--esp-port`
     *                  so west / esptool can target a specific device.
     * @param onProgress Optional callback for progress reporting.
     */
    async flash(
        buildDir: string,
        port: string | undefined,
        onProgress?: (progress: FlashProgress) => void,
    ): Promise<void> {
        const westPath = await this.findWest();

        // Validate that the build directory exists
        await this.validateBuildDir(buildDir);

        const args = ['flash', '--build-dir', buildDir];
        if (port) {
            args.push('--esp-port', port);
        }

        this.logger.info(`West flash: ${westPath} ${args.join(' ')}`);

        this.reportProgress(onProgress, FlashState.Connecting, 0, 'Starting west flash...');

        return new Promise<void>((resolve, reject) => {
            const proc = spawn(westPath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            this.activeProcess = proc;

            let lastState: FlashState = FlashState.Connecting;
            let lastPercentage = 0;
            let stderrBuffer = '';

            const timeout = setTimeout(() => {
                this.logger.error(`west flash timed out after ${WEST_FLASH_TIMEOUT_MS}ms`);
                this.killProcess(proc);
                reject(new Error(
                    `west flash timed out after ${WEST_FLASH_TIMEOUT_MS / 1000} seconds. ` +
                    'The device may be unresponsive — try resetting it and flashing again.',
                ));
            }, WEST_FLASH_TIMEOUT_MS);

            proc.stdout?.on('data', (data: Buffer) => {
                const text = data.toString();
                this.logger.debug(`[west stdout] ${text.trimEnd()}`);

                const result = this.parseOutput(text, lastState, lastPercentage);
                lastState = result.state;
                lastPercentage = result.percentage;

                if (result.updated) {
                    this.reportProgress(onProgress, lastState, lastPercentage, result.message);
                }
            });

            proc.stderr?.on('data', (data: Buffer) => {
                const text = data.toString();
                stderrBuffer += text;
                this.logger.debug(`[west stderr] ${text.trimEnd()}`);

                // west flash (and the underlying esptool) may print progress to stderr
                const result = this.parseOutput(text, lastState, lastPercentage);
                lastState = result.state;
                lastPercentage = result.percentage;

                if (result.updated) {
                    this.reportProgress(onProgress, lastState, lastPercentage, result.message);
                }
            });

            proc.on('close', (code) => {
                clearTimeout(timeout);
                this.activeProcess = undefined;

                if (code === 0) {
                    this.reportProgress(onProgress, FlashState.Complete, 100, 'Flash complete');
                    this.logger.info('west flash completed successfully');
                    resolve();
                } else {
                    const errorMessage = this.classifyError(stderrBuffer, code);
                    this.reportProgress(onProgress, FlashState.Failed, lastPercentage, errorMessage);
                    this.logger.error(`west flash exited with code ${code}: ${errorMessage}`);
                    reject(new Error(errorMessage));
                }
            });

            proc.on('error', (err) => {
                clearTimeout(timeout);
                this.activeProcess = undefined;

                const errorMessage = this.classifySpawnError(err);
                this.reportProgress(onProgress, FlashState.Failed, 0, errorMessage);
                this.logger.error('Failed to spawn west process', err);
                reject(new Error(errorMessage));
            });
        });
    }

    /**
     * Scans the workspace for directories that contain a valid Zephyr build
     * output (`build/zephyr/zephyr.bin`). Looks under the known Porter target
     * subdirectories (`motor_controller/`, `sensor_fusion/`).
     *
     * @param workspaceRoot Absolute path to the workspace root.
     * @returns Array of absolute paths to directories that contain a build output.
     */
    async detectBuildDirs(workspaceRoot: string): Promise<string[]> {
        const results: string[] = [];

        for (const target of BUILD_TARGET_DIRS) {
            const binPath = path.join(workspaceRoot, target, ZEPHYR_BIN_RELATIVE);
            const buildDir = path.join(workspaceRoot, target, 'build');

            try {
                await fs.promises.access(binPath, fs.constants.R_OK);
                results.push(buildDir);
                this.logger.debug(`Found build directory: ${buildDir}`);
            } catch {
                // No build output for this target — skip
            }
        }

        // Also check if the workspace root itself has a build directory
        // (single-target workspace layout)
        const rootBinPath = path.join(workspaceRoot, ZEPHYR_BIN_RELATIVE);
        const rootBuildDir = path.join(workspaceRoot, 'build');

        try {
            await fs.promises.access(rootBinPath, fs.constants.R_OK);
            if (!results.includes(rootBuildDir)) {
                results.push(rootBuildDir);
                this.logger.debug(`Found build directory at workspace root: ${rootBuildDir}`);
            }
        } catch {
            // No build output at root — skip
        }

        // Check Settings.west.buildDir as well
        const configuredBuildDir = Settings.west.buildDir;
        if (configuredBuildDir) {
            const configuredBinPath = path.join(configuredBuildDir, 'zephyr', 'zephyr.bin');
            try {
                await fs.promises.access(configuredBinPath, fs.constants.R_OK);
                if (!results.includes(configuredBuildDir)) {
                    results.push(configuredBuildDir);
                    this.logger.debug(`Found configured build directory: ${configuredBuildDir}`);
                }
            } catch {
                this.logger.warn(
                    `Configured build directory does not contain zephyr.bin: ${configuredBuildDir}`,
                );
            }
        }

        return results;
    }

    /**
     * Cancels the currently running west flash subprocess, if any.
     */
    cancel(): void {
        if (this.activeProcess) {
            this.logger.info('Cancelling active west flash process');
            this.killProcess(this.activeProcess);
            this.activeProcess = undefined;
        }
    }

    /**
     * Locates the `west` binary. Checks the user-configured path first,
     * then falls back to auto-detection via platformUtils.
     *
     * @throws Error if west cannot be found.
     */
    async findWest(): Promise<string> {
        const customPath = Settings.west.path;
        const found = await findWest(customPath || undefined);

        if (!found) {
            throw new Error(
                'west not found. Install it with:\n' +
                '  pip install west\n\n' +
                'Or set the path manually in Settings → Porter Robot → West Path.\n' +
                'For full Zephyr setup, see: https://docs.zephyrproject.org/latest/develop/getting_started/',
            );
        }

        this.logger.debug(`Using west at: ${found}`);
        return found;
    }

    /**
     * Disposes of the service by killing any active subprocess.
     */
    dispose(): void {
        this.cancel();
    }

    /**
     * Validates that the build directory exists and contains the expected
     * Zephyr build artifacts.
     */
    private async validateBuildDir(buildDir: string): Promise<void> {
        try {
            await fs.promises.access(buildDir, fs.constants.R_OK);
        } catch {
            throw new Error(
                `Build directory not found: ${buildDir}\n\n` +
                'Run "west build" first to create the build output, or check that\n' +
                'the build directory path is correct in Settings → Porter Robot → West Build Dir.',
            );
        }

        const zephyrBin = path.join(buildDir, 'zephyr', 'zephyr.bin');
        try {
            await fs.promises.access(zephyrBin, fs.constants.R_OK);
        } catch {
            throw new Error(
                `No zephyr.bin found in build directory: ${buildDir}\n\n` +
                'The build may be incomplete. Run "west build" to generate the firmware binary.',
            );
        }
    }

    /**
     * Parses a chunk of west flash output for stage transitions and
     * percentage progress.
     */
    private parseOutput(
        text: string,
        currentState: FlashState,
        currentPercentage: number,
    ): { readonly state: FlashState; readonly percentage: number; readonly message: string; readonly updated: boolean } {
        let state = currentState;
        let percentage = currentPercentage;
        let message = '';
        let updated = false;

        for (const line of text.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }

            // Check for percentage progress
            const progressMatch = PROGRESS_REGEX.exec(trimmed);
            if (progressMatch) {
                percentage = parseInt(progressMatch[1], 10);
                state = FlashState.Writing;
                message = trimmed;
                updated = true;
                continue;
            }

            // Check for stage transitions
            for (const matcher of STATE_MATCHERS) {
                if (trimmed.includes(matcher.pattern)) {
                    state = matcher.state;
                    percentage = matcher.state === FlashState.Complete ? 100 : percentage;
                    message = trimmed;
                    updated = true;
                    break;
                }
            }
        }

        return { state, percentage, message, updated };
    }

    /**
     * Sends a FlashProgress update via the callback if one was provided.
     */
    private reportProgress(
        onProgress: ((progress: FlashProgress) => void) | undefined,
        state: FlashState,
        percentage: number,
        message: string,
    ): void {
        if (onProgress) {
            onProgress({ state, percentage, message });
        }
    }

    /**
     * Classifies west flash stderr output into a user-friendly error message
     * with actionable instructions.
     */
    private classifyError(stderr: string, exitCode: number | null): string {
        const lower = stderr.toLowerCase();

        if (lower.includes('no such runner') || lower.includes('runner not found')) {
            return (
                'Flash runner not found. For ESP32 targets, west uses esptool.\n' +
                'Install esptool with:\n' +
                '  pip install esptool\n\n' +
                'Then run "west flash" again.'
            );
        }

        if (lower.includes('build directory') && lower.includes('not found')) {
            return (
                'Build directory not found. Run "west build" first to compile the firmware,\n' +
                'or set the correct path in Settings → Porter Robot → West Build Dir.'
            );
        }

        if (lower.includes('failed to connect') || lower.includes('no serial data')) {
            return (
                'Failed to connect to ESP32. Check that:\n' +
                '  1. The device is connected via USB\n' +
                '  2. The correct port is selected\n' +
                '  3. No other application is using the port\n' +
                '  4. The device is in bootloader mode (hold BOOT, press RESET)'
            );
        }

        if (lower.includes('permission denied') || lower.includes('access is denied') || lower.includes('eacces')) {
            return (
                'Permission denied accessing the serial port.\n' +
                'On Linux, add your user to the dialout group:\n' +
                '  sudo usermod -a -G dialout $USER\n' +
                'Then log out and back in.'
            );
        }

        if (lower.includes('cmake') && lower.includes('not found')) {
            return (
                'CMake is required but not found. Install it and ensure it is on PATH.\n' +
                'See: https://docs.zephyrproject.org/latest/develop/getting_started/'
            );
        }

        if (lower.includes('west: unknown command') || lower.includes('invalid choice')) {
            return (
                'west does not recognize the "flash" command. Ensure you have a\n' +
                'properly initialized Zephyr workspace with west installed:\n' +
                '  pip install west'
            );
        }

        // Generic fallback
        const truncated = stderr.trim().slice(0, 500);
        return `west flash failed (exit code ${exitCode ?? 'unknown'}): ${truncated || 'Unknown error'}`;
    }

    /**
     * Classifies a spawn error (e.g., ENOENT) into a user-friendly message.
     */
    private classifySpawnError(err: NodeJS.ErrnoException): string {
        if (err.code === 'ENOENT') {
            return (
                'west not found. Install it with:\n' +
                '  pip install west\n\n' +
                'Or set the path manually in Settings → Porter Robot → West Path.'
            );
        }

        if (err.code === 'EACCES') {
            return (
                'Permission denied when running west.\n' +
                'Check that the west binary has execute permissions.'
            );
        }

        return `Failed to start west: ${err.message}`;
    }

    /**
     * Kills a child process and all its children (best-effort).
     */
    private killProcess(proc: ChildProcess): void {
        try {
            if (proc.pid !== undefined && !proc.killed) {
                proc.kill('SIGTERM');

                // Force kill after a brief grace period
                setTimeout(() => {
                    try {
                        if (!proc.killed) {
                            proc.kill('SIGKILL');
                        }
                    } catch {
                        // Process already exited — ignore
                    }
                }, 2000);
            }
        } catch {
            // Process already exited — ignore
        }
    }
}
