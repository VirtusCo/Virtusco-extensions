// Copyright 2026 VirtusCo

import * as fs from 'fs';
import { SyncResult } from '../types';
import { NetEntry } from '../kicad/NetlistExtractor';

/**
 * Mapping from schematic net names to expected DTS alias names.
 * Covers Porter Robot's full ESP32 motor + sensor board.
 */
export const VIRTUS_NET_TO_DTS: Record<string, string> = {
  // Motor control — BTS7960 H-bridge
  'MOTOR_L_RPWM': 'motor-left-rpwm',
  'MOTOR_L_LPWM': 'motor-left-lpwm',
  'MOTOR_L_EN': 'motor-left-en',
  'MOTOR_R_RPWM': 'motor-right-rpwm',
  'MOTOR_R_LPWM': 'motor-right-lpwm',
  'MOTOR_R_EN': 'motor-right-en',
  // I2C bus — sensors
  'I2C_SDA': 'i2c-sda',
  'I2C_SCL': 'i2c-scl',
  // UART — inter-board comms
  'UART_TX': 'uart-tx',
  'UART_RX': 'uart-rx',
  // Ultrasonic — HC-SR04
  'US_TRIG': 'ultrasonic-trig',
  'US_ECHO': 'ultrasonic-echo',
  // Relay module
  'RELAY_IN': 'relay-in',
  // Microwave sensor — RCWL-0516
  'MW_OUT': 'microwave-out',
  // Status LED
  'STATUS_LED': 'status-led',
  // Emergency stop
  'ESTOP': 'estop-in',
};

/**
 * Reads a Zephyr .overlay file and extracts alias -> GPIO pin mappings.
 * Expected format:
 *   / {
 *     aliases {
 *       motor-left-rpwm = &gpio0 16;
 *       ...
 *     };
 *   };
 */
export function readDTSAliases(overlayPath: string): Map<string, string> {
  const aliases = new Map<string, string>();

  if (!fs.existsSync(overlayPath)) {
    return aliases;
  }

  const content = fs.readFileSync(overlayPath, 'utf-8');
  const lines = content.split('\n');

  let inAliases = false;
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.includes('aliases')) {
      inAliases = true;
    }

    if (inAliases) {
      for (const ch of trimmed) {
        if (ch === '{') {
          braceDepth++;
        }
        if (ch === '}') {
          braceDepth--;
        }
      }

      if (braceDepth <= 0 && inAliases && trimmed.includes('}')) {
        inAliases = false;
        continue;
      }

      // Match: alias-name = &gpioX pinNumber;
      const aliasMatch = trimmed.match(/^([\w-]+)\s*=\s*&(\w+)\s+(\d+)\s*;?$/);
      if (aliasMatch) {
        const aliasName = aliasMatch[1];
        const gpioPort = aliasMatch[2];
        const gpioPin = aliasMatch[3];
        aliases.set(aliasName, `${gpioPort} ${gpioPin}`);
      }

      // Also match: alias-name = &gpioX <pinNumber flags>;
      const aliasMatch2 = trimmed.match(/^([\w-]+)\s*=\s*&(\w+)\s+<\s*(\d+)\s+\d+\s*>\s*;?$/);
      if (aliasMatch2) {
        const aliasName = aliasMatch2[1];
        const gpioPort = aliasMatch2[2];
        const gpioPin = aliasMatch2[3];
        aliases.set(aliasName, `${gpioPort} ${gpioPin}`);
      }
    }
  }

  return aliases;
}

/**
 * Checks synchronization between schematic netlist and DTS overlay aliases.
 * Returns SyncResult[] with ok/mismatch/missing status for each mapped net.
 */
export function checkSync(
  netlist: Map<string, NetEntry[]>,
  dtsAliases: Map<string, string>
): SyncResult[] {
  const results: SyncResult[] = [];

  for (const [netName, dtsAlias] of Object.entries(VIRTUS_NET_TO_DTS)) {
    const netEntries = netlist.get(netName);
    const dtsPin = dtsAliases.get(dtsAlias);

    // Find the GPIO pin from the schematic net
    let schematicPin = '';
    if (netEntries && netEntries.length > 0) {
      // Pick the first pin that has a gpio_number
      const gpioEntry = netEntries.find((e) => e.gpio_number !== e.pin);
      schematicPin = gpioEntry ? `GPIO${gpioEntry.gpio_number}` : netEntries[0].pin;
    }

    if (!netEntries || netEntries.length === 0) {
      // Net not found in schematic
      results.push({
        net_name: netName,
        dts_alias: dtsAlias,
        schematic_pin: '(not found)',
        dts_pin: dtsPin || '(not found)',
        status: 'missing',
      });
    } else if (!dtsPin) {
      // Net found in schematic but no DTS alias
      results.push({
        net_name: netName,
        dts_alias: dtsAlias,
        schematic_pin: schematicPin,
        dts_pin: '(not defined)',
        status: 'missing',
      });
    } else {
      // Both exist — check if GPIO numbers match
      const dtsGpioMatch = dtsPin.match(/gpio\d*\s+(\d+)/);
      const dtsGpioNum = dtsGpioMatch ? dtsGpioMatch[1] : '';
      const schGpioMatch = schematicPin.match(/GPIO(\d+)/);
      const schGpioNum = schGpioMatch ? schGpioMatch[1] : '';

      if (dtsGpioNum && schGpioNum && dtsGpioNum === schGpioNum) {
        results.push({
          net_name: netName,
          dts_alias: dtsAlias,
          schematic_pin: schematicPin,
          dts_pin: dtsPin,
          status: 'ok',
        });
      } else {
        results.push({
          net_name: netName,
          dts_alias: dtsAlias,
          schematic_pin: schematicPin,
          dts_pin: dtsPin,
          status: 'mismatch',
        });
      }
    }
  }

  return results;
}
