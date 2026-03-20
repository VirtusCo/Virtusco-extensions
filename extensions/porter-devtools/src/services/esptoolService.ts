import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';

import { Logger } from '../utils/logger';
import { FlashConfig, FlashProgress } from '../models/types';
import { FlashState } from '../models/enums';
import { Settings } from '../config/settings';
import { findEsptool, serialPortPermissionError } from '../utils/platformUtils';
import { ESPTOOL_TIMEOUT_MS } from '../constants';

/**
 * Regex that matches esptool progress lines such as:
 *   "Writing at 0x00001000... (3 %)"
 *   "Writing at 0x00010000... (100 %)"
 */
const PROGRESS_REGEX = /Writing at 0x[0-9a-fA-F]+\.\.\.\s*\((\d+)\s*%\)/;

/**
 * Maps recognized esptool output fragments to FlashState values.
 * Order matters — first match wins for each line.
 */
const STATE_MATCHERS: ReadonlyArray<{ readonly pattern: string; readonly state: FlashState }> = [
    { pattern: 'Connecting',          state: FlashState.Connecting },
    { pattern: 'Chip is',             state: FlashState.Connecting },
    { pattern: 'Erasing flash',       state: FlashState.Erasing },
    { pattern: 'Compressed',          state: FlashState.Erasing },
    { pattern: 'Writing at',          state: FlashState.Writing },
    { pattern: 'Wrote',              state: FlashState.Verifying },
    { pattern: 'Hash of data verified', state: FlashState.Verifying },
    { pattern: 'Leaving',             state: FlashState.Complete },
    { pattern: 'Hard resetting',      state: FlashState.Complete },
];

export class EsptoolService implements vscode.Disposable {
    private readonly logger: Logger;
    private activeProcess: ChildProcess | undefined;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Flashes a pre-built .bin firmware file to an ESP32 using esptool.py.
     *
     * Spawns esptool.py as a subprocess, parses its stdout/stderr for progress
     * information, and reports state changes via the optional callback.
     */
    async flash(
        config: FlashConfig,
        onProgress?: (progress: FlashProgress) => void,
    ): Promise<void> {
        const esptoolPath = await this.findEsptool();

        const args = [
            '--chip', config.chip,
            '--port', config.port,
            '--baud', String(config.baudRate),
            'write_flash',
            config.flashAddress,
            config.firmwarePath,
        ];

        this.logger.info(
            `Flashing firmware: ${esptoolPath} ${args.join(' ')}`,
        );

        this.reportProgress(onProgress, FlashState.Connecting, 0, 'Starting esptool...');

        return new Promise<void>((resolve, reject) => {
            const proc = spawn(esptoolPath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            this.activeProcess = proc;

            let lastState: FlashState = FlashState.Connecting;
            let lastPercentage = 0;
            let stderrBuffer = '';

            const timeout = setTimeout(() => {
                this.logger.error(`esptool timed out after ${ESPTOOL_TIMEOUT_MS}ms`);
                this.killProcess(proc);
                reject(new Error(
                    `Flashing timed out after ${ESPTOOL_TIMEOUT_MS / 1000} seconds. ` +
                    'The device may be unresponsive — try resetting it and flashing again.',
                ));
            }, ESPTOOL_TIMEOUT_MS);

            proc.stdout?.on('data', (data: Buffer) => {
                const text = data.toString();
                this.logger.debug(`[esptool stdout] ${text.trimEnd()}`);

                for (const line of text.split(/\r?\n/)) {
                    if (!line.trim()) {
                        continue;
                    }

                    // Check for percentage progress
                    const progressMatch = PROGRESS_REGEX.exec(line);
                    if (progressMatch) {
                        lastPercentage = parseInt(progressMatch[1], 10);
                        lastState = FlashState.Writing;
                        this.reportProgress(onProgress, lastState, lastPercentage, line.trim());
                        continue;
                    }

                    // Check for stage transitions
                    for (const matcher of STATE_MATCHERS) {
                        if (line.includes(matcher.pattern)) {
                            lastState = matcher.state;
                            const pct = matcher.state === FlashState.Complete ? 100 : lastPercentage;
                            this.reportProgress(onProgress, lastState, pct, line.trim());
                            break;
                        }
                    }
                }
            });

            proc.stderr?.on('data', (data: Buffer) => {
                const text = data.toString();
                stderrBuffer += text;
                this.logger.debug(`[esptool stderr] ${text.trimEnd()}`);

                // esptool also prints progress to stderr in some versions
                for (const line of text.split(/\r?\n/)) {
                    if (!line.trim()) {
                        continue;
                    }

                    const progressMatch = PROGRESS_REGEX.exec(line);
                    if (progressMatch) {
                        lastPercentage = parseInt(progressMatch[1], 10);
                        lastState = FlashState.Writing;
                        this.reportProgress(onProgress, lastState, lastPercentage, line.trim());
                        continue;
                    }

                    for (const matcher of STATE_MATCHERS) {
                        if (line.includes(matcher.pattern)) {
                            lastState = matcher.state;
                            const pct = matcher.state === FlashState.Complete ? 100 : lastPercentage;
                            this.reportProgress(onProgress, lastState, pct, line.trim());
                            break;
                        }
                    }
                }
            });

            proc.on('close', (code) => {
                clearTimeout(timeout);
                this.activeProcess = undefined;

                if (code === 0) {
                    this.reportProgress(onProgress, FlashState.Complete, 100, 'Flash complete');
                    this.logger.info('Flash completed successfully');
                    resolve();
                } else {
                    const errorMessage = this.classifyError(stderrBuffer, code);
                    this.reportProgress(onProgress, FlashState.Failed, lastPercentage, errorMessage);
                    this.logger.error(`esptool exited with code ${code}: ${errorMessage}`);
                    reject(new Error(errorMessage));
                }
            });

            proc.on('error', (err) => {
                clearTimeout(timeout);
                this.activeProcess = undefined;

                const errorMessage = this.classifySpawnError(err);
                this.reportProgress(onProgress, FlashState.Failed, 0, errorMessage);
                this.logger.error('Failed to spawn esptool process', err);
                reject(new Error(errorMessage));
            });
        });
    }

    /**
     * Reads the chip ID and basic info from an ESP32 connected on the given port.
     */
    async readChipInfo(port: string): Promise<string> {
        const esptoolPath = await this.findEsptool();
        const args = ['--port', port, 'chip_id'];

        this.logger.info(`Reading chip info: ${esptoolPath} ${args.join(' ')}`);

        return new Promise<string>((resolve, reject) => {
            const proc = spawn(esptoolPath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            this.activeProcess = proc;

            let stdout = '';
            let stderr = '';

            const timeout = setTimeout(() => {
                this.killProcess(proc);
                reject(new Error('Reading chip info timed out. Check device connection.'));
            }, ESPTOOL_TIMEOUT_MS);

            proc.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            proc.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                clearTimeout(timeout);
                this.activeProcess = undefined;

                if (code === 0) {
                    // esptool prints useful output to both stdout and stderr
                    const combined = (stdout + '\n' + stderr).trim();
                    this.logger.info('Chip info retrieved successfully');
                    resolve(combined);
                } else {
                    const errorMessage = this.classifyError(stderr, code);
                    this.logger.error(`chip_id failed: ${errorMessage}`);
                    reject(new Error(errorMessage));
                }
            });

            proc.on('error', (err) => {
                clearTimeout(timeout);
                this.activeProcess = undefined;

                const errorMessage = this.classifySpawnError(err);
                this.logger.error('Failed to spawn esptool for chip_id', err);
                reject(new Error(errorMessage));
            });
        });
    }

    /**
     * Verifies that the flash contents match the firmware file using esptool's
     * verify_flash command.
     *
     * @returns `true` if the flash contents match, `false` otherwise.
     */
    async verifyFlash(
        port: string,
        firmwarePath: string,
        address: string,
    ): Promise<boolean> {
        const esptoolPath = await this.findEsptool();
        const args = ['--port', port, 'verify_flash', address, firmwarePath];

        this.logger.info(`Verifying flash: ${esptoolPath} ${args.join(' ')}`);

        return new Promise<boolean>((resolve, reject) => {
            const proc = spawn(esptoolPath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            this.activeProcess = proc;

            let stdout = '';
            let stderr = '';

            const timeout = setTimeout(() => {
                this.killProcess(proc);
                reject(new Error('Flash verification timed out.'));
            }, ESPTOOL_TIMEOUT_MS);

            proc.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            proc.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                clearTimeout(timeout);
                this.activeProcess = undefined;

                const combined = stdout + stderr;

                if (code === 0 && combined.includes('verify OK')) {
                    this.logger.info('Flash verification passed');
                    resolve(true);
                } else if (code === 0) {
                    // esptool returned 0 but no explicit "verify OK" — treat as passed
                    this.logger.info('Flash verification completed (exit code 0)');
                    resolve(true);
                } else {
                    this.logger.warn(
                        `Flash verification failed (exit code ${code}): ${combined.trimEnd()}`,
                    );
                    resolve(false);
                }
            });

            proc.on('error', (err) => {
                clearTimeout(timeout);
                this.activeProcess = undefined;

                const errorMessage = this.classifySpawnError(err);
                this.logger.error('Failed to spawn esptool for verify_flash', err);
                reject(new Error(errorMessage));
            });
        });
    }

    /**
     * Cancels the currently running esptool subprocess, if any.
     */
    cancel(): void {
        if (this.activeProcess) {
            this.logger.info('Cancelling active esptool process');
            this.killProcess(this.activeProcess);
            this.activeProcess = undefined;
        }
    }

    /**
     * Locates the esptool.py binary. Checks the user-configured path first,
     * then falls back to auto-detection via platformUtils.
     *
     * @throws Error if esptool.py cannot be found.
     */
    async findEsptool(): Promise<string> {
        const customPath = Settings.esptool.path;
        const found = await findEsptool(customPath || undefined);

        if (!found) {
            throw new Error(
                'esptool.py not found. Install it with:\n' +
                '  pip install esptool\n\n' +
                'Or set the path manually in Settings → Porter Robot → Esptool Path.',
            );
        }

        this.logger.debug(`Using esptool at: ${found}`);
        return found;
    }

    /**
     * Disposes of the service by killing any active subprocess.
     */
    dispose(): void {
        this.cancel();
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
     * Classifies esptool stderr output into a user-friendly error message
     * with actionable instructions.
     */
    private classifyError(stderr: string, exitCode: number | null): string {
        const lower = stderr.toLowerCase();

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
            return serialPortPermissionError();
        }

        if (lower.includes('could not open port') || lower.includes('no such file or directory')) {
            return (
                'Serial port not found. The device may have been disconnected.\n' +
                'Check the USB connection and try scanning for devices again.'
            );
        }

        if (lower.includes('a]fatal error occurred')) {
            return (
                'A fatal error occurred during flashing. Try:\n' +
                '  1. Resetting the ESP32 (press RESET button)\n' +
                '  2. Holding BOOT while pressing RESET to enter bootloader mode\n' +
                '  3. Using a lower baud rate (Settings → Porter Robot → Flash Baud Rate)'
            );
        }

        if (lower.includes('invalid head of packet')) {
            return (
                'Communication error with ESP32. The device may not be in bootloader mode.\n' +
                'Hold the BOOT button, press RESET, then release BOOT.'
            );
        }

        // Generic fallback
        const truncated = stderr.trim().slice(0, 500);
        return `esptool failed (exit code ${exitCode ?? 'unknown'}): ${truncated || 'Unknown error'}`;
    }

    /**
     * Classifies a spawn error (e.g., ENOENT) into a user-friendly message.
     */
    private classifySpawnError(err: NodeJS.ErrnoException): string {
        if (err.code === 'ENOENT') {
            return (
                'esptool.py not found. Install it with:\n' +
                '  pip install esptool\n\n' +
                'Or set the path manually in Settings → Porter Robot → Esptool Path.'
            );
        }

        if (err.code === 'EACCES') {
            return (
                'Permission denied when running esptool.py.\n' +
                'Check that the esptool binary has execute permissions.'
            );
        }

        return `Failed to start esptool: ${err.message}`;
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
