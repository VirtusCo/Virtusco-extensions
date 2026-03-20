// Copyright 2026 VirtusCo

export type Layer =
  | 'F.Cu' | 'B.Cu' | 'In1.Cu' | 'In2.Cu'
  | 'F.SilkS' | 'B.SilkS'
  | 'F.Mask' | 'B.Mask'
  | 'Edge.Cuts'
  | 'F.Paste' | 'B.Paste';

export interface Pad {
  id: string;
  type: 'thru_hole' | 'smd';
  shape: 'circle' | 'rect' | 'oval';
  position: { x: number; y: number };
  size: { w: number; h: number };
  drill?: number;
  layers: Layer[];
  net?: string;
}

export interface Footprint {
  id: string;
  name: string;
  component: string;
  pads: Pad[];
  silkscreen: { type: 'line' | 'rect' | 'circle'; x1: number; y1: number; x2?: number; y2?: number; r?: number }[];
  courtyard: { x: number; y: number; w: number; h: number };
}

export interface PlacedFootprint {
  id: string;
  footprintId: string;
  reference: string;
  value: string;
  position: { x: number; y: number };
  rotation: number;
  layer: 'F.Cu' | 'B.Cu';
  pads: PlacedPad[];
}

export interface PlacedPad {
  padId: string;
  position: { x: number; y: number };
  net: string;
}

export interface Trace {
  id: string;
  net: string;
  layer: Layer;
  width: number;
  points: { x: number; y: number }[];
}

export interface Via {
  id: string;
  net: string;
  position: { x: number; y: number };
  drill: number;
  size: number;
  layers: [Layer, Layer];
}

export interface Zone {
  id: string;
  net: string;
  layer: Layer;
  outline: { x: number; y: number }[];
  fillType: 'solid' | 'hatched';
}

export interface BoardOutline {
  points: { x: number; y: number }[];
  width: number;
  height: number;
}

export interface PCBDesign {
  name: string;
  layers: Layer[];
  boardOutline: BoardOutline;
  footprints: PlacedFootprint[];
  traces: Trace[];
  vias: Via[];
  zones: Zone[];
  designRules: DesignRules;
  netlist: Record<string, string[]>;
}

export interface DesignRules {
  minTraceWidth: number;
  minClearance: number;
  minViaDrill: number;
  minViaSize: number;
  minPadSize: number;
  copperLayers: number;
}

export interface DRCViolation {
  type: 'clearance' | 'width' | 'unconnected' | 'overlap' | 'courtyard';
  severity: 'error' | 'warning';
  message: string;
  location: { x: number; y: number };
  items: string[];
}

export interface GerberFile {
  layer: Layer;
  filename: string;
  content: string;
}

export interface DrillFile {
  filename: string;
  content: string;
}

export interface CostEstimate {
  pcbCost: number;
  componentCost: number;
  assemblyEstimate: number;
  totalPerUnit: number;
  quantity: number;
  breakdown: { item: string; unitCost: number; qty: number; total: number }[];
  manufacturer: string;
}
