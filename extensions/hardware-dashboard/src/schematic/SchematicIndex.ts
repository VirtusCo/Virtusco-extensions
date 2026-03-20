// Copyright 2026 VirtusCo

import * as vscode from 'vscode';

/** Cross-reference mapping from telemetry fields to source code locations */
export const SCHEMATIC_XREF: Record<string, { file: string; line: number; description: string }> = {
  'motors.left.i_ma': {
    file: 'esp32_firmware/motor_controller/src/main.cpp',
    line: 42,
    description: 'Left motor current sensing (ADC)',
  },
  'motors.right.i_ma': {
    file: 'esp32_firmware/motor_controller/src/main.cpp',
    line: 48,
    description: 'Right motor current sensing (ADC)',
  },
  'motors.left.rpwm': {
    file: 'esp32_firmware/motor_controller/src/main.cpp',
    line: 95,
    description: 'Left motor forward PWM duty',
  },
  'motors.left.lpwm': {
    file: 'esp32_firmware/motor_controller/src/main.cpp',
    line: 96,
    description: 'Left motor reverse PWM duty',
  },
  'motors.right.rpwm': {
    file: 'esp32_firmware/motor_controller/src/main.cpp',
    line: 101,
    description: 'Right motor forward PWM duty',
  },
  'motors.right.lpwm': {
    file: 'esp32_firmware/motor_controller/src/main.cpp',
    line: 102,
    description: 'Right motor reverse PWM duty',
  },
  'power.v12': {
    file: 'esp32_firmware/motor_controller/src/power_monitor.c',
    line: 18,
    description: '12V rail voltage divider ADC reading',
  },
  'power.v5': {
    file: 'esp32_firmware/motor_controller/src/power_monitor.c',
    line: 24,
    description: '5V rail voltage divider ADC reading',
  },
  'power.v33': {
    file: 'esp32_firmware/motor_controller/src/power_monitor.c',
    line: 30,
    description: '3.3V rail voltage divider ADC reading',
  },
  'power.i12_ma': {
    file: 'esp32_firmware/motor_controller/src/power_monitor.c',
    line: 36,
    description: '12V rail current sense (shunt resistor)',
  },
  'power.i5_ma': {
    file: 'esp32_firmware/motor_controller/src/power_monitor.c',
    line: 42,
    description: '5V rail current sense (shunt resistor)',
  },
  'sensors.tof_mm': {
    file: 'esp32_firmware/sensor_fusion/src/main.cpp',
    line: 67,
    description: 'VL53L0X Time-of-Flight distance reading',
  },
  'sensors.sonic_cm': {
    file: 'esp32_firmware/sensor_fusion/src/main.cpp',
    line: 78,
    description: 'HC-SR04 ultrasonic distance reading',
  },
  'sensors.microwave': {
    file: 'esp32_firmware/sensor_fusion/src/main.cpp',
    line: 89,
    description: 'RCWL-0516 microwave presence detection',
  },
  'sensors.kalman_cm': {
    file: 'esp32_firmware/sensor_fusion/src/main.cpp',
    line: 112,
    description: 'Kalman-filtered fused distance estimate',
  },
};

/**
 * Opens the source file corresponding to a telemetry field in the editor.
 */
export async function openInEditor(field: string): Promise<void> {
  const xref = SCHEMATIC_XREF[field];
  if (!xref) {
    vscode.window.showWarningMessage(`No schematic reference found for: ${field}`);
    return;
  }

  // Search in workspace folders for the file
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  for (const folder of workspaceFolders) {
    const filePath = vscode.Uri.joinPath(folder.uri, xref.file);
    try {
      const stat = await vscode.workspace.fs.stat(filePath);
      if (stat) {
        const doc = await vscode.workspace.openTextDocument(filePath);
        const line = Math.max(0, xref.line - 1);
        const range = new vscode.Range(line, 0, line, 0);
        await vscode.window.showTextDocument(doc, {
          selection: range,
          preview: false,
        });
        return;
      }
    } catch {
      // File not found in this workspace folder, try next
    }
  }

  vscode.window.showWarningMessage(
    `Source file not found: ${xref.file} (line ${xref.line})`
  );
}
