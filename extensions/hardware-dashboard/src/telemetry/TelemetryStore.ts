// Copyright 2026 VirtusCo

import type { TelemetryPacket } from '../types';

/** Ring buffer field keys that can be stored/queried */
export type TelemetryField =
  | 'v12' | 'v5' | 'v33' | 'i12_ma' | 'i5_ma'
  | 'left_i' | 'left_rpwm' | 'left_lpwm'
  | 'right_i' | 'right_rpwm' | 'right_lpwm'
  | 'tof_mm' | 'sonic_cm' | 'kalman_cm';

const BUFFER_SIZE = 600; // 600 samples = 60s at 10Hz

/**
 * Ring buffer for telemetry history.
 * Stores the last 600 samples (60 seconds at 10Hz) for each field.
 */
export class TelemetryStore {
  private buffers: Map<TelemetryField, number[]> = new Map();
  private writeIndex = 0;
  private count = 0;
  private latestPacket: TelemetryPacket | null = null;

  private static readonly FIELDS: TelemetryField[] = [
    'v12', 'v5', 'v33', 'i12_ma', 'i5_ma',
    'left_i', 'left_rpwm', 'left_lpwm',
    'right_i', 'right_rpwm', 'right_lpwm',
    'tof_mm', 'sonic_cm', 'kalman_cm',
  ];

  constructor() {
    for (const field of TelemetryStore.FIELDS) {
      this.buffers.set(field, new Array(BUFFER_SIZE).fill(0));
    }
  }

  /** Push a new telemetry packet into the ring buffer */
  push(packet: TelemetryPacket): void {
    this.latestPacket = packet;

    const idx = this.writeIndex % BUFFER_SIZE;

    this.setField('v12', idx, packet.power.v12);
    this.setField('v5', idx, packet.power.v5);
    this.setField('v33', idx, packet.power.v33);
    this.setField('i12_ma', idx, packet.power.i12_ma);
    this.setField('i5_ma', idx, packet.power.i5_ma);
    this.setField('left_i', idx, packet.motors.left.i_ma);
    this.setField('left_rpwm', idx, packet.motors.left.rpwm);
    this.setField('left_lpwm', idx, packet.motors.left.lpwm);
    this.setField('right_i', idx, packet.motors.right.i_ma);
    this.setField('right_rpwm', idx, packet.motors.right.rpwm);
    this.setField('right_lpwm', idx, packet.motors.right.lpwm);
    this.setField('tof_mm', idx, packet.sensors.tof_mm);
    this.setField('sonic_cm', idx, packet.sensors.sonic_cm);
    this.setField('kalman_cm', idx, packet.sensors.kalman_cm);

    this.writeIndex++;
    if (this.count < BUFFER_SIZE) {
      this.count++;
    }
  }

  /** Get the history for a specific field (oldest first) */
  getHistory(key: TelemetryField, length?: number): number[] {
    const buf = this.buffers.get(key);
    if (!buf) {
      return [];
    }

    const len = Math.min(length || this.count, this.count);
    const result: number[] = [];
    const startIdx = this.count >= BUFFER_SIZE
      ? this.writeIndex % BUFFER_SIZE
      : 0;

    for (let i = 0; i < len; i++) {
      const idx = (startIdx + (this.count - len) + i) % BUFFER_SIZE;
      result.push(buf[idx]);
    }

    return result;
  }

  /** Get the latest value for a specific field */
  getLatest(key: TelemetryField): number {
    if (this.count === 0) {
      return 0;
    }
    const buf = this.buffers.get(key);
    if (!buf) {
      return 0;
    }
    const idx = (this.writeIndex - 1 + BUFFER_SIZE) % BUFFER_SIZE;
    return buf[idx];
  }

  /** Get the latest complete packet */
  getLatestPacket(): TelemetryPacket | null {
    return this.latestPacket;
  }

  /** Get the number of stored samples */
  getCount(): number {
    return this.count;
  }

  /** Reset all buffers */
  clear(): void {
    for (const field of TelemetryStore.FIELDS) {
      this.buffers.set(field, new Array(BUFFER_SIZE).fill(0));
    }
    this.writeIndex = 0;
    this.count = 0;
    this.latestPacket = null;
  }

  private setField(field: TelemetryField, idx: number, value: number): void {
    const buf = this.buffers.get(field);
    if (buf) {
      buf[idx] = value;
    }
  }
}
