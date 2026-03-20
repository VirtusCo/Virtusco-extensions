// Copyright 2026 VirtusCo

import type { TelemetryPacket, Alert, AlertSeverity, AlertConfig } from '../types';
import { DEFAULT_ALERT_CONFIG, estimateTemp } from './AlertConfig';

const COOLDOWN_MS = 5000; // 5 second cooldown per alert ID

/**
 * Evaluates telemetry packets against thresholds and generates alerts.
 * Enforces a 5-second cooldown per alert ID to avoid flooding.
 */
export class AlertEngine {
  private config: AlertConfig;
  private lastFired: Map<string, number> = new Map();

  constructor(config?: AlertConfig) {
    this.config = config || { ...DEFAULT_ALERT_CONFIG };
  }

  /** Update alert thresholds */
  setConfig(config: AlertConfig): void {
    this.config = config;
  }

  /** Get current alert configuration */
  getConfig(): AlertConfig {
    return this.config;
  }

  /** Evaluate a telemetry packet and return any triggered alerts */
  evaluate(packet: TelemetryPacket): Alert[] {
    const alerts: Alert[] = [];
    const now = Date.now();

    // ── Voltage checks ──────────────────────────────────────────────
    this.checkVoltage(alerts, now, 'power.v12', packet.power.v12, this.config.POWER_THRESHOLDS.v12);
    this.checkVoltage(alerts, now, 'power.v5', packet.power.v5, this.config.POWER_THRESHOLDS.v5);
    this.checkVoltage(alerts, now, 'power.v33', packet.power.v33, this.config.POWER_THRESHOLDS.v33);

    // ── Motor overcurrent checks ────────────────────────────────────
    this.checkHigh(alerts, now, 'motors.left.i_ma', packet.motors.left.i_ma,
      this.config.MOTOR_THRESHOLDS.current_ma, 'Left motor overcurrent');
    this.checkHigh(alerts, now, 'motors.right.i_ma', packet.motors.right.i_ma,
      this.config.MOTOR_THRESHOLDS.current_ma, 'Right motor overcurrent');

    // ── Motor temperature estimates ─────────────────────────────────
    const leftDuty = Math.max(packet.motors.left.rpwm, packet.motors.left.lpwm);
    const rightDuty = Math.max(packet.motors.right.rpwm, packet.motors.right.lpwm);
    const leftTemp = estimateTemp(packet.motors.left.i_ma, leftDuty);
    const rightTemp = estimateTemp(packet.motors.right.i_ma, rightDuty);

    this.checkHigh(alerts, now, 'motors.left.temp', leftTemp,
      this.config.MOTOR_THRESHOLDS.temp_c, 'Left motor overtemp (estimated)');
    this.checkHigh(alerts, now, 'motors.right.temp', rightTemp,
      this.config.MOTOR_THRESHOLDS.temp_c, 'Right motor overtemp (estimated)');

    // ── Sensor disagreement check ───────────────────────────────────
    const tofCm = packet.sensors.tof_mm / 10;
    const sonicCm = packet.sensors.sonic_cm;
    if (tofCm > 0 && sonicCm > 0) {
      const avg = (tofCm + sonicCm) / 2;
      const disagreementPct = Math.abs(tofCm - sonicCm) / avg * 100;
      if (disagreementPct > this.config.SENSOR_DISAGREEMENT_PCT) {
        const id = 'sensors.disagreement';
        if (this.canFire(id, now)) {
          const severity: AlertSeverity = disagreementPct > 50 ? 'critical' : 'warning';
          alerts.push({
            id,
            severity,
            field: 'sensors',
            message: `ToF/Ultrasonic disagreement: ${disagreementPct.toFixed(1)}% (ToF: ${tofCm.toFixed(1)}cm, Sonic: ${sonicCm.toFixed(1)}cm)`,
            timestamp: now,
            value: disagreementPct,
            threshold: this.config.SENSOR_DISAGREEMENT_PCT,
          });
          this.lastFired.set(id, now);
        }
      }
    }

    return alerts;
  }

  /** Reset cooldown timers */
  resetCooldowns(): void {
    this.lastFired.clear();
  }

  private checkVoltage(
    alerts: Alert[],
    now: number,
    field: string,
    value: number,
    thresholds: { low: { warn: number; critical: number }; high: { warn: number; critical: number } },
  ): void {
    // Low voltage
    if (value < thresholds.low.critical) {
      this.pushAlert(alerts, now, `${field}.low`, 'critical', field,
        `${field} critically low: ${value.toFixed(2)}V`, value, thresholds.low.critical);
    } else if (value < thresholds.low.warn) {
      this.pushAlert(alerts, now, `${field}.low`, 'warning', field,
        `${field} low: ${value.toFixed(2)}V`, value, thresholds.low.warn);
    }

    // High voltage
    if (value > thresholds.high.critical) {
      this.pushAlert(alerts, now, `${field}.high`, 'critical', field,
        `${field} critically high: ${value.toFixed(2)}V`, value, thresholds.high.critical);
    } else if (value > thresholds.high.warn) {
      this.pushAlert(alerts, now, `${field}.high`, 'warning', field,
        `${field} high: ${value.toFixed(2)}V`, value, thresholds.high.warn);
    }
  }

  private checkHigh(
    alerts: Alert[],
    now: number,
    field: string,
    value: number,
    thresholds: { warn: number; critical: number },
    label: string,
  ): void {
    if (value >= thresholds.critical) {
      this.pushAlert(alerts, now, field, 'critical', field,
        `${label}: ${value.toFixed(0)} (critical >= ${thresholds.critical})`,
        value, thresholds.critical);
    } else if (value >= thresholds.warn) {
      this.pushAlert(alerts, now, field, 'warning', field,
        `${label}: ${value.toFixed(0)} (warn >= ${thresholds.warn})`,
        value, thresholds.warn);
    }
  }

  private pushAlert(
    alerts: Alert[],
    now: number,
    id: string,
    severity: AlertSeverity,
    field: string,
    message: string,
    value: number,
    threshold: number,
  ): void {
    if (this.canFire(id, now)) {
      alerts.push({ id, severity, field, message, timestamp: now, value, threshold });
      this.lastFired.set(id, now);
    }
  }

  private canFire(id: string, now: number): boolean {
    const last = this.lastFired.get(id);
    if (!last) {
      return true;
    }
    return (now - last) >= COOLDOWN_MS;
  }
}
