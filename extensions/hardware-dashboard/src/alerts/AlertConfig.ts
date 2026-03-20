// Copyright 2026 VirtusCo

import type { AlertConfig } from '../types';

/** Default alert thresholds for the Porter robot hardware */
export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  POWER_THRESHOLDS: {
    v12: {
      low: { warn: 11.5, critical: 11.0 },
      high: { warn: 13.0, critical: 13.5 },
    },
    v5: {
      low: { warn: 4.75, critical: 4.6 },
      high: { warn: 5.3, critical: 5.5 },
    },
    v33: {
      low: { warn: 3.1, critical: 3.0 },
      high: { warn: 3.5, critical: 3.6 },
    },
  },
  CURRENT_THRESHOLDS: {
    i12_ma: { warn: 5000, critical: 8000 },
    i5_ma: { warn: 2000, critical: 3000 },
  },
  MOTOR_THRESHOLDS: {
    current_ma: { warn: 3000, critical: 6000 },
    temp_c: { warn: 80, critical: 120 },
  },
  SENSOR_DISAGREEMENT_PCT: 20,
};

/**
 * Estimate motor temperature from current draw and duty cycle.
 * Uses a simplified thermal model: T = ambient + (I^2 * R_thermal * duty_factor)
 *
 * @param current_ma - Motor current in milliamps
 * @param duty_pct - PWM duty cycle as percentage (0-100)
 * @param ambient - Ambient temperature in Celsius (default 25)
 * @returns Estimated motor temperature in Celsius
 */
export function estimateTemp(current_ma: number, duty_pct: number, ambient = 25): number {
  // Thermal resistance coefficient (simplified model for BTS7960)
  const R_THERMAL = 0.0000015; // degC per mA^2
  const dutyFactor = Math.max(0, Math.min(1, duty_pct / 100));
  const tempRise = current_ma * current_ma * R_THERMAL * dutyFactor;
  return ambient + tempRise;
}
