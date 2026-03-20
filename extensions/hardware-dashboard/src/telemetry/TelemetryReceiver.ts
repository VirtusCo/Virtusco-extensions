// Copyright 2026 VirtusCo

import { EventEmitter } from 'events';
import type { TelemetryPacket } from '../types';
import { PlatformUtils } from '../platform/PlatformUtils';

/**
 * Receives telemetry data over serial port.
 * Emits 'packet' events with parsed TelemetryPacket objects.
 * Emits 'connected' and 'disconnected' events for connection state.
 * Emits 'error' events for serial errors.
 */
export class TelemetryReceiver extends EventEmitter {
  private port: InstanceType<typeof import('serialport').SerialPort> | null = null;
  private parser: InstanceType<typeof import('@serialport/parser-readline').ReadlineParser> | null = null;
  private _connected = false;
  private _currentPort = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  get connected(): boolean {
    return this._connected;
  }

  get currentPort(): string {
    return this._currentPort;
  }

  async connect(portPath: string, baudRate: number): Promise<void> {
    // Disconnect existing connection first
    if (this._connected) {
      await this.disconnect();
    }

    try {
      const { SerialPort } = await import('serialport');
      const { ReadlineParser } = await import('@serialport/parser-readline');

      this.port = new SerialPort({
        path: portPath,
        baudRate,
        autoOpen: false,
      });

      this.parser = new ReadlineParser({ delimiter: '\n' });
      this.port.pipe(this.parser);

      this.parser.on('data', (line: string) => {
        this.handleLine(line.trim());
      });

      this.port.on('error', (err: Error) => {
        this.emit('error', err);
      });

      this.port.on('close', () => {
        this._connected = false;
        this._currentPort = '';
        this.emit('disconnected');
      });

      await new Promise<void>((resolve, reject) => {
        this.port!.open((err) => {
          if (err) {
            reject(err);
          } else {
            this._connected = true;
            this._currentPort = portPath;
            this.emit('connected', portPath);
            resolve();
          }
        });
      });
    } catch (err) {
      this._connected = false;
      this._currentPort = '';
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.port && this.port.isOpen) {
      await new Promise<void>((resolve) => {
        this.port!.close((err) => {
          if (err) {
            console.error('Error closing port:', err.message);
          }
          resolve();
        });
      });
    }

    this.port = null;
    this.parser = null;
    this._connected = false;
    this._currentPort = '';
    this.emit('disconnected');
  }

  /**
   * Auto-detect telemetry port by scanning available serial ports
   * and checking for known VID/PID combinations.
   */
  async autoDetect(): Promise<string | null> {
    try {
      const { SerialPort } = await import('serialport');
      const ports = await SerialPort.list();

      // Known VID/PID for ESP32 CP2102/CH340
      const knownVids = ['10c4', '1a86', '0403'];

      for (const p of ports) {
        const vid = (p.vendorId || '').toLowerCase();
        if (knownVids.includes(vid)) {
          return p.path;
        }
      }

      // Fallback: return first port matching platform pattern
      const defaultPort = PlatformUtils.defaultTelemetryPort();
      for (const p of ports) {
        if (p.path.includes('USB') || p.path.includes('COM')) {
          return p.path;
        }
      }

      return ports.length > 0 ? ports[0].path : defaultPort;
    } catch {
      return PlatformUtils.defaultTelemetryPort();
    }
  }

  /** List all available serial ports */
  async listPorts(): Promise<string[]> {
    try {
      const { SerialPort } = await import('serialport');
      const ports = await SerialPort.list();
      return ports.map((p) => p.path);
    } catch {
      return [];
    }
  }

  private handleLine(line: string): void {
    if (!line || !line.startsWith('{')) {
      return;
    }

    try {
      const data = JSON.parse(line);
      const packet = this.validatePacket(data);
      if (packet) {
        this.emit('packet', packet);
      }
    } catch {
      // Ignore malformed JSON lines
    }
  }

  private validatePacket(data: Record<string, unknown>): TelemetryPacket | null {
    if (!data.power || !data.motors || !data.sensors) {
      return null;
    }

    const packet: TelemetryPacket = {
      power: {
        v12: Number((data.power as Record<string, unknown>).v12) || 0,
        v5: Number((data.power as Record<string, unknown>).v5) || 0,
        v33: Number((data.power as Record<string, unknown>).v33) || 0,
        i12_ma: Number((data.power as Record<string, unknown>).i12_ma) || 0,
        i5_ma: Number((data.power as Record<string, unknown>).i5_ma) || 0,
        relay_states: Array.isArray((data.power as Record<string, unknown>).relay_states)
          ? ((data.power as Record<string, unknown>).relay_states as boolean[])
          : [],
      },
      motors: {
        left: {
          rpwm: Number(((data.motors as Record<string, unknown>).left as Record<string, unknown>)?.rpwm) || 0,
          lpwm: Number(((data.motors as Record<string, unknown>).left as Record<string, unknown>)?.lpwm) || 0,
          en: Boolean(((data.motors as Record<string, unknown>).left as Record<string, unknown>)?.en),
          i_ma: Number(((data.motors as Record<string, unknown>).left as Record<string, unknown>)?.i_ma) || 0,
        },
        right: {
          rpwm: Number(((data.motors as Record<string, unknown>).right as Record<string, unknown>)?.rpwm) || 0,
          lpwm: Number(((data.motors as Record<string, unknown>).right as Record<string, unknown>)?.lpwm) || 0,
          en: Boolean(((data.motors as Record<string, unknown>).right as Record<string, unknown>)?.en),
          i_ma: Number(((data.motors as Record<string, unknown>).right as Record<string, unknown>)?.i_ma) || 0,
        },
      },
      sensors: {
        tof_mm: Number((data.sensors as Record<string, unknown>).tof_mm) || 0,
        sonic_cm: Number((data.sensors as Record<string, unknown>).sonic_cm) || 0,
        microwave: Number((data.sensors as Record<string, unknown>).microwave) || 0,
        kalman_cm: Number((data.sensors as Record<string, unknown>).kalman_cm) || 0,
      },
      esp32_health: {
        esp1_uptime_ms: Number((data.esp32_health as Record<string, unknown>)?.esp1_uptime_ms) || 0,
        esp2_uptime_ms: Number((data.esp32_health as Record<string, unknown>)?.esp2_uptime_ms) || 0,
        esp1_errors: Number((data.esp32_health as Record<string, unknown>)?.esp1_errors) || 0,
        esp2_errors: Number((data.esp32_health as Record<string, unknown>)?.esp2_errors) || 0,
      },
      timestamp: Number(data.timestamp) || Date.now(),
    };

    return packet;
  }

  dispose(): void {
    this.disconnect().catch(() => {});
    this.removeAllListeners();
  }
}
