// Copyright 2026 VirtusCo

import { KicadSchematic } from '../types';

export interface NetEntry {
  component: string;
  pin: string;
  gpio_number: string;
}

/**
 * Extracts netlist from a parsed KiCad schematic.
 * Traces wires from net labels through junctions to component pins.
 * Returns a Map of net name -> connected pins.
 */
export function extractNetlist(schematic: KicadSchematic): Map<string, NetEntry[]> {
  const netMap = new Map<string, NetEntry[]>();

  // Build a point-to-net map from labels
  const pointToNet = new Map<string, string>();
  for (const label of schematic.labels) {
    const key = `${label.at.x},${label.at.y}`;
    pointToNet.set(key, label.text);
  }

  // Build adjacency from wires: every endpoint connects to the same wire
  const pointToPoints = new Map<string, Set<string>>();
  for (const wire of schematic.wires) {
    if (wire.pts.length < 2) {
      continue;
    }
    for (let i = 0; i < wire.pts.length - 1; i++) {
      const a = `${wire.pts[i].x},${wire.pts[i].y}`;
      const b = `${wire.pts[i + 1].x},${wire.pts[i + 1].y}`;
      if (!pointToPoints.has(a)) {
        pointToPoints.set(a, new Set());
      }
      if (!pointToPoints.has(b)) {
        pointToPoints.set(b, new Set());
      }
      pointToPoints.get(a)!.add(b);
      pointToPoints.get(b)!.add(a);
    }
  }

  // Add junction points as connections (junctions merge crossing wires)
  for (const junction of schematic.junctions) {
    const key = `${junction.x},${junction.y}`;
    if (!pointToPoints.has(key)) {
      pointToPoints.set(key, new Set());
    }
  }

  // Flood fill from each label to find connected points
  function floodFill(startKey: string): Set<string> {
    const visited = new Set<string>();
    const queue = [startKey];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const neighbors = pointToPoints.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }
    }
    return visited;
  }

  // For each label, trace connected points and find symbol pins at those points
  for (const label of schematic.labels) {
    const startKey = `${label.at.x},${label.at.y}`;
    const connectedPoints = floodFill(startKey);
    const netName = label.text;

    if (!netMap.has(netName)) {
      netMap.set(netName, []);
    }

    // Check which symbol pins are at any of the connected points
    for (const symbol of schematic.symbols) {
      for (const pin of symbol.pins) {
        // Pin positions are relative to symbol position
        const pinAbsX = symbol.at.x + pin.at.x;
        const pinAbsY = symbol.at.y + pin.at.y;
        const pinKey = `${pinAbsX},${pinAbsY}`;

        if (connectedPoints.has(pinKey)) {
          // Extract GPIO number from pin name (e.g., "GPIO21" -> "21")
          const gpioMatch = pin.name.match(/GPIO(\d+)/i);
          const gpioNumber = gpioMatch ? gpioMatch[1] : pin.number;

          netMap.get(netName)!.push({
            component: symbol.reference,
            pin: pin.number,
            gpio_number: gpioNumber,
          });
        }
      }
    }
  }

  return netMap;
}
