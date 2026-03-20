// Copyright 2026 VirtusCo

// --- KiCad Schematic Types ---

export interface KicadSchematic {
  version: number;
  wires: KicadWire[];
  symbols: KicadSymbol[];
  labels: KicadLabel[];
  junctions: { x: number; y: number }[];
}

export interface KicadSymbol {
  lib_id: string;
  reference: string;
  value: string;
  at: { x: number; y: number; angle: number };
  pins: { number: string; name: string; at: { x: number; y: number } }[];
}

export interface KicadWire {
  pts: { x: number; y: number }[];
}

export interface KicadLabel {
  text: string;
  at: { x: number; y: number };
}

// --- BOM Types ---

export interface BOMEntry {
  reference: string;
  value: string;
  footprint: string;
  lcsc_part: string;
  quantity: number;
  description: string;
}

// --- Sync Types ---

export type SyncStatus = 'ok' | 'mismatch' | 'missing';

export interface SyncResult {
  net_name: string;
  dts_alias: string;
  schematic_pin: string;
  dts_pin: string;
  status: SyncStatus;
}

// --- Diff Types ---

export interface SchematicDiff {
  nets_added: string[];
  nets_removed: string[];
  nets_renamed: { old_name: string; new_name: string }[];
  pins_moved: { reference: string; pin: string; from: { x: number; y: number }; to: { x: number; y: number } }[];
  components_added: { reference: string; value: string }[];
  components_removed: { reference: string; value: string }[];
}

// --- Firmware Impact Types ---

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface FirmwareImpact {
  change: string;
  files: { path: string; line: number; text: string }[];
  severity: Severity;
  description: string;
}

// --- Builder Types ---

export type PinDirection = 'in' | 'out' | 'bidir';

export interface BuilderPin {
  id: string;
  name: string;
  dir: PinDirection;
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

export interface BuilderSchematic {
  name: string;
  components: BuilderComponent[];
  wires: BuilderWire[];
}

// --- Message Types ---

// --- PCB Layout Types (for message passing) ---

export interface PCBDesignMsg {
  name: string;
  layers: string[];
  boardOutline: { points: { x: number; y: number }[]; width: number; height: number };
  footprints: unknown[];
  traces: unknown[];
  vias: unknown[];
  zones: unknown[];
  designRules: { minTraceWidth: number; minClearance: number; minViaDrill: number; minViaSize: number; minPadSize: number; copperLayers: number };
  netlist: Record<string, string[]>;
}

export interface DRCViolationMsg {
  type: string;
  severity: string;
  message: string;
  location: { x: number; y: number };
  items: string[];
}

export interface GerberFileMsg {
  layer: string;
  filename: string;
  content: string;
}

export interface CostEstimateMsg {
  pcbCost: number;
  componentCost: number;
  assemblyEstimate: number;
  totalPerUnit: number;
  quantity: number;
  breakdown: { item: string; unitCost: number; qty: number; total: number }[];
  manufacturer: string;
}

export type WebviewMessage =
  | { type: 'loadSchematic'; path: string }
  | { type: 'runSyncCheck'; schematicPath: string; overlayPath: string }
  | { type: 'exportBOM'; format: 'csv' }
  | { type: 'runDiff'; oldRef: string; newRef: string }
  | { type: 'openExternal'; url: string }
  | { type: 'openFile'; path: string; line?: number }
  | { type: 'createIssue'; title: string; body: string }
  | { type: 'exportKicad'; schematic: BuilderSchematic }
  | { type: 'saveVirtussch'; schematic: BuilderSchematic }
  | { type: 'requestLibrary' }
  | { type: 'openStudio' }
  // PCB Layout messages
  | { type: 'createPCB'; name: string; width: number; height: number; copperLayers: number }
  | { type: 'placePCBFootprint'; footprintName: string; reference: string; value: string; x: number; y: number; rotation: number; layer: string }
  | { type: 'addTrace'; net: string; layer: string; width: number; points: { x: number; y: number }[] }
  | { type: 'runDRC'; design?: PCBDesignMsg; designRules?: { minTraceWidth: number; minClearance: number; minViaDrill: number; minViaSize: number; minPadSize: number; copperLayers: number } }
  | { type: 'generateGerber'; design: PCBDesignMsg }
  | { type: 'estimateCost'; boardWidth: number; boardHeight: number; layers: number; quantity: number; manufacturer: string }
  | { type: 'exportNetlist'; format: 'kicad' | 'ipc356' }
  | { type: 'autoRoute'; design: PCBDesignMsg }
  | { type: 'exportGerberFiles'; files: GerberFileMsg[] }
  | { type: 'exportCostCSV'; csv: string }
  | { type: 'scrollToPCBLocation'; x: number; y: number };

export type HostMessage =
  | { type: 'schematic'; svg: string; stats: { components: number; nets: number; sheets: number } }
  | { type: 'syncResults'; results: SyncResult[] }
  | { type: 'bom'; entries: BOMEntry[] }
  | { type: 'diff'; result: SchematicDiff }
  | { type: 'impact'; results: FirmwareImpact[] }
  | { type: 'builderLibrary'; components: BuilderComponent[] }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string }
  // PCB Layout host messages
  | { type: 'drcResults'; violations: DRCViolationMsg[] }
  | { type: 'gerberGenerated'; gerbers: GerberFileMsg[]; drills: { filename: string; content: string }[] }
  | { type: 'costEstimate'; estimate: CostEstimateMsg }
  | { type: 'pcbDesignUpdate'; design: PCBDesignMsg }
  | { type: 'pcbFootprintPlaced'; reference: string; pads: { id: string; x: number; y: number; w: number; h: number; shape: string; net: string }[] }
  | { type: 'autoRouteResult'; traces: unknown[] };
