// Copyright 2026 VirtusCo

import { KicadSchematic, BOMEntry } from '../types';

/**
 * Extracts a Bill of Materials from a parsed KiCad schematic.
 * Groups components by value + footprint, sums quantities.
 * Returns BOMEntry[] sorted by reference.
 */
export function extractBOM(schematic: KicadSchematic): BOMEntry[] {
  const groupMap = new Map<string, BOMEntry>();

  for (const symbol of schematic.symbols) {
    // Skip power symbols and graphical items
    if (symbol.lib_id.startsWith('power:') || symbol.reference.startsWith('#')) {
      continue;
    }

    const footprint = extractFootprint(symbol.lib_id);
    const lcsc = extractLCSC(symbol.value, footprint);
    const description = generateDescription(symbol.lib_id, symbol.value);
    const groupKey = `${symbol.value}|${footprint}`;

    if (groupMap.has(groupKey)) {
      const existing = groupMap.get(groupKey)!;
      existing.quantity += 1;
      // Append reference
      existing.reference += `, ${symbol.reference}`;
    } else {
      groupMap.set(groupKey, {
        reference: symbol.reference,
        value: symbol.value,
        footprint,
        lcsc_part: lcsc,
        quantity: 1,
        description,
      });
    }
  }

  // Sort by reference designator
  return Array.from(groupMap.values()).sort((a, b) => {
    const aPrefix = a.reference.replace(/\d+/g, '');
    const bPrefix = b.reference.replace(/\d+/g, '');
    if (aPrefix !== bPrefix) {
      return aPrefix.localeCompare(bPrefix);
    }
    const aNum = parseInt(a.reference.replace(/\D+/g, ''), 10) || 0;
    const bNum = parseInt(b.reference.replace(/\D+/g, ''), 10) || 0;
    return aNum - bNum;
  });
}

function extractFootprint(libId: string): string {
  // Common footprint mappings based on lib_id patterns
  const footprintMap: Record<string, string> = {
    'Device:R': 'Resistor_SMD:R_0603_1608Metric',
    'Device:C': 'Capacitor_SMD:C_0603_1608Metric',
    'Device:D': 'Diode_SMD:D_SOD-123',
    'Device:LED': 'LED_SMD:LED_0603_1608Metric',
  };
  return footprintMap[libId] || '';
}

function extractLCSC(value: string, _footprint: string): string {
  // Common LCSC part number lookups
  const lcscMap: Record<string, string> = {
    '10k': 'C25804',
    '4.7k': 'C25905',
    '100nF': 'C14663',
    '10uF': 'C19702',
    '1uF': 'C15849',
  };
  return lcscMap[value] || '';
}

function generateDescription(libId: string, value: string): string {
  if (libId.includes(':R')) {
    return `Resistor ${value}`;
  }
  if (libId.includes(':C')) {
    return `Capacitor ${value}`;
  }
  if (libId.includes(':D')) {
    return `Diode ${value}`;
  }
  if (libId.includes(':LED')) {
    return `LED ${value}`;
  }
  return `${libId.split(':').pop() || ''} ${value}`.trim();
}

/**
 * Formats BOM entries as CSV string.
 */
export function formatBOMAsCSV(entries: BOMEntry[]): string {
  const header = 'Reference,Value,Footprint,Quantity,LCSC Part,Description';
  const rows = entries.map(
    (e) =>
      `"${e.reference}","${e.value}","${e.footprint}",${e.quantity},"${e.lcsc_part}","${e.description}"`
  );
  return [header, ...rows].join('\n');
}
