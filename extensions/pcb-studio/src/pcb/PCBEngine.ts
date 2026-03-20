// Copyright 2026 VirtusCo

import {
  PCBDesign,
  PlacedFootprint,
  PlacedPad,
  Trace,
  Via,
  Zone,
  Layer,
  DesignRules,
  BoardOutline,
  Footprint,
} from './PCBTypes';
import { getFootprintByName, FOOTPRINT_LIBRARY } from './FootprintLibrary';

let nextId = 1;
function uid(prefix: string): string {
  return `${prefix}_${nextId++}`;
}

function rotatePt(x: number, y: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

export class PCBEngine {
  private design: PCBDesign;

  constructor() {
    this.design = this.createDesign('Untitled', 100, 100, 2);
  }

  createDesign(name: string, widthMm: number, heightMm: number, copperLayers: number): PCBDesign {
    const layers: Layer[] = ['F.Cu', 'B.Cu', 'F.SilkS', 'B.SilkS', 'F.Mask', 'B.Mask', 'Edge.Cuts', 'F.Paste', 'B.Paste'];
    if (copperLayers === 4) {
      layers.splice(2, 0, 'In1.Cu', 'In2.Cu');
    }

    const boardOutline: BoardOutline = {
      points: [
        { x: 0, y: 0 },
        { x: widthMm, y: 0 },
        { x: widthMm, y: heightMm },
        { x: 0, y: heightMm },
      ],
      width: widthMm,
      height: heightMm,
    };

    this.design = {
      name,
      layers,
      boardOutline,
      footprints: [],
      traces: [],
      vias: [],
      zones: [],
      designRules: {
        minTraceWidth: 0.2,
        minClearance: 0.2,
        minViaDrill: 0.3,
        minViaSize: 0.6,
        minPadSize: 0.5,
        copperLayers,
      },
      netlist: {},
    };

    return this.design;
  }

  placeFootprint(
    footprintName: string,
    reference: string,
    value: string,
    x: number,
    y: number,
    rotation: number,
    layer: 'F.Cu' | 'B.Cu',
  ): PlacedFootprint | undefined {
    const fp = getFootprintByName(footprintName);
    if (!fp) {
      return undefined;
    }
    return this.placeFootprintFromDef(fp, reference, value, x, y, rotation, layer);
  }

  placeFootprintFromDef(
    fp: Footprint,
    reference: string,
    value: string,
    x: number,
    y: number,
    rotation: number,
    layer: 'F.Cu' | 'B.Cu',
  ): PlacedFootprint {
    const placedPads: PlacedPad[] = fp.pads.map((p) => {
      const rotated = rotatePt(p.position.x, p.position.y, rotation);
      return {
        padId: p.id,
        position: { x: x + rotated.x, y: y + rotated.y },
        net: p.net || '',
      };
    });

    const placed: PlacedFootprint = {
      id: uid('fp'),
      footprintId: fp.id,
      reference,
      value,
      position: { x, y },
      rotation,
      layer,
      pads: placedPads,
    };

    this.design.footprints.push(placed);
    return placed;
  }

  moveFootprint(id: string, x: number, y: number): void {
    const fp = this.design.footprints.find((f) => f.id === id);
    if (!fp) { return; }

    const fpDef = FOOTPRINT_LIBRARY.find((f) => f.id === fp.footprintId);
    if (!fpDef) { return; }

    fp.position = { x, y };
    fp.pads = fpDef.pads.map((p) => {
      const rotated = rotatePt(p.position.x, p.position.y, fp.rotation);
      return {
        padId: p.id,
        position: { x: x + rotated.x, y: y + rotated.y },
        net: fp.pads.find((pp) => pp.padId === p.id)?.net || '',
      };
    });
  }

  rotateFootprint(id: string, degrees: number): void {
    const fp = this.design.footprints.find((f) => f.id === id);
    if (!fp) { return; }

    fp.rotation = (fp.rotation + degrees) % 360;

    const fpDef = FOOTPRINT_LIBRARY.find((f) => f.id === fp.footprintId);
    if (!fpDef) { return; }

    fp.pads = fpDef.pads.map((p) => {
      const rotated = rotatePt(p.position.x, p.position.y, fp.rotation);
      return {
        padId: p.id,
        position: { x: fp.position.x + rotated.x, y: fp.position.y + rotated.y },
        net: fp.pads.find((pp) => pp.padId === p.id)?.net || '',
      };
    });
  }

  flipFootprint(id: string): void {
    const fp = this.design.footprints.find((f) => f.id === id);
    if (!fp) { return; }
    fp.layer = fp.layer === 'F.Cu' ? 'B.Cu' : 'F.Cu';
  }

  removeFootprint(id: string): void {
    this.design.footprints = this.design.footprints.filter((f) => f.id !== id);
  }

  addTrace(net: string, layer: Layer, width: number, points: { x: number; y: number }[]): Trace {
    const trace: Trace = {
      id: uid('tr'),
      net,
      layer,
      width,
      points: [...points],
    };
    this.design.traces.push(trace);
    return trace;
  }

  removeTrace(id: string): void {
    this.design.traces = this.design.traces.filter((t) => t.id !== id);
  }

  addVia(
    net: string,
    x: number,
    y: number,
    drill: number,
    size: number,
    fromLayer: Layer,
    toLayer: Layer,
  ): Via {
    const via: Via = {
      id: uid('via'),
      net,
      position: { x, y },
      drill,
      size,
      layers: [fromLayer, toLayer],
    };
    this.design.vias.push(via);
    return via;
  }

  removeVia(id: string): void {
    this.design.vias = this.design.vias.filter((v) => v.id !== id);
  }

  addZone(net: string, layer: Layer, outline: { x: number; y: number }[]): Zone {
    const zone: Zone = {
      id: uid('zone'),
      net,
      layer,
      outline: [...outline],
      fillType: 'solid',
    };
    this.design.zones.push(zone);
    return zone;
  }

  removeZone(id: string): void {
    this.design.zones = this.design.zones.filter((z) => z.id !== id);
  }

  getDesign(): PCBDesign {
    return this.design;
  }

  setDesign(design: PCBDesign): void {
    this.design = design;
  }

  setDesignRules(rules: DesignRules): void {
    this.design.designRules = { ...rules };
  }

  importNetlist(netlist: Record<string, string[]>): void {
    this.design.netlist = { ...netlist };

    // Assign nets to pads based on pad references in the netlist
    for (const [netName, padRefs] of Object.entries(netlist)) {
      for (const padRef of padRefs) {
        // padRef format: "U1.1" (reference.padId)
        const dotIdx = padRef.lastIndexOf('.');
        if (dotIdx < 0) { continue; }
        const ref = padRef.substring(0, dotIdx);
        const padId = padRef.substring(dotIdx + 1);

        const fp = this.design.footprints.find((f) => f.reference === ref);
        if (fp) {
          const pad = fp.pads.find((p) => p.padId === padId);
          if (pad) {
            pad.net = netName;
          }
        }
      }
    }
  }

  autoRoute(net: string): Trace[] {
    const traces: Trace[] = [];
    const padsOnNet: { x: number; y: number }[] = [];

    for (const fp of this.design.footprints) {
      for (const p of fp.pads) {
        if (p.net === net) {
          padsOnNet.push({ ...p.position });
        }
      }
    }

    if (padsOnNet.length < 2) {
      return traces;
    }

    // Simple sequential Manhattan routing between pads
    for (let i = 0; i < padsOnNet.length - 1; i++) {
      const from = padsOnNet[i];
      const to = padsOnNet[i + 1];
      const midX = to.x;
      const midY = from.y;

      const points = [
        { x: from.x, y: from.y },
        { x: midX, y: midY },
        { x: to.x, y: to.y },
      ];

      const trace = this.addTrace(net, 'F.Cu', this.design.designRules.minTraceWidth, points);
      traces.push(trace);
    }

    return traces;
  }

  autoRouteAll(): Trace[] {
    const allTraces: Trace[] = [];
    const nets = new Set<string>();

    for (const fp of this.design.footprints) {
      for (const p of fp.pads) {
        if (p.net) {
          nets.add(p.net);
        }
      }
    }

    for (const net of nets) {
      const traces = this.autoRoute(net);
      allTraces.push(...traces);
    }

    return allTraces;
  }

  exportKicadPCB(): string {
    const lines: string[] = [];
    const d = this.design;

    lines.push('(kicad_pcb (version 20221018) (generator "virtus-pcb-studio")');
    lines.push('  (general)');
    lines.push('  (paper "A4")');
    lines.push('');

    // Layers
    lines.push('  (layers');
    let layerIdx = 0;
    for (const layer of d.layers) {
      const type = layer.includes('Cu') ? 'signal' : 'user';
      lines.push(`    (${layerIdx} "${layer}" ${type})`);
      layerIdx++;
    }
    lines.push('  )');
    lines.push('');

    // Setup / design rules
    lines.push('  (setup');
    lines.push('    (pad_to_mask_clearance 0.05)');
    lines.push(`    (min_trace_width ${d.designRules.minTraceWidth})`);
    lines.push(`    (min_clearance ${d.designRules.minClearance})`);
    lines.push(`    (min_via_drill ${d.designRules.minViaDrill})`);
    lines.push('  )');
    lines.push('');

    // Nets
    const allNets = new Set<string>();
    for (const fp of d.footprints) {
      for (const p of fp.pads) {
        if (p.net) { allNets.add(p.net); }
      }
    }
    lines.push('  (net 0 "")');
    let netIdx = 1;
    const netMap = new Map<string, number>();
    for (const net of allNets) {
      netMap.set(net, netIdx);
      lines.push(`  (net ${netIdx} "${net}")`);
      netIdx++;
    }
    lines.push('');

    // Board outline
    const outline = d.boardOutline.points;
    for (let i = 0; i < outline.length; i++) {
      const next = outline[(i + 1) % outline.length];
      lines.push(`  (gr_line (start ${outline[i].x} ${outline[i].y}) (end ${next.x} ${next.y}) (layer "Edge.Cuts") (width 0.05))`);
    }
    lines.push('');

    // Footprints
    for (const fp of d.footprints) {
      const fpDef = FOOTPRINT_LIBRARY.find((f) => f.id === fp.footprintId);
      lines.push(`  (footprint "${fpDef?.name || fp.footprintId}" (layer "${fp.layer}")`);
      lines.push(`    (at ${fp.position.x} ${fp.position.y} ${fp.rotation})`);
      lines.push(`    (property "Reference" "${fp.reference}" (at 0 -2) (layer "${fp.layer === 'F.Cu' ? 'F.SilkS' : 'B.SilkS'}"))`);
      lines.push(`    (property "Value" "${fp.value}" (at 0 2) (layer "${fp.layer === 'F.Cu' ? 'F.SilkS' : 'B.SilkS'}"))`);

      if (fpDef) {
        for (const p of fpDef.pads) {
          const netName = fp.pads.find((pp) => pp.padId === p.id)?.net || '';
          const netNum = netMap.get(netName) || 0;
          const drillStr = p.drill ? ` (drill ${p.drill})` : '';
          lines.push(`    (pad "${p.id}" ${p.type} ${p.shape} (at ${p.position.x} ${p.position.y}) (size ${p.size.w} ${p.size.h})${drillStr} (layers ${p.layers.map((l) => `"${l}"`).join(' ')}) (net ${netNum} "${netName}"))`);
        }
      }

      lines.push('  )');
    }
    lines.push('');

    // Traces (segments)
    for (const trace of d.traces) {
      for (let i = 0; i < trace.points.length - 1; i++) {
        const from = trace.points[i];
        const to = trace.points[i + 1];
        const netNum = netMap.get(trace.net) || 0;
        lines.push(`  (segment (start ${from.x} ${from.y}) (end ${to.x} ${to.y}) (width ${trace.width}) (layer "${trace.layer}") (net ${netNum}))`);
      }
    }

    // Vias
    for (const via of d.vias) {
      const netNum = netMap.get(via.net) || 0;
      lines.push(`  (via (at ${via.position.x} ${via.position.y}) (size ${via.size}) (drill ${via.drill}) (layers "${via.layers[0]}" "${via.layers[1]}") (net ${netNum}))`);
    }

    // Zones
    for (const zone of d.zones) {
      const netNum = netMap.get(zone.net) || 0;
      lines.push(`  (zone (net ${netNum}) (net_name "${zone.net}") (layer "${zone.layer}") (hatch ${zone.fillType === 'hatched' ? 'edge' : 'none'} 0.5)`);
      lines.push(`    (fill yes)`);
      lines.push(`    (polygon (pts`);
      for (const pt of zone.outline) {
        lines.push(`      (xy ${pt.x} ${pt.y})`);
      }
      lines.push('    ))');
      lines.push('  )');
    }

    lines.push(')');
    return lines.join('\n');
  }
}
