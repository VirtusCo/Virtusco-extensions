// Copyright 2026 VirtusCo

// ── Telemetry Packet ────────────────────────────────────────────────

export interface PowerData {
  v12: number;
  v5: number;
  v33: number;
  i12_ma: number;
  i5_ma: number;
  relay_states: boolean[];
}

export interface MotorChannel {
  rpwm: number;
  lpwm: number;
  en: boolean;
  i_ma: number;
}

export interface MotorData {
  left: MotorChannel;
  right: MotorChannel;
}

export interface SensorData {
  tof_mm: number;
  sonic_cm: number;
  microwave: number;
  kalman_cm: number;
}

export interface Esp32Health {
  esp1_uptime_ms: number;
  esp2_uptime_ms: number;
  esp1_errors: number;
  esp2_errors: number;
}

export interface TelemetryPacket {
  power: PowerData;
  motors: MotorData;
  sensors: SensorData;
  esp32_health: Esp32Health;
  timestamp: number;
}

// ── Alerts ──────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  field: string;
  message: string;
  timestamp: number;
  value: number;
  threshold: number;
}

// ── Alert Configuration ─────────────────────────────────────────────

export interface ThresholdPair {
  warn: number;
  critical: number;
}

export interface AlertConfig {
  POWER_THRESHOLDS: {
    v12: { low: ThresholdPair; high: ThresholdPair };
    v5: { low: ThresholdPair; high: ThresholdPair };
    v33: { low: ThresholdPair; high: ThresholdPair };
  };
  CURRENT_THRESHOLDS: {
    i12_ma: ThresholdPair;
    i5_ma: ThresholdPair;
  };
  MOTOR_THRESHOLDS: {
    current_ma: ThresholdPair;
    temp_c: ThresholdPair;
  };
  SENSOR_DISAGREEMENT_PCT: number;
}

// ── Message Protocols ───────────────────────────────────────────────

/** Messages from the webview to the extension host */
export type WebviewMessage =
  | { type: 'connect'; port: string; baud: number }
  | { type: 'disconnect' }
  | { type: 'autoDetect' }
  | { type: 'clearAlerts' }
  | { type: 'requestPortList' }
  | { type: 'requestEventLog' }
  | { type: 'exportCsv' }
  | { type: 'updateThresholds'; config: AlertConfig }
  | { type: 'openSchematic'; field: string }
  | { type: 'changePage'; page: string };

/** Messages from the extension host to the webview */
export type HostMessage =
  | { type: 'telemetry'; packet: TelemetryPacket }
  | { type: 'alert'; alert: Alert }
  | { type: 'alertCleared' }
  | { type: 'connectionStatus'; connected: boolean; port: string }
  | { type: 'portList'; ports: string[] }
  | { type: 'eventLog'; events: Alert[] }
  | { type: 'thresholds'; config: AlertConfig }
  | { type: 'error'; message: string };
