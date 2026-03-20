// Copyright 2026 VirtusCo

import { PCBDesign, DRCViolation, PlacedFootprint, Trace, Via } from '../pcb/PCBTypes';
import { FOOTPRINT_LIBRARY } from '../pcb/FootprintLibrary';

export class DesignRuleChecker {
  check(design: PCBDesign): DRCViolation[] {
    return [
      ...this.checkTraceWidth(design),
      ...this.checkClearance(design),
      ...this.checkUnconnectedNets(design),
      ...this.checkCourtyardOverlap(design),
      ...this.checkViaRules(design),
      ...this.checkBoardEdge(design),
    ];
  }

  checkTraceWidth(design: PCBDesign): DRCViolation[] {
    const violations: DRCViolation[] = [];
    const minWidth = design.designRules.minTraceWidth;

    for (const trace of design.traces) {
      if (trace.width < minWidth) {
        const mid = trace.points[Math.floor(trace.points.length / 2)];
        violations.push({
          type: 'width',
          severity: 'error',
          message: `Trace width ${trace.width.toFixed(3)}mm is below minimum ${minWidth}mm`,
          location: { x: mid.x, y: mid.y },
          items: [trace.id],
        });
      }
    }

    return violations;
  }

  checkClearance(design: PCBDesign): DRCViolation[] {
    const violations: DRCViolation[] = [];
    const minClearance = design.designRules.minClearance;

    // Collect all pads with their positions and nets
    const allPads: { x: number; y: number; net: string; id: string; fpId: string; layer: string }[] = [];
    for (const fp of design.footprints) {
      for (const pad of fp.pads) {
        allPads.push({
          x: pad.position.x,
          y: pad.position.y,
          net: pad.net,
          id: `${fp.reference}.${pad.padId}`,
          fpId: fp.id,
          layer: fp.layer,
        });
      }
    }

    // Pad-to-pad clearance (different nets only)
    for (let i = 0; i < allPads.length; i++) {
      for (let j = i + 1; j < allPads.length; j++) {
        const a = allPads[i];
        const b = allPads[j];

        // Skip same net
        if (a.net && b.net && a.net === b.net) { continue; }
        // Skip pads on different layers unless both are through-hole
        if (a.layer !== b.layer) { continue; }

        const dist = this.distanceBetweenPoints(a, b);
        if (dist < minClearance) {
          violations.push({
            type: 'clearance',
            severity: 'error',
            message: `Pad ${a.id} to pad ${b.id}: ${dist.toFixed(3)}mm clearance (min ${minClearance}mm)`,
            location: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            items: [a.fpId, b.fpId],
          });
        }
      }
    }

    // Trace-to-trace clearance (different nets)
    for (let i = 0; i < design.traces.length; i++) {
      for (let j = i + 1; j < design.traces.length; j++) {
        const t1 = design.traces[i];
        const t2 = design.traces[j];

        if (t1.net && t2.net && t1.net === t2.net) { continue; }
        if (t1.layer !== t2.layer) { continue; }

        for (let a = 0; a < t1.points.length - 1; a++) {
          for (let b = 0; b < t2.points.length - 1; b++) {
            const seg1Start = t1.points[a];
            const seg1End = t1.points[a + 1];
            const seg2Start = t2.points[b];
            const seg2End = t2.points[b + 1];

            if (this.segmentsIntersect(seg1Start, seg1End, seg2Start, seg2End)) {
              violations.push({
                type: 'clearance',
                severity: 'error',
                message: `Traces on net "${t1.net}" and "${t2.net}" intersect on layer ${t1.layer}`,
                location: { x: seg1Start.x, y: seg1Start.y },
                items: [t1.id, t2.id],
              });
            } else {
              // Check minimum distance between segments
              const dist = this.segmentToSegmentDistance(seg1Start, seg1End, seg2Start, seg2End);
              const effectiveClearance = dist - (t1.width + t2.width) / 2;
              if (effectiveClearance < minClearance) {
                violations.push({
                  type: 'clearance',
                  severity: 'error',
                  message: `Trace-to-trace clearance ${effectiveClearance.toFixed(3)}mm below minimum ${minClearance}mm`,
                  location: { x: (seg1Start.x + seg2Start.x) / 2, y: (seg1Start.y + seg2Start.y) / 2 },
                  items: [t1.id, t2.id],
                });
              }
            }
          }
        }
      }
    }

    // Pad-to-trace clearance
    for (const pad of allPads) {
      for (const trace of design.traces) {
        if (pad.net && trace.net && pad.net === trace.net) { continue; }

        for (let i = 0; i < trace.points.length - 1; i++) {
          const dist = this.pointToSegmentDistance(pad, trace.points[i], trace.points[i + 1]);
          const effectiveClearance = dist - trace.width / 2;
          if (effectiveClearance < minClearance) {
            violations.push({
              type: 'clearance',
              severity: 'error',
              message: `Pad ${pad.id} to trace on net "${trace.net}": ${effectiveClearance.toFixed(3)}mm clearance`,
              location: { x: pad.x, y: pad.y },
              items: [pad.fpId, trace.id],
            });
            break;
          }
        }
      }
    }

    return violations;
  }

  checkUnconnectedNets(design: PCBDesign): DRCViolation[] {
    const violations: DRCViolation[] = [];

    // Group pads by net
    const netPads = new Map<string, { x: number; y: number; id: string }[]>();
    for (const fp of design.footprints) {
      for (const pad of fp.pads) {
        if (!pad.net) { continue; }
        if (!netPads.has(pad.net)) {
          netPads.set(pad.net, []);
        }
        netPads.get(pad.net)!.push({
          x: pad.position.x,
          y: pad.position.y,
          id: `${fp.reference}.${pad.padId}`,
        });
      }
    }

    // For each net with 2+ pads, check connectivity through traces and vias
    for (const [netName, pads] of netPads) {
      if (pads.length < 2) { continue; }

      // Build connectivity graph using union-find
      const parent = new Map<number, number>();
      for (let i = 0; i < pads.length; i++) {
        parent.set(i, i);
      }

      const find = (x: number): number => {
        while (parent.get(x) !== x) {
          parent.set(x, parent.get(parent.get(x)!)!);
          x = parent.get(x)!;
        }
        return x;
      };
      const union = (a: number, b: number): void => {
        parent.set(find(a), find(b));
      };

      // Check traces for connections
      const tracesOnNet = design.traces.filter((t) => t.net === netName);
      const viasOnNet = design.vias.filter((v) => v.net === netName);
      const connectionPoints = [
        ...pads.map((p) => ({ x: p.x, y: p.y })),
      ];

      // Add trace endpoints and via positions as connectable
      for (const trace of tracesOnNet) {
        for (let i = 0; i < pads.length; i++) {
          for (const pt of trace.points) {
            if (this.distanceBetweenPoints(pads[i], pt) < 0.1) {
              // This pad is connected to the trace
              for (let j = 0; j < pads.length; j++) {
                if (i === j) { continue; }
                for (const pt2 of trace.points) {
                  if (this.distanceBetweenPoints(pads[j], pt2) < 0.1) {
                    union(i, j);
                  }
                }
              }
            }
          }
        }
      }

      // Check if all pads are in the same connected component
      const roots = new Set<number>();
      for (let i = 0; i < pads.length; i++) {
        roots.add(find(i));
      }

      if (roots.size > 1) {
        violations.push({
          type: 'unconnected',
          severity: 'error',
          message: `Net "${netName}" has ${roots.size} unconnected groups (${pads.length} pads)`,
          location: { x: pads[0].x, y: pads[0].y },
          items: pads.map((p) => p.id),
        });
      }
    }

    return violations;
  }

  checkCourtyardOverlap(design: PCBDesign): DRCViolation[] {
    const violations: DRCViolation[] = [];

    for (let i = 0; i < design.footprints.length; i++) {
      for (let j = i + 1; j < design.footprints.length; j++) {
        const fpA = design.footprints[i];
        const fpB = design.footprints[j];

        // Skip if on different layers (front/back)
        if (fpA.layer !== fpB.layer) { continue; }

        const defA = FOOTPRINT_LIBRARY.find((f) => f.id === fpA.footprintId);
        const defB = FOOTPRINT_LIBRARY.find((f) => f.id === fpB.footprintId);
        if (!defA || !defB) { continue; }

        const cyA = {
          x: fpA.position.x + defA.courtyard.x,
          y: fpA.position.y + defA.courtyard.y,
          w: defA.courtyard.w,
          h: defA.courtyard.h,
        };
        const cyB = {
          x: fpB.position.x + defB.courtyard.x,
          y: fpB.position.y + defB.courtyard.y,
          w: defB.courtyard.w,
          h: defB.courtyard.h,
        };

        // AABB overlap test
        if (
          cyA.x < cyB.x + cyB.w &&
          cyA.x + cyA.w > cyB.x &&
          cyA.y < cyB.y + cyB.h &&
          cyA.y + cyA.h > cyB.y
        ) {
          violations.push({
            type: 'courtyard',
            severity: 'warning',
            message: `Courtyard overlap: ${fpA.reference} and ${fpB.reference}`,
            location: {
              x: (fpA.position.x + fpB.position.x) / 2,
              y: (fpA.position.y + fpB.position.y) / 2,
            },
            items: [fpA.id, fpB.id],
          });
        }
      }
    }

    return violations;
  }

  checkViaRules(design: PCBDesign): DRCViolation[] {
    const violations: DRCViolation[] = [];
    const rules = design.designRules;

    for (const via of design.vias) {
      if (via.drill < rules.minViaDrill) {
        violations.push({
          type: 'width',
          severity: 'error',
          message: `Via drill ${via.drill.toFixed(3)}mm below minimum ${rules.minViaDrill}mm`,
          location: { x: via.position.x, y: via.position.y },
          items: [via.id],
        });
      }
      if (via.size < rules.minViaSize) {
        violations.push({
          type: 'width',
          severity: 'error',
          message: `Via size ${via.size.toFixed(3)}mm below minimum ${rules.minViaSize}mm`,
          location: { x: via.position.x, y: via.position.y },
          items: [via.id],
        });
      }
    }

    return violations;
  }

  checkBoardEdge(design: PCBDesign): DRCViolation[] {
    const violations: DRCViolation[] = [];
    const outline = design.boardOutline.points;

    if (outline.length < 3) { return violations; }

    for (const fp of design.footprints) {
      if (!this.pointInPolygon(fp.position, outline)) {
        violations.push({
          type: 'overlap',
          severity: 'error',
          message: `Footprint ${fp.reference} is outside board outline`,
          location: { x: fp.position.x, y: fp.position.y },
          items: [fp.id],
        });
      }
    }

    for (const via of design.vias) {
      if (!this.pointInPolygon(via.position, outline)) {
        violations.push({
          type: 'overlap',
          severity: 'error',
          message: `Via on net "${via.net}" is outside board outline`,
          location: { x: via.position.x, y: via.position.y },
          items: [via.id],
        });
      }
    }

    return violations;
  }

  distanceBetweenPoints(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  pointToSegmentDistance(
    point: { x: number; y: number },
    segStart: { x: number; y: number },
    segEnd: { x: number; y: number },
  ): number {
    const dx = segEnd.x - segStart.x;
    const dy = segEnd.y - segStart.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      return this.distanceBetweenPoints(point, segStart);
    }

    let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const proj = {
      x: segStart.x + t * dx,
      y: segStart.y + t * dy,
    };

    return this.distanceBetweenPoints(point, proj);
  }

  segmentsIntersect(
    a1: { x: number; y: number },
    a2: { x: number; y: number },
    b1: { x: number; y: number },
    b2: { x: number; y: number },
  ): boolean {
    const d1 = this.cross(b1, b2, a1);
    const d2 = this.cross(b1, b2, a2);
    const d3 = this.cross(a1, a2, b1);
    const d4 = this.cross(a1, a2, b2);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }

    if (d1 === 0 && this.onSegment(b1, b2, a1)) { return true; }
    if (d2 === 0 && this.onSegment(b1, b2, a2)) { return true; }
    if (d3 === 0 && this.onSegment(a1, a2, b1)) { return true; }
    if (d4 === 0 && this.onSegment(a1, a2, b2)) { return true; }

    return false;
  }

  pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  private cross(
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  private onSegment(
    p: { x: number; y: number },
    q: { x: number; y: number },
    r: { x: number; y: number },
  ): boolean {
    return (
      r.x <= Math.max(p.x, q.x) && r.x >= Math.min(p.x, q.x) &&
      r.y <= Math.max(p.y, q.y) && r.y >= Math.min(p.y, q.y)
    );
  }

  private segmentToSegmentDistance(
    a1: { x: number; y: number },
    a2: { x: number; y: number },
    b1: { x: number; y: number },
    b2: { x: number; y: number },
  ): number {
    return Math.min(
      this.pointToSegmentDistance(a1, b1, b2),
      this.pointToSegmentDistance(a2, b1, b2),
      this.pointToSegmentDistance(b1, a1, a2),
      this.pointToSegmentDistance(b2, a1, a2),
    );
  }
}
