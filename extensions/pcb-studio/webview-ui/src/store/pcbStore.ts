// Copyright 2026 VirtusCo

import { create } from 'zustand';

export type ActivePage = 'schematic' | 'sync' | 'bom' | 'diff' | 'impact' | 'builder' | 'components' | 'pcblayout' | 'gerber' | 'drc' | 'cost';

export interface SyncResult {
  net_name: string;
  dts_alias: string;
  schematic_pin: string;
  dts_pin: string;
  status: 'ok' | 'mismatch' | 'missing';
}

export interface BOMEntry {
  reference: string;
  value: string;
  footprint: string;
  lcsc_part: string;
  quantity: number;
  description: string;
}

export interface SchematicDiff {
  nets_added: string[];
  nets_removed: string[];
  nets_renamed: { old_name: string; new_name: string }[];
  pins_moved: { reference: string; pin: string; from: { x: number; y: number }; to: { x: number; y: number } }[];
  components_added: { reference: string; value: string }[];
  components_removed: { reference: string; value: string }[];
}

export interface FirmwareImpact {
  change: string;
  files: { path: string; line: number; text: string }[];
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

export interface BuilderPin {
  id: string;
  name: string;
  dir: 'in' | 'out' | 'bidir';
}

export interface BuilderComponent {
  id: string;
  type: string;
  name: string;
  value: string;
  pins: BuilderPin[];
  position: { x: number; y: number };
}

export interface BuilderWire {
  id: string;
  from: { component: string; pin: string };
  to: { component: string; pin: string };
}

interface PCBStore {
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;

  schematicSvg: string;
  setSchematicSvg: (svg: string) => void;

  schematicStats: { components: number; nets: number; sheets: number };
  setSchematicStats: (stats: { components: number; nets: number; sheets: number }) => void;

  syncResults: SyncResult[];
  setSyncResults: (results: SyncResult[]) => void;

  bomEntries: BOMEntry[];
  setBomEntries: (entries: BOMEntry[]) => void;

  diffResult: SchematicDiff | null;
  setDiffResult: (result: SchematicDiff | null) => void;

  impactResults: FirmwareImpact[];
  setImpactResults: (results: FirmwareImpact[]) => void;

  builderComponents: BuilderComponent[];
  setBuilderComponents: (components: BuilderComponent[]) => void;
  addBuilderComponent: (component: BuilderComponent) => void;
  updateBuilderComponent: (id: string, updates: Partial<BuilderComponent>) => void;
  removeBuilderComponent: (id: string) => void;

  builderWires: BuilderWire[];
  setBuilderWires: (wires: BuilderWire[]) => void;
  addBuilderWire: (wire: BuilderWire) => void;
  removeBuilderWire: (id: string) => void;

  builderLibrary: BuilderComponent[];
  setBuilderLibrary: (library: BuilderComponent[]) => void;

  clearBuilder: () => void;

  // PCB Layout state
  pcbDesign: Record<string, unknown> | null;
  setPcbDesign: (design: Record<string, unknown> | null) => void;

  drcViolations: { type: string; severity: string; message: string; location: { x: number; y: number }; items: string[] }[];
  setDrcViolations: (violations: { type: string; severity: string; message: string; location: { x: number; y: number }; items: string[] }[]) => void;

  gerberFiles: { layer: string; filename: string; content: string }[];
  setGerberFiles: (files: { layer: string; filename: string; content: string }[]) => void;

  costEstimate: { pcbCost: number; componentCost: number; assemblyEstimate: number; totalPerUnit: number; quantity: number; breakdown: { item: string; unitCost: number; qty: number; total: number }[]; manufacturer: string } | null;
  setCostEstimate: (estimate: { pcbCost: number; componentCost: number; assemblyEstimate: number; totalPerUnit: number; quantity: number; breakdown: { item: string; unitCost: number; qty: number; total: number }[]; manufacturer: string } | null) => void;

  activePcbLayer: string;
  setActivePcbLayer: (layer: string) => void;

  pcbTool: 'select' | 'trace' | 'via' | 'zone' | 'footprint';
  setPcbTool: (tool: 'select' | 'trace' | 'via' | 'zone' | 'footprint') => void;
}

function p(id: string, name: string, dir: 'in' | 'out' | 'bidir') { return { id, name, dir }; }

const DEFAULT_COMPONENT_LIBRARY: BuilderComponent[] = [
  { id: 'tpl_resistor', type: 'Resistor', name: 'Resistor', value: '10k', pins: [p('1','1','bidir'), p('2','2','bidir')], position: {x:0,y:0} },
  { id: 'tpl_capacitor', type: 'Capacitor', name: 'Capacitor', value: '100nF', pins: [p('1','1','bidir'), p('2','2','bidir')], position: {x:0,y:0} },
  { id: 'tpl_diode', type: 'Diode', name: 'Diode', value: '1N4148', pins: [p('A','A','in'), p('K','K','out')], position: {x:0,y:0} },
  { id: 'tpl_led', type: 'LED', name: 'LED', value: 'Red', pins: [p('A','A','in'), p('K','K','out')], position: {x:0,y:0} },
  { id: 'tpl_bts7960', type: 'BTS7960', name: 'BTS7960 H-Bridge', value: 'BTS7960', pins: [p('RPWM','RPWM','in'), p('LPWM','LPWM','in'), p('R_EN','R_EN','in'), p('L_EN','L_EN','in'), p('IS','IS','out'), p('GND','GND','bidir')], position: {x:0,y:0} },
  { id: 'tpl_esp32', type: 'ESP32-WROOM', name: 'ESP32-WROOM-32', value: 'ESP32', pins: [p('3V3','3V3','in'), p('GND','GND','bidir'), p('EN','EN','in'), p('GPIO0','GPIO0','bidir'), p('GPIO2','GPIO2','bidir'), p('GPIO4','GPIO4','bidir'), p('GPIO5','GPIO5','bidir'), p('GPIO12','GPIO12','bidir'), p('GPIO13','GPIO13','bidir'), p('GPIO14','GPIO14','bidir'), p('GPIO15','GPIO15','bidir'), p('GPIO16','GPIO16','bidir'), p('GPIO17','GPIO17','bidir'), p('GPIO18','GPIO18','bidir'), p('GPIO19','GPIO19','bidir'), p('GPIO21','GPIO21','bidir'), p('GPIO22','GPIO22','bidir'), p('GPIO23','GPIO23','bidir'), p('GPIO25','GPIO25','bidir'), p('GPIO26','GPIO26','bidir'), p('GPIO27','GPIO27','bidir'), p('VIN','VIN','in'), p('TX0','TX0','out'), p('RX0','RX0','in')], position: {x:0,y:0} },
  { id: 'tpl_nano', type: 'Arduino Nano', name: 'Arduino Nano', value: 'ATmega328P', pins: [p('D0','D0/RX','bidir'), p('D1','D1/TX','bidir'), p('D2','D2','bidir'), p('D3','D3','bidir'), p('D4','D4','bidir'), p('D5','D5','bidir'), p('D6','D6','bidir'), p('D7','D7','bidir'), p('D8','D8','bidir'), p('D9','D9','bidir'), p('D10','D10','bidir'), p('D11','D11','bidir'), p('D12','D12','bidir'), p('D13','D13','bidir'), p('A0','A0','in'), p('A1','A1','in'), p('A2','A2','in'), p('A3','A3','in'), p('A4','A4/SDA','bidir'), p('A5','A5/SCL','bidir'), p('VIN','VIN','in'), p('5V','5V','out'), p('3V3','3V3','out'), p('GND','GND','bidir')], position: {x:0,y:0} },
  { id: 'tpl_vl53l0x', type: 'VL53L0X', name: 'VL53L0X ToF Sensor', value: 'VL53L0X', pins: [p('VIN','VIN','in'), p('GND','GND','bidir'), p('SDA','SDA','bidir'), p('SCL','SCL','bidir')], position: {x:0,y:0} },
  { id: 'tpl_hcsr04', type: 'HC-SR04', name: 'HC-SR04 Ultrasonic', value: 'HC-SR04', pins: [p('VCC','VCC','in'), p('TRIG','TRIG','in'), p('ECHO','ECHO','out'), p('GND','GND','bidir')], position: {x:0,y:0} },
  { id: 'tpl_rcwl', type: 'RCWL-0516', name: 'RCWL-0516 Microwave', value: 'RCWL-0516', pins: [p('VIN','VIN','in'), p('OUT','OUT','out'), p('GND','GND','bidir')], position: {x:0,y:0} },
  { id: 'tpl_lm7805', type: 'LM7805', name: 'LM7805 Regulator', value: 'LM7805', pins: [p('IN','IN','in'), p('GND','GND','bidir'), p('OUT','OUT','out')], position: {x:0,y:0} },
  { id: 'tpl_ams1117', type: 'AMS1117-3.3', name: 'AMS1117-3.3 Regulator', value: 'AMS1117-3.3', pins: [p('IN','IN','in'), p('GND','GND','bidir'), p('OUT','OUT','out')], position: {x:0,y:0} },
  { id: 'tpl_relay', type: 'Relay Module', name: 'Relay Module', value: 'G5LE-1', pins: [p('VCC','VCC','in'), p('GND','GND','bidir'), p('IN','IN','in'), p('COM','COM','bidir'), p('NO','NO','out'), p('NC','NC','out')], position: {x:0,y:0} },
  { id: 'tpl_usbc', type: 'USB-C', name: 'USB-C Connector', value: 'USB-C', pins: [p('VBUS','VBUS','out'), p('D+','D+','bidir'), p('D-','D-','bidir'), p('GND','GND','bidir')], position: {x:0,y:0} },
];

export const usePCBStore = create<PCBStore>((set) => ({
  activePage: 'schematic',
  setActivePage: (page) => set({ activePage: page }),

  schematicSvg: '',
  setSchematicSvg: (svg) => set({ schematicSvg: svg }),

  schematicStats: { components: 0, nets: 0, sheets: 0 },
  setSchematicStats: (stats) => set({ schematicStats: stats }),

  syncResults: [],
  setSyncResults: (results) => set({ syncResults: results }),

  bomEntries: [],
  setBomEntries: (entries) => set({ bomEntries: entries }),

  diffResult: null,
  setDiffResult: (result) => set({ diffResult: result }),

  impactResults: [],
  setImpactResults: (results) => set({ impactResults: results }),

  builderComponents: [],
  setBuilderComponents: (components) => set({ builderComponents: components }),
  addBuilderComponent: (component) =>
    set((state) => ({ builderComponents: [...state.builderComponents, component] })),
  updateBuilderComponent: (id, updates) =>
    set((state) => ({
      builderComponents: state.builderComponents.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  removeBuilderComponent: (id) =>
    set((state) => ({
      builderComponents: state.builderComponents.filter((c) => c.id !== id),
      builderWires: state.builderWires.filter(
        (w) => w.from.component !== id && w.to.component !== id
      ),
    })),

  builderWires: [],
  setBuilderWires: (wires) => set({ builderWires: wires }),
  addBuilderWire: (wire) =>
    set((state) => ({ builderWires: [...state.builderWires, wire] })),
  removeBuilderWire: (id) =>
    set((state) => ({
      builderWires: state.builderWires.filter((w) => w.id !== id),
    })),

  builderLibrary: DEFAULT_COMPONENT_LIBRARY,
  setBuilderLibrary: (library) => set({ builderLibrary: library.length > 0 ? library : DEFAULT_COMPONENT_LIBRARY }),

  clearBuilder: () =>
    set({ builderComponents: [], builderWires: [] }),

  // PCB Layout state
  pcbDesign: null,
  setPcbDesign: (design) => set({ pcbDesign: design }),

  drcViolations: [],
  setDrcViolations: (violations) => set({ drcViolations: violations }),

  gerberFiles: [],
  setGerberFiles: (files) => set({ gerberFiles: files }),

  costEstimate: null,
  setCostEstimate: (estimate) => set({ costEstimate: estimate }),

  activePcbLayer: 'F.Cu',
  setActivePcbLayer: (layer) => set({ activePcbLayer: layer }),

  pcbTool: 'select',
  setPcbTool: (tool) => set({ pcbTool: tool }),
}));
