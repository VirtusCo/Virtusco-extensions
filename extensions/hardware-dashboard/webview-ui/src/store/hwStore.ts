// Copyright 2026 VirtusCo

import { create } from 'zustand';

// ── Types ───────────────────────────────────────────────────────────

export type PageId = 'overview' | 'power' | 'motors' | 'sensors' | 'alerts' | 'eventlog';

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

export interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  field: string;
  message: string;
  timestamp: number;
  value: number;
  threshold: number;
}

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

const HISTORY_LENGTH = 30;

// ── Store ───────────────────────────────────────────────────────────

interface HwState {
  activePage: PageId;
  connected: boolean;
  port: string;
  latestPacket: TelemetryPacket | null;
  alerts: AlertItem[];
  eventLog: AlertItem[];
  ports: string[];
  thresholds: AlertConfig | null;

  // History buffers (last 30 values)
  powerHistory: {
    v12: number[];
    v5: number[];
    v33: number[];
  };
  motorHistory: {
    leftCurrent: number[];
    rightCurrent: number[];
  };

  // Min/Max tracking
  powerMinMax: {
    v12: { min: number; max: number };
    v5: { min: number; max: number };
    v33: { min: number; max: number };
  };

  // Actions
  setActivePage: (page: PageId) => void;
  setConnected: (connected: boolean, port: string) => void;
  updateTelemetry: (packet: TelemetryPacket) => void;
  addAlert: (alert: AlertItem) => void;
  clearAlerts: () => void;
  setEventLog: (events: AlertItem[]) => void;
  setPorts: (ports: string[]) => void;
  setThresholds: (config: AlertConfig) => void;
}

export const useHwStore = create<HwState>((set) => ({
  activePage: 'overview',
  connected: false,
  port: '',
  latestPacket: null,
  alerts: [],
  eventLog: [],
  ports: [],
  thresholds: null,

  powerHistory: { v12: [], v5: [], v33: [] },
  motorHistory: { leftCurrent: [], rightCurrent: [] },
  powerMinMax: {
    v12: { min: Infinity, max: -Infinity },
    v5: { min: Infinity, max: -Infinity },
    v33: { min: Infinity, max: -Infinity },
  },

  setActivePage: (page) => set({ activePage: page }),

  setConnected: (connected, port) => set({ connected, port }),

  updateTelemetry: (packet) => set((state) => {
    const pushHistory = (arr: number[], val: number): number[] => {
      const next = [...arr, val];
      return next.length > HISTORY_LENGTH ? next.slice(-HISTORY_LENGTH) : next;
    };

    const updateMinMax = (
      current: { min: number; max: number },
      val: number,
    ): { min: number; max: number } => ({
      min: Math.min(current.min, val),
      max: Math.max(current.max, val),
    });

    return {
      latestPacket: packet,
      powerHistory: {
        v12: pushHistory(state.powerHistory.v12, packet.power.v12),
        v5: pushHistory(state.powerHistory.v5, packet.power.v5),
        v33: pushHistory(state.powerHistory.v33, packet.power.v33),
      },
      motorHistory: {
        leftCurrent: pushHistory(state.motorHistory.leftCurrent, packet.motors.left.i_ma),
        rightCurrent: pushHistory(state.motorHistory.rightCurrent, packet.motors.right.i_ma),
      },
      powerMinMax: {
        v12: updateMinMax(state.powerMinMax.v12, packet.power.v12),
        v5: updateMinMax(state.powerMinMax.v5, packet.power.v5),
        v33: updateMinMax(state.powerMinMax.v33, packet.power.v33),
      },
    };
  }),

  addAlert: (alert) => set((state) => ({
    alerts: [alert, ...state.alerts].slice(0, 100),
  })),

  clearAlerts: () => set({ alerts: [] }),

  setEventLog: (events) => set({ eventLog: events }),

  setPorts: (ports) => set({ ports }),

  setThresholds: (config) => set({ thresholds: config }),
}));
