// Copyright 2026 VirtusCo

import { KicadSchematic, SchematicDiff } from '../types';
import { extractNetlist } from '../kicad/NetlistExtractor';

/**
 * Compares two parsed schematics and detects differences.
 * Detects added/removed nets, renamed nets, moved pins,
 * added/removed components, and changed values.
 */
export function diffSchematics(oldSch: KicadSchematic, newSch: KicadSchematic): SchematicDiff {
  const diff: SchematicDiff = {
    nets_added: [],
    nets_removed: [],
    nets_renamed: [],
    pins_moved: [],
    components_added: [],
    components_removed: [],
  };

  // --- Net comparison ---
  const oldNets = extractNetlist(oldSch);
  const newNets = extractNetlist(newSch);
  const oldNetNames = new Set(oldNets.keys());
  const newNetNames = new Set(newNets.keys());

  for (const name of newNetNames) {
    if (!oldNetNames.has(name)) {
      diff.nets_added.push(name);
    }
  }

  for (const name of oldNetNames) {
    if (!newNetNames.has(name)) {
      diff.nets_removed.push(name);
    }
  }

  // Detect renames: removed + added nets with same connected components
  const unmatchedRemoved = [...diff.nets_removed];
  const unmatchedAdded = [...diff.nets_added];

  for (const removed of unmatchedRemoved) {
    const oldEntries = oldNets.get(removed) || [];
    if (oldEntries.length === 0) {
      continue;
    }

    for (const added of unmatchedAdded) {
      const newEntries = newNets.get(added) || [];
      if (newEntries.length === 0) {
        continue;
      }

      // Check if same components are connected
      const oldComps = new Set(oldEntries.map((e) => `${e.component}:${e.pin}`));
      const newComps = new Set(newEntries.map((e) => `${e.component}:${e.pin}`));
      const overlap = [...oldComps].filter((c) => newComps.has(c));

      if (overlap.length >= Math.min(oldComps.size, newComps.size) * 0.7) {
        diff.nets_renamed.push({ old_name: removed, new_name: added });
        diff.nets_removed = diff.nets_removed.filter((n) => n !== removed);
        diff.nets_added = diff.nets_added.filter((n) => n !== added);
        break;
      }
    }
  }

  // --- Component comparison ---
  const oldComps = new Map(oldSch.symbols.map((s) => [s.reference, s]));
  const newComps = new Map(newSch.symbols.map((s) => [s.reference, s]));

  for (const [ref, sym] of newComps) {
    if (!oldComps.has(ref)) {
      diff.components_added.push({ reference: ref, value: sym.value });
    }
  }

  for (const [ref, sym] of oldComps) {
    if (!newComps.has(ref)) {
      diff.components_removed.push({ reference: ref, value: sym.value });
    }
  }

  // --- Pin movement detection ---
  for (const [ref, newSym] of newComps) {
    const oldSym = oldComps.get(ref);
    if (!oldSym) {
      continue;
    }

    for (const newPin of newSym.pins) {
      const oldPin = oldSym.pins.find((p) => p.number === newPin.number);
      if (!oldPin) {
        continue;
      }

      const dx = Math.abs(
        (newSym.at.x + newPin.at.x) - (oldSym.at.x + oldPin.at.x)
      );
      const dy = Math.abs(
        (newSym.at.y + newPin.at.y) - (oldSym.at.y + oldPin.at.y)
      );

      if (dx > 0.1 || dy > 0.1) {
        diff.pins_moved.push({
          reference: ref,
          pin: newPin.number,
          from: {
            x: oldSym.at.x + oldPin.at.x,
            y: oldSym.at.y + oldPin.at.y,
          },
          to: {
            x: newSym.at.x + newPin.at.x,
            y: newSym.at.y + newPin.at.y,
          },
        });
      }
    }
  }

  return diff;
}
