// Copyright 2026 VirtusCo

import * as fs from 'fs';
import * as path from 'path';
import { SchematicDiff, FirmwareImpact, Severity } from '../types';

const FIRMWARE_EXTENSIONS = ['.c', '.h', '.overlay', '.dts', '.conf', '.cmake'];

/**
 * Analyzes the firmware impact of schematic changes.
 * For each pin change/net rename, searches firmware directories for references.
 */
export function analyze(diff: SchematicDiff, workspaceRoot: string): FirmwareImpact[] {
  const impacts: FirmwareImpact[] = [];
  const firmwareDirs = findFirmwareDirs(workspaceRoot);

  // Net removals — HIGH severity (firmware may reference removed nets)
  for (const netName of diff.nets_removed) {
    const files = searchFiles(firmwareDirs, netName);
    if (files.length > 0) {
      impacts.push({
        change: `Net "${netName}" removed from schematic`,
        files,
        severity: 'HIGH',
        description: `Removed net "${netName}" is referenced in firmware code. GPIO assignments and signal routing must be updated.`,
      });
    }
  }

  // Net renames — MEDIUM severity (firmware references need updating)
  for (const rename of diff.nets_renamed) {
    const files = searchFiles(firmwareDirs, rename.old_name);
    if (files.length > 0) {
      impacts.push({
        change: `Net renamed: "${rename.old_name}" -> "${rename.new_name}"`,
        files,
        severity: 'MEDIUM',
        description: `Net "${rename.old_name}" was renamed to "${rename.new_name}". Update all firmware references.`,
      });
    }
  }

  // Component removals — HIGH severity
  for (const comp of diff.components_removed) {
    const files = searchFiles(firmwareDirs, comp.reference);
    if (files.length > 0) {
      impacts.push({
        change: `Component ${comp.reference} (${comp.value}) removed`,
        files,
        severity: 'HIGH',
        description: `Removed component ${comp.reference} is referenced in firmware. Driver code and initialization must be removed.`,
      });
    }
  }

  // Pin movements — LOW severity (may indicate routing changes)
  for (const pinMove of diff.pins_moved) {
    const searchTerm = `${pinMove.reference}.*${pinMove.pin}`;
    const files = searchFiles(firmwareDirs, pinMove.reference);
    if (files.length > 0) {
      impacts.push({
        change: `Pin ${pinMove.pin} of ${pinMove.reference} moved`,
        files: files.filter((f) => f.text.includes(pinMove.pin)),
        severity: 'LOW',
        description: `Pin ${pinMove.pin} of ${pinMove.reference} was moved. Verify physical routing matches firmware expectations.`,
      });
    }
  }

  // New nets — LOW severity (informational)
  for (const netName of diff.nets_added) {
    impacts.push({
      change: `New net "${netName}" added to schematic`,
      files: [],
      severity: 'LOW',
      description: `New net "${netName}" added. Consider adding firmware support if this is a new signal.`,
    });
  }

  return impacts;
}

function findFirmwareDirs(workspaceRoot: string): string[] {
  const candidates = [
    path.join(workspaceRoot, 'esp32_firmware'),
    path.join(workspaceRoot, 'porter_robot', 'esp32_firmware'),
    path.join(workspaceRoot, 'firmware'),
    path.join(workspaceRoot, 'src'),
  ];
  return candidates.filter((d) => fs.existsSync(d));
}

function searchFiles(
  dirs: string[],
  searchTerm: string
): { path: string; line: number; text: string }[] {
  const results: { path: string; line: number; text: string }[] = [];

  for (const dir of dirs) {
    walkDir(dir, (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!FIRMWARE_EXTENSIONS.includes(ext)) {
        return;
      }

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          // Convert net name variants: MOTOR_L_RPWM -> motor-left-rpwm, motor_l_rpwm, etc.
          const searchLower = searchTerm.toLowerCase();
          const searchDash = searchTerm.replace(/_/g, '-').toLowerCase();
          const lineLower = lines[i].toLowerCase();

          if (
            lineLower.includes(searchLower) ||
            lineLower.includes(searchDash) ||
            lines[i].includes(searchTerm)
          ) {
            results.push({
              path: filePath,
              line: i + 1,
              text: lines[i].trim(),
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    });
  }

  return results;
}

function walkDir(dir: string, callback: (filePath: string) => void): void {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === '.git') {
          continue;
        }
        walkDir(fullPath, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  } catch {
    // Skip inaccessible directories
  }
}
