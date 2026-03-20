// Copyright 2026 VirtusCo

import { PCBDesign, GerberFile, DrillFile, Layer, Trace, Via, PlacedFootprint } from '../pcb/PCBTypes';
import { FOOTPRINT_LIBRARY } from '../pcb/FootprintLibrary';

export class GerberGenerator {
  generateAll(design: PCBDesign): { gerbers: GerberFile[]; drills: DrillFile[] } {
    const gerbers: GerberFile[] = [];

    // Copper layers
    for (const layer of design.layers) {
      if (layer.includes('Cu')) {
        gerbers.push(this.generateCopperLayer(design, layer));
      }
    }

    // Silkscreen
    if (design.layers.includes('F.SilkS')) {
      gerbers.push(this.generateSilkscreen(design, 'F.SilkS'));
    }
    if (design.layers.includes('B.SilkS')) {
      gerbers.push(this.generateSilkscreen(design, 'B.SilkS'));
    }

    // Solder mask
    if (design.layers.includes('F.Mask')) {
      gerbers.push(this.generateSolderMask(design, 'F.Mask'));
    }
    if (design.layers.includes('B.Mask')) {
      gerbers.push(this.generateSolderMask(design, 'B.Mask'));
    }

    // Paste
    if (design.layers.includes('F.Paste')) {
      gerbers.push(this.generatePaste(design, 'F.Paste'));
    }
    if (design.layers.includes('B.Paste')) {
      gerbers.push(this.generatePaste(design, 'B.Paste'));
    }

    // Board outline
    gerbers.push(this.generateBoardOutline(design));

    // Drill file
    const drills: DrillFile[] = [this.generateDrillFile(design)];

    return { gerbers, drills };
  }

  generateCopperLayer(design: PCBDesign, layer: Layer): GerberFile {
    const lines: string[] = [];

    // Header
    lines.push('%FSLAX36Y36*%');
    lines.push('%MOMM*%');
    lines.push(`%TF.FileFunction,Copper,L1,${layer}*%`);
    lines.push('%TF.GenerationSoftware,VirtusCo,VirtusPCBStudio,1.0*%');

    // Collect all unique apertures needed
    const apertures = new Map<string, number>();
    let apertureIdx = 10;

    // Trace width apertures
    const traceWidths = new Set<number>();
    for (const trace of design.traces) {
      if (trace.layer === layer) {
        traceWidths.add(trace.width);
      }
    }
    for (const w of traceWidths) {
      const key = `C,${w.toFixed(4)}`;
      if (!apertures.has(key)) {
        apertures.set(key, apertureIdx++);
        lines.push(`%ADD${apertures.get(key)}${key}*%`);
      }
    }

    // Pad apertures for footprints on this layer
    for (const fp of design.footprints) {
      const fpDef = FOOTPRINT_LIBRARY.find((f) => f.id === fp.footprintId);
      if (!fpDef) { continue; }

      for (const pad of fpDef.pads) {
        const onLayer = pad.layers.includes(layer) ||
          (pad.type === 'thru_hole' && (layer === 'F.Cu' || layer === 'B.Cu'));

        if (!onLayer) { continue; }

        let key: string;
        if (pad.shape === 'circle') {
          key = `C,${pad.size.w.toFixed(4)}`;
        } else if (pad.shape === 'oval') {
          key = `O,${pad.size.w.toFixed(4)}X${pad.size.h.toFixed(4)}`;
        } else {
          key = `R,${pad.size.w.toFixed(4)}X${pad.size.h.toFixed(4)}`;
        }

        if (!apertures.has(key)) {
          apertures.set(key, apertureIdx++);
          lines.push(`%ADD${apertures.get(key)}${key}*%`);
        }
      }
    }

    // Via aperture
    const viaSizes = new Set<number>();
    for (const via of design.vias) {
      if (via.layers[0] === layer || via.layers[1] === layer) {
        viaSizes.add(via.size);
      }
    }
    for (const s of viaSizes) {
      const key = `C,${s.toFixed(4)}`;
      if (!apertures.has(key)) {
        apertures.set(key, apertureIdx++);
        lines.push(`%ADD${apertures.get(key)}${key}*%`);
      }
    }

    lines.push('%LPD*%');

    // Draw pads
    for (const fp of design.footprints) {
      const fpDef = FOOTPRINT_LIBRARY.find((f) => f.id === fp.footprintId);
      if (!fpDef) { continue; }

      for (let i = 0; i < fpDef.pads.length; i++) {
        const padDef = fpDef.pads[i];
        const onLayer = padDef.layers.includes(layer) ||
          (padDef.type === 'thru_hole' && (layer === 'F.Cu' || layer === 'B.Cu'));
        if (!onLayer) { continue; }

        const placedPad = fp.pads[i];
        if (!placedPad) { continue; }

        let key: string;
        if (padDef.shape === 'circle') {
          key = `C,${padDef.size.w.toFixed(4)}`;
        } else if (padDef.shape === 'oval') {
          key = `O,${padDef.size.w.toFixed(4)}X${padDef.size.h.toFixed(4)}`;
        } else {
          key = `R,${padDef.size.w.toFixed(4)}X${padDef.size.h.toFixed(4)}`;
        }

        const apNum = apertures.get(key);
        if (apNum === undefined) { continue; }

        lines.push(`D${apNum}*`);
        lines.push(`X${this.mmToGerber(placedPad.position.x)}Y${this.mmToGerber(placedPad.position.y)}D03*`);
      }
    }

    // Draw traces
    for (const trace of design.traces) {
      if (trace.layer !== layer) { continue; }

      const key = `C,${trace.width.toFixed(4)}`;
      const apNum = apertures.get(key);
      if (apNum === undefined) { continue; }

      lines.push(`D${apNum}*`);

      for (let i = 0; i < trace.points.length; i++) {
        const pt = trace.points[i];
        const code = i === 0 ? 'D02' : 'D01';
        lines.push(`X${this.mmToGerber(pt.x)}Y${this.mmToGerber(pt.y)}${code}*`);
      }
    }

    // Draw vias
    for (const via of design.vias) {
      if (via.layers[0] !== layer && via.layers[1] !== layer) { continue; }

      const key = `C,${via.size.toFixed(4)}`;
      const apNum = apertures.get(key);
      if (apNum === undefined) { continue; }

      lines.push(`D${apNum}*`);
      lines.push(`X${this.mmToGerber(via.position.x)}Y${this.mmToGerber(via.position.y)}D03*`);
    }

    lines.push('M02*');

    const layerFilenames: Record<string, string> = {
      'F.Cu': 'F_Cu.gtl',
      'B.Cu': 'B_Cu.gbl',
      'In1.Cu': 'In1_Cu.g2',
      'In2.Cu': 'In2_Cu.g3',
    };

    return {
      layer,
      filename: layerFilenames[layer] || `${layer.replace('.', '_')}.gbr`,
      content: lines.join('\n'),
    };
  }

  generateSilkscreen(design: PCBDesign, layer: Layer): GerberFile {
    const lines: string[] = [];

    lines.push('%FSLAX36Y36*%');
    lines.push('%MOMM*%');
    lines.push(`%TF.FileFunction,Legend,${layer === 'F.SilkS' ? 'Top' : 'Bot'}*%`);

    // Silkscreen aperture (0.15mm line)
    lines.push('%ADD10C,0.1500*%');
    lines.push('%LPD*%');
    lines.push('D10*');

    const targetSide = layer === 'F.SilkS' ? 'F.Cu' : 'B.Cu';

    for (const fp of design.footprints) {
      if (fp.layer !== targetSide) { continue; }

      const fpDef = FOOTPRINT_LIBRARY.find((f) => f.id === fp.footprintId);
      if (!fpDef) { continue; }

      for (const silk of fpDef.silkscreen) {
        if (silk.type === 'rect' && silk.x2 !== undefined && silk.y2 !== undefined) {
          const x1 = fp.position.x + silk.x1;
          const y1 = fp.position.y + silk.y1;
          const x2 = fp.position.x + silk.x2;
          const y2 = fp.position.y + silk.y2;
          // Draw rectangle as 4 lines
          lines.push(`X${this.mmToGerber(x1)}Y${this.mmToGerber(y1)}D02*`);
          lines.push(`X${this.mmToGerber(x2)}Y${this.mmToGerber(y1)}D01*`);
          lines.push(`X${this.mmToGerber(x2)}Y${this.mmToGerber(y2)}D01*`);
          lines.push(`X${this.mmToGerber(x1)}Y${this.mmToGerber(y2)}D01*`);
          lines.push(`X${this.mmToGerber(x1)}Y${this.mmToGerber(y1)}D01*`);
        } else if (silk.type === 'line' && silk.x2 !== undefined && silk.y2 !== undefined) {
          const x1 = fp.position.x + silk.x1;
          const y1 = fp.position.y + silk.y1;
          const x2 = fp.position.x + silk.x2;
          const y2 = fp.position.y + silk.y2;
          lines.push(`X${this.mmToGerber(x1)}Y${this.mmToGerber(y1)}D02*`);
          lines.push(`X${this.mmToGerber(x2)}Y${this.mmToGerber(y2)}D01*`);
        } else if (silk.type === 'circle' && silk.r !== undefined) {
          // Approximate circle with 16-segment polygon
          const cx = fp.position.x + silk.x1;
          const cy = fp.position.y + silk.y1;
          const segments = 16;
          for (let i = 0; i <= segments; i++) {
            const angle = (i * 2 * Math.PI) / segments;
            const px = cx + silk.r * Math.cos(angle);
            const py = cy + silk.r * Math.sin(angle);
            const code = i === 0 ? 'D02' : 'D01';
            lines.push(`X${this.mmToGerber(px)}Y${this.mmToGerber(py)}${code}*`);
          }
        }
      }
    }

    lines.push('M02*');

    return {
      layer,
      filename: layer === 'F.SilkS' ? 'F_SilkS.gto' : 'B_SilkS.gbo',
      content: lines.join('\n'),
    };
  }

  generateSolderMask(design: PCBDesign, layer: Layer): GerberFile {
    const lines: string[] = [];

    lines.push('%FSLAX36Y36*%');
    lines.push('%MOMM*%');
    lines.push(`%TF.FileFunction,Soldermask,${layer === 'F.Mask' ? 'Top' : 'Bot'}*%`);

    const apertureMap = new Map<string, number>();
    let apIdx = 10;

    const targetSide = layer === 'F.Mask' ? 'F.Cu' : 'B.Cu';
    const expansion = 0.05; // mask expansion mm

    for (const fp of design.footprints) {
      const fpDef = FOOTPRINT_LIBRARY.find((f) => f.id === fp.footprintId);
      if (!fpDef) { continue; }

      for (let i = 0; i < fpDef.pads.length; i++) {
        const padDef = fpDef.pads[i];

        // Through-hole pads open on both mask layers; SMD only on matching side
        const isTH = padDef.type === 'thru_hole';
        if (!isTH && fp.layer !== targetSide) { continue; }

        const w = padDef.size.w + expansion * 2;
        const h = padDef.size.h + expansion * 2;
        let key: string;
        if (padDef.shape === 'circle') {
          key = `C,${w.toFixed(4)}`;
        } else if (padDef.shape === 'oval') {
          key = `O,${w.toFixed(4)}X${h.toFixed(4)}`;
        } else {
          key = `R,${w.toFixed(4)}X${h.toFixed(4)}`;
        }

        if (!apertureMap.has(key)) {
          apertureMap.set(key, apIdx);
          lines.push(`%ADD${apIdx}${key}*%`);
          apIdx++;
        }
      }
    }

    // Via mask openings
    for (const via of design.vias) {
      const s = via.size + expansion * 2;
      const key = `C,${s.toFixed(4)}`;
      if (!apertureMap.has(key)) {
        apertureMap.set(key, apIdx);
        lines.push(`%ADD${apIdx}${key}*%`);
        apIdx++;
      }
    }

    lines.push('%LPD*%');

    // Flash pad openings
    for (const fp of design.footprints) {
      const fpDef = FOOTPRINT_LIBRARY.find((f) => f.id === fp.footprintId);
      if (!fpDef) { continue; }

      for (let i = 0; i < fpDef.pads.length; i++) {
        const padDef = fpDef.pads[i];
        const isTH = padDef.type === 'thru_hole';
        if (!isTH && fp.layer !== targetSide) { continue; }

        const placedPad = fp.pads[i];
        if (!placedPad) { continue; }

        const w = padDef.size.w + expansion * 2;
        const h = padDef.size.h + expansion * 2;
        let key: string;
        if (padDef.shape === 'circle') {
          key = `C,${w.toFixed(4)}`;
        } else if (padDef.shape === 'oval') {
          key = `O,${w.toFixed(4)}X${h.toFixed(4)}`;
        } else {
          key = `R,${w.toFixed(4)}X${h.toFixed(4)}`;
        }

        const apNum = apertureMap.get(key);
        if (apNum === undefined) { continue; }

        lines.push(`D${apNum}*`);
        lines.push(`X${this.mmToGerber(placedPad.position.x)}Y${this.mmToGerber(placedPad.position.y)}D03*`);
      }
    }

    // Via mask openings
    for (const via of design.vias) {
      const s = via.size + expansion * 2;
      const key = `C,${s.toFixed(4)}`;
      const apNum = apertureMap.get(key);
      if (apNum === undefined) { continue; }

      lines.push(`D${apNum}*`);
      lines.push(`X${this.mmToGerber(via.position.x)}Y${this.mmToGerber(via.position.y)}D03*`);
    }

    lines.push('M02*');

    return {
      layer,
      filename: layer === 'F.Mask' ? 'F_Mask.gts' : 'B_Mask.gbs',
      content: lines.join('\n'),
    };
  }

  generatePaste(design: PCBDesign, layer: Layer): GerberFile {
    const lines: string[] = [];

    lines.push('%FSLAX36Y36*%');
    lines.push('%MOMM*%');
    lines.push(`%TF.FileFunction,Paste,${layer === 'F.Paste' ? 'Top' : 'Bot'}*%`);

    const targetSide = layer === 'F.Paste' ? 'F.Cu' : 'B.Cu';
    const apertureMap = new Map<string, number>();
    let apIdx = 10;

    // Only SMD pads get paste
    for (const fp of design.footprints) {
      if (fp.layer !== targetSide) { continue; }
      const fpDef = FOOTPRINT_LIBRARY.find((f) => f.id === fp.footprintId);
      if (!fpDef) { continue; }

      for (const padDef of fpDef.pads) {
        if (padDef.type !== 'smd') { continue; }

        let key: string;
        if (padDef.shape === 'circle') {
          key = `C,${padDef.size.w.toFixed(4)}`;
        } else {
          key = `R,${padDef.size.w.toFixed(4)}X${padDef.size.h.toFixed(4)}`;
        }

        if (!apertureMap.has(key)) {
          apertureMap.set(key, apIdx);
          lines.push(`%ADD${apIdx}${key}*%`);
          apIdx++;
        }
      }
    }

    lines.push('%LPD*%');

    for (const fp of design.footprints) {
      if (fp.layer !== targetSide) { continue; }
      const fpDef = FOOTPRINT_LIBRARY.find((f) => f.id === fp.footprintId);
      if (!fpDef) { continue; }

      for (let i = 0; i < fpDef.pads.length; i++) {
        const padDef = fpDef.pads[i];
        if (padDef.type !== 'smd') { continue; }

        const placedPad = fp.pads[i];
        if (!placedPad) { continue; }

        let key: string;
        if (padDef.shape === 'circle') {
          key = `C,${padDef.size.w.toFixed(4)}`;
        } else {
          key = `R,${padDef.size.w.toFixed(4)}X${padDef.size.h.toFixed(4)}`;
        }

        const apNum = apertureMap.get(key);
        if (apNum === undefined) { continue; }

        lines.push(`D${apNum}*`);
        lines.push(`X${this.mmToGerber(placedPad.position.x)}Y${this.mmToGerber(placedPad.position.y)}D03*`);
      }
    }

    lines.push('M02*');

    return {
      layer,
      filename: layer === 'F.Paste' ? 'F_Paste.gtp' : 'B_Paste.gbp',
      content: lines.join('\n'),
    };
  }

  generateBoardOutline(design: PCBDesign): GerberFile {
    const lines: string[] = [];

    lines.push('%FSLAX36Y36*%');
    lines.push('%MOMM*%');
    lines.push('%TF.FileFunction,Profile,NP*%');
    lines.push('%ADD10C,0.0500*%');
    lines.push('%LPD*%');
    lines.push('D10*');

    const outline = design.boardOutline.points;
    if (outline.length > 0) {
      lines.push(`X${this.mmToGerber(outline[0].x)}Y${this.mmToGerber(outline[0].y)}D02*`);
      for (let i = 1; i < outline.length; i++) {
        lines.push(`X${this.mmToGerber(outline[i].x)}Y${this.mmToGerber(outline[i].y)}D01*`);
      }
      // Close the polygon
      lines.push(`X${this.mmToGerber(outline[0].x)}Y${this.mmToGerber(outline[0].y)}D01*`);
    }

    lines.push('M02*');

    return {
      layer: 'Edge.Cuts',
      filename: 'Edge_Cuts.gm1',
      content: lines.join('\n'),
    };
  }

  generateDrillFile(design: PCBDesign): DrillFile {
    const lines: string[] = [];

    // Collect all drill holes
    interface DrillHole {
      x: number;
      y: number;
      diameter: number;
    }

    const holes: DrillHole[] = [];

    // Pad drills
    for (const fp of design.footprints) {
      const fpDef = FOOTPRINT_LIBRARY.find((f) => f.id === fp.footprintId);
      if (!fpDef) { continue; }

      for (let i = 0; i < fpDef.pads.length; i++) {
        const padDef = fpDef.pads[i];
        if (padDef.type !== 'thru_hole' || !padDef.drill) { continue; }

        const placedPad = fp.pads[i];
        if (!placedPad) { continue; }

        holes.push({
          x: placedPad.position.x,
          y: placedPad.position.y,
          diameter: padDef.drill,
        });
      }
    }

    // Via drills
    for (const via of design.vias) {
      holes.push({
        x: via.position.x,
        y: via.position.y,
        diameter: via.drill,
      });
    }

    // Group by diameter
    const byDiameter = new Map<number, DrillHole[]>();
    for (const hole of holes) {
      const d = Math.round(hole.diameter * 1000) / 1000; // round to 3 decimals
      if (!byDiameter.has(d)) {
        byDiameter.set(d, []);
      }
      byDiameter.get(d)!.push(hole);
    }

    // Excellon header
    lines.push('M48');
    lines.push('; Generated by Virtus PCB Studio');
    lines.push('METRIC,TZ');

    let toolNum = 1;
    const toolMap = new Map<number, number>();
    for (const [diameter] of byDiameter) {
      toolMap.set(diameter, toolNum);
      lines.push(`T${toolNum}C${diameter.toFixed(3)}`);
      toolNum++;
    }

    lines.push('%');

    // Drill commands
    for (const [diameter, drillHoles] of byDiameter) {
      const tNum = toolMap.get(diameter)!;
      lines.push(`T${tNum}`);
      for (const hole of drillHoles) {
        lines.push(`X${this.mmToGerber(hole.x)}Y${this.mmToGerber(hole.y)}`);
      }
    }

    lines.push('M30');

    return {
      filename: 'drill.drl',
      content: lines.join('\n'),
    };
  }

  mmToGerber(mm: number): number {
    return Math.round(mm * 1000000);
  }
}
