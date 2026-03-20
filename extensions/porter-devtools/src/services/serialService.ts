import * as vscode from 'vscode';
import { SerialPort } from 'serialport';
import type { PortInfo } from '@serialport/bindings-interface';

import { Logger } from '../utils/logger';
import { serialPortPermissionError } from '../utils/platformUtils';

/**
 * Manages serial port connections for device communication and monitoring.
 *
 * Wraps the `serialport` npm package, maintaining a map of open connections
 * keyed by port path (e.g. "COM3" or "/dev/ttyUSB0"). Every opened port is
 * tracked so it can be deterministically closed on dispose.
 */
export class SerialService implements vscode.Disposable {
    private readonly ports: Map<string, SerialPort> = new Map();

    constructor(private readonly logger: Logger) {}

    /**
     * Lists all serial ports visible to the operating system.
     */
    async listPorts(): Promise<PortInfo[]> {
        try {
            const ports = await SerialPort.list();
            this.logger.debug(`Listed ${ports.length} serial port(s)`);
            return ports;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Failed to list serial ports', message);
            throw new Error(`Failed to list serial ports: ${message}`);
        }
    }

    /**
     * Opens a serial port at the given path and baud rate.
     *
     * The port is stored in the internal map so it can be retrieved for
     * subsequent read/write operations and closed during cleanup.
     *
     * @throws If the port is already open, not found, busy, or permission is denied.
     */
    async openPort(portPath: string, baudRate: number): Promise<void> {
        if (this.ports.has(portPath)) {
            throw new Error(`Port ${portPath} is already open`);
        }

        this.logger.info(`Opening serial port ${portPath} at ${baudRate} baud`);

        return new Promise<void>((resolve, reject) => {
            const port = new SerialPort({ path: portPath, baudRate, autoOpen: false });

            port.open((err) => {
                if (err) {
                    const errorMessage = err.message;
                    this.logger.error(`Failed to open port ${portPath}`, errorMessage);

                    if (this.isPermissionError(errorMessage)) {
                        reject(new Error(serialPortPermissionError()));
                        return;
                    }
                    if (this.isPortBusyError(errorMessage)) {
                        reject(new Error(
                            `Port ${portPath} is busy. Close any other application using this port and try again.`,
                        ));
                        return;
                    }
                    if (this.isPortNotFoundError(errorMessage)) {
                        reject(new Error(
                            `Port ${portPath} not found. Check that the device is connected.`,
                        ));
                        return;
                    }

                    reject(new Error(`Failed to open port ${portPath}: ${errorMessage}`));
                    return;
                }

                this.ports.set(portPath, port);
                this.logger.info(`Opened serial port ${portPath}`);
                resolve();
            });
        });
    }

    /**
     * Closes a single open port and removes it from the internal map.
     *
     * Silently succeeds if the port is not currently open.
     */
    async closePort(portPath: string): Promise<void> {
        const port = this.ports.get(portPath);
        if (!port) {
            this.logger.debug(`Port ${portPath} is not open, nothing to close`);
            return;
        }

        this.logger.info(`Closing serial port ${portPath}`);

        return new Promise<void>((resolve, reject) => {
            port.close((err) => {
                this.ports.delete(portPath);

                if (err) {
                    const message = err.message;
                    this.logger.warn(`Error closing port ${portPath}`, message);
                    reject(new Error(`Failed to close port ${portPath}: ${message}`));
                    return;
                }

                this.logger.info(`Closed serial port ${portPath}`);
                resolve();
            });
        });
    }

    /**
     * Closes every open port. Errors on individual ports are logged but do not
     * prevent the remaining ports from being closed.
     */
    async closeAllPorts(): Promise<void> {
        const portPaths = [...this.ports.keys()];
        if (portPaths.length === 0) {
            return;
        }

        this.logger.info(`Closing all serial ports (${portPaths.length})`);

        const results = await Promise.allSettled(
            portPaths.map((p) => this.closePort(p)),
        );

        for (const result of results) {
            if (result.status === 'rejected') {
                this.logger.warn('Error during bulk port close', String(result.reason));
            }
        }
    }

    /**
     * Writes data to an open serial port.
     *
     * The returned promise resolves once the data has been flushed to the
     * underlying OS buffer (drain).
     *
     * @throws If the port is not open or the write/drain fails.
     */
    async write(portPath: string, data: Buffer | string): Promise<void> {
        const port = this.getOpenPort(portPath);

        return new Promise<void>((resolve, reject) => {
            port.write(data, (writeErr) => {
                if (writeErr) {
                    const message = writeErr.message;
                    this.logger.error(`Write error on ${portPath}`, message);
                    reject(new Error(`Write failed on ${portPath}: ${message}`));
                    return;
                }

                port.drain((drainErr) => {
                    if (drainErr) {
                        const message = drainErr.message;
                        this.logger.error(`Drain error on ${portPath}`, message);
                        reject(new Error(`Drain failed on ${portPath}: ${message}`));
                        return;
                    }

                    resolve();
                });
            });
        });
    }

    /**
     * Attaches a data listener to an open port.
     *
     * @returns A `vscode.Disposable` that removes the listener when disposed.
     * @throws If the port is not open.
     */
    onData(portPath: string, callback: (data: Buffer) => void): vscode.Disposable {
        const port = this.getOpenPort(portPath);

        const listener = (chunk: Buffer): void => {
            callback(chunk);
        };

        port.on('data', listener);

        return new vscode.Disposable(() => {
            port.removeListener('data', listener);
        });
    }

    /**
     * Returns whether a port is currently open and tracked.
     */
    isOpen(portPath: string): boolean {
        const port = this.ports.get(portPath);
        return port !== undefined && port.isOpen;
    }

    /**
     * Disposes the service by closing all open ports.
     */
    dispose(): void {
        this.closeAllPorts().catch((err: unknown) => {
            this.logger.error('Error disposing SerialService', String(err));
        });
    }

    // ── Private helpers ────────────────────────────────────────────────

    /**
     * Retrieves an open port or throws an actionable error.
     */
    private getOpenPort(portPath: string): SerialPort {
        const port = this.ports.get(portPath);
        if (!port) {
            throw new Error(
                `Port ${portPath} is not open. Call openPort() before reading or writing.`,
            );
        }
        return port;
    }

    private isPermissionError(message: string): boolean {
        const lower = message.toLowerCase();
        return lower.includes('permission denied')
            || lower.includes('access denied')
            || lower.includes('eacces');
    }

    private isPortBusyError(message: string): boolean {
        const lower = message.toLowerCase();
        return lower.includes('resource busy')
            || lower.includes('ebusy')
            || lower.includes('access denied')
            || lower.includes('port is locked');
    }

    private isPortNotFoundError(message: string): boolean {
        const lower = message.toLowerCase();
        return lower.includes('no such file')
            || lower.includes('enoent')
            || lower.includes('file not found')
            || lower.includes('the system cannot find');
    }
}
