// Copyright 2026 VirtusCo

import { BuilderComponent, BuilderSchematic, BuilderPin } from '../types';

function pin(id: string, name: string, dir: 'in' | 'out' | 'bidir'): BuilderPin {
  return { id, name, dir };
}

/**
 * Component library for the visual schematic builder.
 * Each entry is a template that can be instantiated on the canvas.
 */
export const COMPONENT_LIBRARY: BuilderComponent[] = [
  // --- Passive Components ---
  {
    id: 'tpl_resistor',
    type: 'Resistor',
    name: 'Resistor',
    value: '10k',
    pins: [
      pin('1', '1', 'bidir'),
      pin('2', '2', 'bidir'),
    ],
    position: { x: 0, y: 0 },
  },
  {
    id: 'tpl_capacitor',
    type: 'Capacitor',
    name: 'Capacitor',
    value: '100nF',
    pins: [
      pin('1', '1', 'bidir'),
      pin('2', '2', 'bidir'),
    ],
    position: { x: 0, y: 0 },
  },
  {
    id: 'tpl_diode',
    type: 'Diode',
    name: 'Diode',
    value: '1N4148',
    pins: [
      pin('A', 'A', 'in'),
      pin('K', 'K', 'out'),
    ],
    position: { x: 0, y: 0 },
  },
  {
    id: 'tpl_led',
    type: 'LED',
    name: 'LED',
    value: 'Red',
    pins: [
      pin('A', 'A', 'in'),
      pin('K', 'K', 'out'),
    ],
    position: { x: 0, y: 0 },
  },

  // --- IC Components ---
  {
    id: 'tpl_bts7960',
    type: 'BTS7960',
    name: 'BTS7960 H-Bridge',
    value: 'BTS7960',
    pins: [
      pin('RPWM', 'RPWM', 'in'),
      pin('LPWM', 'LPWM', 'in'),
      pin('R_EN', 'R_EN', 'in'),
      pin('L_EN', 'L_EN', 'in'),
      pin('IS', 'IS', 'out'),
      pin('GND', 'GND', 'bidir'),
    ],
    position: { x: 0, y: 0 },
  },
  {
    id: 'tpl_esp32',
    type: 'ESP32-WROOM',
    name: 'ESP32-WROOM-32',
    value: 'ESP32-WROOM-32',
    pins: [
      pin('GPIO0', 'GPIO0', 'bidir'),
      pin('GPIO1', 'GPIO1', 'bidir'),
      pin('GPIO2', 'GPIO2', 'bidir'),
      pin('GPIO3', 'GPIO3', 'bidir'),
      pin('GPIO4', 'GPIO4', 'bidir'),
      pin('GPIO5', 'GPIO5', 'bidir'),
      pin('GPIO12', 'GPIO12', 'bidir'),
      pin('GPIO13', 'GPIO13', 'bidir'),
      pin('GPIO14', 'GPIO14', 'bidir'),
      pin('GPIO15', 'GPIO15', 'bidir'),
      pin('GPIO16', 'GPIO16', 'bidir'),
      pin('GPIO17', 'GPIO17', 'bidir'),
      pin('GPIO18', 'GPIO18', 'bidir'),
      pin('GPIO19', 'GPIO19', 'bidir'),
      pin('GPIO21', 'GPIO21', 'bidir'),
      pin('GPIO22', 'GPIO22', 'bidir'),
      pin('GPIO23', 'GPIO23', 'bidir'),
      pin('VIN', 'VIN', 'in'),
      pin('GND', 'GND', 'bidir'),
      pin('3V3', '3V3', 'out'),
      pin('EN', 'EN', 'in'),
    ],
    position: { x: 0, y: 0 },
  },
  {
    id: 'tpl_arduino_nano',
    type: 'Arduino Nano',
    name: 'Arduino Nano',
    value: 'Arduino Nano',
    pins: [
      pin('D0', 'D0/RX', 'bidir'),
      pin('D1', 'D1/TX', 'bidir'),
      pin('D2', 'D2', 'bidir'),
      pin('D3', 'D3', 'bidir'),
      pin('D4', 'D4', 'bidir'),
      pin('D5', 'D5', 'bidir'),
      pin('D6', 'D6', 'bidir'),
      pin('D7', 'D7', 'bidir'),
      pin('D8', 'D8', 'bidir'),
      pin('D9', 'D9', 'bidir'),
      pin('D10', 'D10', 'bidir'),
      pin('D11', 'D11/MOSI', 'bidir'),
      pin('D12', 'D12/MISO', 'bidir'),
      pin('D13', 'D13/SCK', 'bidir'),
      pin('A0', 'A0', 'in'),
      pin('A1', 'A1', 'in'),
      pin('A2', 'A2', 'in'),
      pin('A3', 'A3', 'in'),
      pin('A4', 'A4/SDA', 'bidir'),
      pin('A5', 'A5/SCL', 'bidir'),
      pin('A6', 'A6', 'in'),
      pin('A7', 'A7', 'in'),
      pin('VIN', 'VIN', 'in'),
      pin('5V', '5V', 'out'),
      pin('3V3', '3V3', 'out'),
      pin('GND1', 'GND', 'bidir'),
      pin('GND2', 'GND', 'bidir'),
      pin('RST', 'RST', 'in'),
      pin('REF', 'AREF', 'in'),
      pin('RAW', 'RAW', 'in'),
    ],
    position: { x: 0, y: 0 },
  },

  // --- Sensor Components ---
  {
    id: 'tpl_vl53l0x',
    type: 'VL53L0X',
    name: 'VL53L0X ToF Sensor',
    value: 'VL53L0X',
    pins: [
      pin('VIN', 'VIN', 'in'),
      pin('GND', 'GND', 'bidir'),
      pin('SDA', 'SDA', 'bidir'),
      pin('SCL', 'SCL', 'bidir'),
    ],
    position: { x: 0, y: 0 },
  },
  {
    id: 'tpl_hcsr04',
    type: 'HC-SR04',
    name: 'HC-SR04 Ultrasonic',
    value: 'HC-SR04',
    pins: [
      pin('VCC', 'VCC', 'in'),
      pin('TRIG', 'TRIG', 'in'),
      pin('ECHO', 'ECHO', 'out'),
      pin('GND', 'GND', 'bidir'),
    ],
    position: { x: 0, y: 0 },
  },
  {
    id: 'tpl_rcwl0516',
    type: 'RCWL-0516',
    name: 'RCWL-0516 Microwave',
    value: 'RCWL-0516',
    pins: [
      pin('VIN', 'VIN', 'in'),
      pin('OUT', 'OUT', 'out'),
      pin('GND', 'GND', 'bidir'),
    ],
    position: { x: 0, y: 0 },
  },

  // --- Power Components ---
  {
    id: 'tpl_lm7805',
    type: 'LM7805',
    name: 'LM7805 Voltage Regulator',
    value: 'LM7805',
    pins: [
      pin('IN', 'IN', 'in'),
      pin('GND', 'GND', 'bidir'),
      pin('OUT', 'OUT', 'out'),
    ],
    position: { x: 0, y: 0 },
  },
  {
    id: 'tpl_ams1117',
    type: 'AMS1117-3.3',
    name: 'AMS1117-3.3 Regulator',
    value: 'AMS1117-3.3',
    pins: [
      pin('IN', 'IN', 'in'),
      pin('GND', 'GND', 'bidir'),
      pin('OUT', 'OUT', 'out'),
    ],
    position: { x: 0, y: 0 },
  },
  {
    id: 'tpl_relay',
    type: 'Relay Module',
    name: 'Relay Module',
    value: 'Relay',
    pins: [
      pin('VCC', 'VCC', 'in'),
      pin('GND', 'GND', 'bidir'),
      pin('IN', 'IN', 'in'),
      pin('COM', 'COM', 'bidir'),
      pin('NO', 'NO', 'out'),
      pin('NC', 'NC', 'out'),
    ],
    position: { x: 0, y: 0 },
  },

  // --- Connector Components ---
  {
    id: 'tpl_usbc',
    type: 'USB-C',
    name: 'USB-C Connector',
    value: 'USB-C',
    pins: [
      pin('VBUS', 'VBUS', 'out'),
      pin('D+', 'D+', 'bidir'),
      pin('D-', 'D-', 'bidir'),
      pin('GND', 'GND', 'bidir'),
    ],
    position: { x: 0, y: 0 },
  },
];

/**
 * Returns all component templates grouped by category.
 */
export function getLibrary(): BuilderComponent[] {
  return COMPONENT_LIBRARY;
}

/**
 * Returns the category for a component type.
 */
export function getComponentCategory(type: string): string {
  const categoryMap: Record<string, string> = {
    'Resistor': 'Passive',
    'Capacitor': 'Passive',
    'Diode': 'Passive',
    'LED': 'Passive',
    'BTS7960': 'IC',
    'ESP32-WROOM': 'IC',
    'Arduino Nano': 'IC',
    'VL53L0X': 'Sensor',
    'HC-SR04': 'Sensor',
    'RCWL-0516': 'Sensor',
    'LM7805': 'Power',
    'AMS1117-3.3': 'Power',
    'Relay Module': 'Power',
    'USB-C': 'Connector',
  };
  return categoryMap[type] || 'Other';
}

/**
 * Exports a BuilderSchematic to KiCad .kicad_sch S-expression format.
 */
export function exportToKicad(schematic: BuilderSchematic): string {
  const lines: string[] = [];
  lines.push('(kicad_sch (version 20231120) (generator "virtus-pcb-studio")');
  lines.push('');
  lines.push('  (paper "A4")');
  lines.push('');

  // lib_symbols section (minimal)
  lines.push('  (lib_symbols');
  const uniqueTypes = new Set(schematic.components.map((c) => c.type));
  for (const type of uniqueTypes) {
    const template = COMPONENT_LIBRARY.find((c) => c.type === type);
    if (!template) {
      continue;
    }
    lines.push(`    (symbol "${type}:${type}" (in_bom yes) (on_board yes)`);
    lines.push(`      (property "Reference" "${getRefPrefix(type)}" (at 0 -1.27 0))`);
    lines.push(`      (property "Value" "${type}" (at 0 1.27 0))`);
    for (const p of template.pins) {
      const direction = p.dir === 'in' ? 'input' : p.dir === 'out' ? 'output' : 'bidirectional';
      lines.push(`      (pin ${direction} line (at 0 0 0) (name "${p.name}") (number "${p.id}"))`);
    }
    lines.push('    )');
  }
  lines.push('  )');
  lines.push('');

  // Symbols (component instances)
  for (let i = 0; i < schematic.components.length; i++) {
    const comp = schematic.components[i];
    const refPrefix = getRefPrefix(comp.type);
    const ref = comp.id.startsWith(refPrefix) ? comp.id : `${refPrefix}${i + 1}`;

    lines.push(`  (symbol (lib_id "${comp.type}:${comp.type}") (at ${comp.position.x} ${comp.position.y} 0)`);
    lines.push(`    (property "Reference" "${ref}" (at ${comp.position.x} ${comp.position.y - 5} 0))`);
    lines.push(`    (property "Value" "${comp.value}" (at ${comp.position.x} ${comp.position.y + 5} 0))`);

    for (const p of comp.pins) {
      lines.push(`    (pin (at 0 0) (name "${p.name}") (number "${p.id}"))`);
    }
    lines.push('  )');
    lines.push('');
  }

  // Wires
  for (const wire of schematic.wires) {
    const fromComp = schematic.components.find((c) => c.id === wire.from.component);
    const toComp = schematic.components.find((c) => c.id === wire.to.component);
    if (!fromComp || !toComp) {
      continue;
    }

    const fromPinIdx = fromComp.pins.findIndex((p) => p.id === wire.from.pin);
    const toPinIdx = toComp.pins.findIndex((p) => p.id === wire.to.pin);
    const x1 = fromComp.position.x + (fromPinIdx + 1) * 5;
    const y1 = fromComp.position.y;
    const x2 = toComp.position.x + (toPinIdx + 1) * 5;
    const y2 = toComp.position.y;

    lines.push(`  (wire (pts (xy ${x1} ${y1}) (xy ${x2} ${y2})))`);
  }

  lines.push(')');
  return lines.join('\n');
}

function getRefPrefix(type: string): string {
  const prefixMap: Record<string, string> = {
    'Resistor': 'R',
    'Capacitor': 'C',
    'Diode': 'D',
    'LED': 'D',
    'BTS7960': 'U',
    'ESP32-WROOM': 'U',
    'Arduino Nano': 'U',
    'VL53L0X': 'U',
    'HC-SR04': 'U',
    'RCWL-0516': 'U',
    'LM7805': 'U',
    'AMS1117-3.3': 'U',
    'Relay Module': 'K',
    'USB-C': 'J',
  };
  return prefixMap[type] || 'U';
}
