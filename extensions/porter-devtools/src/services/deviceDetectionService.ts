import * as vscode from 'vscode';

import { SerialService } from './serialService';
import { Logger } from '../utils/logger';
import { SerialDevice, DeviceChangeEvent } from '../models/types';
import { DeviceType, ConnectionStatus } from '../models/enums';
import {
    KNOWN_VENDOR_IDS,
    PROTOCOL_HEADER,
    CMD_MOTOR_STATUS,
    CMD_SENSOR_STATUS,
    CRC16_POLY,
    CRC16_INIT,
} from '../constants';

/** Timeout (ms) for waiting on a protocol response during device identification. */
const IDENTIFY_RESPONSE_TIMEOUT_MS = 500;

/** Baud rate used for the Porter binary identification protocol. */
const IDENTIFY_BAUD_RATE = 115200;

/**
 * Polls serial ports at a configurable interval, detects connected ESP32
 * devices, and classifies them by USB VID/PID and — when possible — by
 * sending Porter binary protocol probe packets.
 */
export class DeviceDetectionService implements vscode.Disposable {
    private readonly _onDevicesChanged = new vscode.EventEmitter<DeviceChangeEvent>();

    /** Fires whenever the set of detected devices changes. */
    readonly onDevicesChanged: vscode.Event<DeviceChangeEvent> = this._onDevicesChanged.event;

    private pollingTimer: NodeJS.Timeout | undefined;
    private devices: readonly SerialDevice[] = [];

    constructor(
        private readonly serialService: SerialService,
        private readonly logger: Logger,
    ) {}

    // ── Public API ─────────────────────────────────────────────────────

    /**
     * Starts periodic scanning for serial devices.
     *
     * If polling is already active it is restarted with the new interval.
     */
    startPolling(intervalMs: number): void {
        this.stopPolling();

        this.logger.info(`Starting device polling every ${intervalMs} ms`);

        // Run an initial scan immediately, then schedule the interval.
        void this.poll();
        this.pollingTimer = setInterval(() => {
            void this.poll();
        }, intervalMs);
    }

    /**
     * Stops the periodic scan timer. Does nothing if polling is not active.
     */
    stopPolling(): void {
        if (this.pollingTimer !== undefined) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = undefined;
            this.logger.info('Stopped device polling');
        }
    }

    /**
     * Performs a one-shot scan of all serial ports and classifies each one as
     * a known ESP32 device type (or Unknown).
     *
     * Updates the internal cache and fires `onDevicesChanged` if the device
     * list has changed.
     */
    async scanDevices(): Promise<SerialDevice[]> {
        try {
            const portInfos = await this.serialService.listPorts();

            const scanned: SerialDevice[] = portInfos.map((info) => ({
                port: info.path,
                vendorId: info.vendorId,
                productId: info.productId,
                serialNumber: info.serialNumber,
                manufacturer: info.manufacturer,
                deviceType: this.classifyByVidPid(info.vendorId, info.productId),
                status: ConnectionStatus.Disconnected,
            }));

            this.logger.debug(`Scan found ${scanned.length} port(s)`);
            return scanned;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Device scan failed', message);
            return [];
        }
    }

    /**
     * Returns the most recently cached device list (from the last scan or
     * poll cycle).
     */
    getDevices(): readonly SerialDevice[] {
        return this.devices;
    }

    /**
     * Attempts to identify what firmware is running on the device at
     * `portPath` by sending Porter binary protocol probe packets.
     *
     * Sends `CMD_MOTOR_STATUS` and `CMD_SENSOR_STATUS` in sequence, each
     * followed by a 500 ms wait for a response. The first command that gets
     * a response determines the device type.
     *
     * The port is opened, probed, and closed within this call. If the port
     * is already open this method will throw.
     */
    async identifyDevice(portPath: string): Promise<DeviceType> {
        this.logger.info(`Identifying device on ${portPath}`);

        // Probe motor controller first.
        const motorResponded = await this.probeCommand(portPath, CMD_MOTOR_STATUS);
        if (motorResponded) {
            this.logger.info(`${portPath} identified as MotorController`);
            return DeviceType.MotorController;
        }

        // Probe sensor fusion.
        const sensorResponded = await this.probeCommand(portPath, CMD_SENSOR_STATUS);
        if (sensorResponded) {
            this.logger.info(`${portPath} identified as SensorFusion`);
            return DeviceType.SensorFusion;
        }

        this.logger.info(`${portPath} could not be identified — returning Unknown`);
        return DeviceType.Unknown;
    }

    /**
     * Disposes the service: stops polling and cleans up the event emitter.
     */
    dispose(): void {
        this.stopPolling();
        this._onDevicesChanged.dispose();
    }

    // ── Private helpers ────────────────────────────────────────────────

    /**
     * Internal polling callback. Scans devices, diffs against the cached
     * list, and fires `onDevicesChanged` when appropriate.
     */
    private async poll(): Promise<void> {
        const scanned = await this.scanDevices();
        const { added, removed } = this.diffDevices(this.devices, scanned);

        if (added.length > 0 || removed.length > 0) {
            this.devices = Object.freeze([...scanned]);

            if (added.length > 0) {
                this.logger.info(
                    `Device(s) added: ${added.map((d) => d.port).join(', ')}`,
                );
            }
            if (removed.length > 0) {
                this.logger.info(
                    `Device(s) removed: ${removed.map((d) => d.port).join(', ')}`,
                );
            }

            this._onDevicesChanged.fire({ added, removed });
        }
    }

    /**
     * Computes added/removed devices between two snapshots, keyed by port
     * path.
     */
    private diffDevices(
        previous: readonly SerialDevice[],
        current: readonly SerialDevice[],
    ): { added: SerialDevice[]; removed: SerialDevice[] } {
        const prevPorts = new Set(previous.map((d) => d.port));
        const currPorts = new Set(current.map((d) => d.port));

        const added = current.filter((d) => !prevPorts.has(d.port));
        const removed = previous.filter((d) => !currPorts.has(d.port));

        return { added, removed };
    }

    /**
     * Classifies a device by its USB Vendor ID.
     *
     * Returns `DeviceType.Unknown` in all cases because VID/PID alone cannot
     * distinguish a motor controller from a sensor fusion board — both use
     * the same ESP32-DevKitC with the same USB-UART bridge chip.
     */
    private classifyByVidPid(vendorId?: string, productId?: string): DeviceType {
        if (!vendorId) {
            return DeviceType.Unknown;
        }

        const normalised = vendorId.toLowerCase();
        if ((KNOWN_VENDOR_IDS as Set<string>).has(normalised)) {
            // Known ESP32 USB-UART bridge, but we cannot tell motor from
            // sensor via VID/PID alone. Active probing is required.
            this.logger.debug(
                `Known VID ${normalised}${productId ? ':' + productId : ''} — requires active identification`,
            );
            return DeviceType.Unknown;
        }

        return DeviceType.Unknown;
    }

    /**
     * Sends a single Porter binary protocol command to the port and returns
     * `true` if any data is received within the response timeout.
     *
     * Packet format: `[0xAA, 0x55, length, command, CRC16_hi, CRC16_lo]`
     *
     * The port is opened before the probe and closed afterwards, regardless
     * of success or failure.
     */
    private async probeCommand(portPath: string, command: number): Promise<boolean> {
        const packet = this.buildPacket(command);

        try {
            await this.serialService.openPort(portPath, IDENTIFY_BAUD_RATE);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Cannot open ${portPath} for probing`, message);
            return false;
        }

        try {
            let received = false;

            const dataDisposable = this.serialService.onData(portPath, () => {
                received = true;
            });

            await this.serialService.write(portPath, packet);

            // Wait for a response or timeout.
            await this.delay(IDENTIFY_RESPONSE_TIMEOUT_MS);

            dataDisposable.dispose();

            return received;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
                `Probe command 0x${command.toString(16)} failed on ${portPath}`,
                message,
            );
            return false;
        } finally {
            try {
                await this.serialService.closePort(portPath);
            } catch (closeErr: unknown) {
                this.logger.warn(
                    `Failed to close ${portPath} after probe`,
                    String(closeErr),
                );
            }
        }
    }

    /**
     * Builds a Porter binary protocol packet for the given command byte.
     *
     * Wire format:
     * ```
     * [HEADER_HI, HEADER_LO, LENGTH, COMMAND, CRC_HI, CRC_LO]
     * ```
     *
     * Length covers the command byte only (1). CRC16-CCITT is computed over
     * `[LENGTH, COMMAND]`.
     */
    private buildPacket(command: number): Buffer {
        const length = 1; // payload is the command byte only
        const crcPayload = Buffer.from([length, command]);
        const crc = this.computeCrc16(crcPayload);

        return Buffer.from([
            PROTOCOL_HEADER[0],
            PROTOCOL_HEADER[1],
            length,
            command,
            (crc >> 8) & 0xff,
            crc & 0xff,
        ]);
    }

    /**
     * CRC16-CCITT (poly 0x1021, init 0xFFFF).
     */
    private computeCrc16(data: Buffer): number {
        let crc = CRC16_INIT;
        for (const byte of data) {
            crc ^= byte << 8;
            for (let i = 0; i < 8; i++) {
                crc = (crc & 0x8000) ? ((crc << 1) ^ CRC16_POLY) : (crc << 1);
                crc &= 0xffff;
            }
        }
        return crc;
    }

    /**
     * Returns a promise that resolves after `ms` milliseconds.
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}
