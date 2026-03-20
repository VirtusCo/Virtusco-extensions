// Copyright 2026 VirtusCo

import { PCBDesign, CostEstimate } from '../pcb/PCBTypes';
import { BOMEntry } from '../types';
import { FOOTPRINT_LIBRARY } from '../pcb/FootprintLibrary';

// Approximate component pricing by type
const COMPONENT_PRICES: Record<string, number> = {
  'Resistor': 0.01,
  'Capacitor': 0.01,
  '0402': 0.01,
  '0603': 0.01,
  '0805': 0.01,
  '1206': 0.02,
  '1210': 0.03,
  '2512': 0.05,
  'Axial': 0.02,
  'Radial': 0.05,
  'Diode': 0.05,
  'LED': 0.05,
  'SOT-23': 0.10,
  'SOT-223': 0.15,
  'SOIC-8': 0.25,
  'SOIC-16': 0.40,
  'QFP-32': 0.60,
  'QFN-24': 0.55,
  'DIP-8': 0.20,
  'DIP-14': 0.30,
  'DIP-16': 0.35,
  'DIP-28': 0.50,
  'TO-220-3': 0.30,
  'TO-220-5': 3.00,
  'SIP-3': 0.30,
  'LM7805': 0.30,
  'AMS1117-3.3': 0.25,
  'BTS7960': 3.00,
  'ESP32-WROOM-32': 4.00,
  'Arduino-Nano': 3.50,
  'Relay-SPDT-5pin': 1.50,
  'HC-SR04-4pin': 1.20,
  'VL53L0X-module': 2.50,
  'USB-C': 0.80,
  'JST-XH-2': 0.15,
  'JST-XH-3': 0.18,
  'JST-XH-4': 0.20,
  'JST-XH-5': 0.22,
  'Pin-Header-1x2': 0.05,
  'Pin-Header-1x3': 0.06,
  'Pin-Header-1x4': 0.07,
  'Pin-Header-1x5': 0.08,
  'Pin-Header-1x6': 0.09,
  'Pin-Header-1x7': 0.10,
  'Pin-Header-1x8': 0.11,
  'Pin-Header-1x9': 0.12,
  'Pin-Header-1x10': 0.13,
  'Pin-Header-2x5': 0.15,
  'Barrel-Jack': 0.35,
};

// JLCPCB quantity pricing tiers (approximate USD)
const QUANTITY_PRICES: [number, number][] = [
  [5, 2.00],
  [10, 5.00],
  [20, 8.00],
  [30, 10.00],
  [50, 15.00],
  [100, 25.00],
  [200, 45.00],
  [500, 100.00],
];

export class CostEstimator {
  estimatePCBCost(design: PCBDesign, quantity: number): CostEstimate {
    const boardArea = design.boardOutline.width * design.boardOutline.height; // mm^2
    const boardAreaCm2 = boardArea / 100;

    // Base PCB cost (JLCPCB model)
    let baseCost = this.getQuantityPrice(quantity);

    // Area multiplier: $0.03/cm^2 above 100cm^2
    if (boardAreaCm2 > 100) {
      baseCost += (boardAreaCm2 - 100) * 0.03 * (quantity / 5);
    }

    // Layer multiplier
    const layerMultiplier = design.designRules.copperLayers === 4 ? 3.0 : 1.0;
    const pcbCost = baseCost * layerMultiplier;

    // Component cost from placed footprints
    const componentBreakdown = this.estimateComponentCostFromDesign(design);
    const componentCost = componentBreakdown.reduce((sum, item) => sum + item.total, 0);

    // Assembly estimate
    const totalJoints = this.countSolderJoints(design);
    const assemblyEstimate = this.estimateAssembly(totalJoints);

    const totalPerUnit = (pcbCost / quantity) + componentCost + assemblyEstimate;

    return {
      pcbCost: Math.round(pcbCost * 100) / 100,
      componentCost: Math.round(componentCost * 100) / 100,
      assemblyEstimate: Math.round(assemblyEstimate * 100) / 100,
      totalPerUnit: Math.round(totalPerUnit * 100) / 100,
      quantity,
      breakdown: [
        { item: `PCB (${design.boardOutline.width}x${design.boardOutline.height}mm, ${design.designRules.copperLayers}L)`, unitCost: Math.round((pcbCost / quantity) * 100) / 100, qty: quantity, total: Math.round(pcbCost * 100) / 100 },
        ...componentBreakdown,
        { item: 'SMT Assembly', unitCost: Math.round(assemblyEstimate * 100) / 100, qty: 1, total: Math.round(assemblyEstimate * 100) / 100 },
      ],
      manufacturer: 'JLCPCB',
    };
  }

  estimateComponentCost(bom: BOMEntry[]): { item: string; unitCost: number; qty: number; total: number }[] {
    const breakdown: { item: string; unitCost: number; qty: number; total: number }[] = [];

    for (const entry of bom) {
      let price = 0.10; // default fallback

      // Try to find price by footprint name
      if (COMPONENT_PRICES[entry.footprint]) {
        price = COMPONENT_PRICES[entry.footprint];
      }
      // Try by value/description
      for (const [key, val] of Object.entries(COMPONENT_PRICES)) {
        if (entry.value.toLowerCase().includes(key.toLowerCase()) ||
            entry.description.toLowerCase().includes(key.toLowerCase())) {
          price = val;
          break;
        }
      }

      breakdown.push({
        item: `${entry.reference} (${entry.value})`,
        unitCost: price,
        qty: entry.quantity,
        total: Math.round(price * entry.quantity * 100) / 100,
      });
    }

    return breakdown;
  }

  estimateAssembly(jointCount: number): number {
    // JLCPCB SMT assembly: $8 setup + $0.02/joint
    return 8.00 + jointCount * 0.02;
  }

  private estimateComponentCostFromDesign(design: PCBDesign): { item: string; unitCost: number; qty: number; total: number }[] {
    const breakdown: { item: string; unitCost: number; qty: number; total: number }[] = [];

    for (const fp of design.footprints) {
      const fpDef = FOOTPRINT_LIBRARY.find((f) => f.id === fp.footprintId);
      const fpName = fpDef?.name || fp.footprintId;

      let price = COMPONENT_PRICES[fpName] || COMPONENT_PRICES[fp.value] || 0.10;

      breakdown.push({
        item: `${fp.reference} (${fp.value})`,
        unitCost: price,
        qty: 1,
        total: price,
      });
    }

    return breakdown;
  }

  private getQuantityPrice(quantity: number): number {
    for (let i = QUANTITY_PRICES.length - 1; i >= 0; i--) {
      if (quantity >= QUANTITY_PRICES[i][0]) {
        return QUANTITY_PRICES[i][1];
      }
    }
    return QUANTITY_PRICES[0][1];
  }

  private countSolderJoints(design: PCBDesign): number {
    let joints = 0;
    for (const fp of design.footprints) {
      joints += fp.pads.length;
    }
    return joints;
  }
}
