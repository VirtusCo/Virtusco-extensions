// Copyright 2026 VirtusCo

import { KicadSchematic } from '../types';

const SCALE = 1;
const SYMBOL_WIDTH = 40;
const SYMBOL_HEIGHT = 30;
const JUNCTION_RADIUS = 3;
const LABEL_FONT_SIZE = 10;
const PIN_FONT_SIZE = 8;

/**
 * Renders a parsed KicadSchematic to SVG string.
 * Pure string generation — no DOM dependency.
 */
export function renderToSVG(schematic: KicadSchematic, highlightNet?: string): string {
  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const wire of schematic.wires) {
    for (const pt of wire.pts) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
  }
  for (const sym of schematic.symbols) {
    minX = Math.min(minX, sym.at.x - SYMBOL_WIDTH / 2);
    minY = Math.min(minY, sym.at.y - SYMBOL_HEIGHT / 2);
    maxX = Math.max(maxX, sym.at.x + SYMBOL_WIDTH / 2);
    maxY = Math.max(maxY, sym.at.y + SYMBOL_HEIGHT / 2);
  }
  for (const label of schematic.labels) {
    minX = Math.min(minX, label.at.x);
    minY = Math.min(minY, label.at.y);
    maxX = Math.max(maxX, label.at.x + 60);
    maxY = Math.max(maxY, label.at.y);
  }

  if (!isFinite(minX)) {
    minX = 0; minY = 0; maxX = 200; maxY = 200;
  }

  const padding = 20;
  minX -= padding; minY -= padding; maxX += padding; maxY += padding;
  const width = (maxX - minX) * SCALE;
  const height = (maxY - minY) * SCALE;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width / SCALE} ${height / SCALE}" ` +
    `width="${width}" height="${height}" style="background: var(--vscode-editor-background, #1e1e1e);">`
  );

  // Defs
  parts.push('<defs>');
  parts.push('<style>');
  parts.push('.wire { stroke: #4fc3f7; stroke-width: 1.5; fill: none; }');
  parts.push('.wire-highlight { stroke: #ff9800; stroke-width: 2.5; fill: none; }');
  parts.push('.symbol-rect { fill: #2d2d30; stroke: #569cd6; stroke-width: 1; }');
  parts.push('.symbol-text { fill: #d4d4d4; font-family: monospace; }');
  parts.push('.pin-text { fill: #9cdcfe; font-family: monospace; }');
  parts.push('.label-text { fill: #ce9178; font-family: monospace; font-weight: bold; }');
  parts.push('.label-highlight { fill: #ff9800; font-family: monospace; font-weight: bold; }');
  parts.push('.junction { fill: #4fc3f7; }');
  parts.push('.junction-highlight { fill: #ff9800; }');
  parts.push('</style>');
  parts.push('</defs>');

  // Render wires
  for (const wire of schematic.wires) {
    if (wire.pts.length < 2) {
      continue;
    }
    const isHighlighted = highlightNet && isWireOnNet(wire, schematic, highlightNet);
    const cls = isHighlighted ? 'wire-highlight' : 'wire';
    const d = wire.pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
    parts.push(`<path class="${cls}" d="${d}" data-type="wire"/>`);
  }

  // Render symbols as rectangles with pin labels
  for (const sym of schematic.symbols) {
    const x = sym.at.x - SYMBOL_WIDTH / 2;
    const y = sym.at.y - SYMBOL_HEIGHT / 2;
    parts.push(
      `<rect class="symbol-rect" x="${x}" y="${y}" width="${SYMBOL_WIDTH}" height="${SYMBOL_HEIGHT}" rx="3" ` +
      `data-ref="${escapeXml(sym.reference)}" data-value="${escapeXml(sym.value)}"/>`
    );
    // Reference label above
    parts.push(
      `<text class="symbol-text" x="${sym.at.x}" y="${y - 4}" text-anchor="middle" ` +
      `font-size="${LABEL_FONT_SIZE}">${escapeXml(sym.reference)}</text>`
    );
    // Value label inside
    parts.push(
      `<text class="symbol-text" x="${sym.at.x}" y="${sym.at.y + 4}" text-anchor="middle" ` +
      `font-size="${PIN_FONT_SIZE}">${escapeXml(sym.value)}</text>`
    );
    // Pin stubs
    for (const pin of sym.pins) {
      const px = sym.at.x + pin.at.x;
      const py = sym.at.y + pin.at.y;
      parts.push(
        `<text class="pin-text" x="${px}" y="${py - 2}" text-anchor="middle" ` +
        `font-size="${PIN_FONT_SIZE - 2}">${escapeXml(pin.name || pin.number)}</text>`
      );
    }
  }

  // Render net labels
  for (const label of schematic.labels) {
    const isHighlighted = highlightNet && label.text === highlightNet;
    const cls = isHighlighted ? 'label-highlight' : 'label-text';
    parts.push(
      `<text class="${cls}" x="${label.at.x}" y="${label.at.y}" ` +
      `font-size="${LABEL_FONT_SIZE}" data-net="${escapeXml(label.text)}">${escapeXml(label.text)}</text>`
    );
  }

  // Render junctions as circles
  for (const junction of schematic.junctions) {
    const cls = 'junction';
    parts.push(
      `<circle class="${cls}" cx="${junction.x}" cy="${junction.y}" r="${JUNCTION_RADIUS}" ` +
      `data-type="junction"/>`
    );
  }

  parts.push('</svg>');
  return parts.join('\n');
}

function isWireOnNet(
  wire: { pts: { x: number; y: number }[] },
  schematic: KicadSchematic,
  netName: string
): boolean {
  for (const label of schematic.labels) {
    if (label.text !== netName) {
      continue;
    }
    for (const pt of wire.pts) {
      if (Math.abs(pt.x - label.at.x) < 1 && Math.abs(pt.y - label.at.y) < 1) {
        return true;
      }
    }
  }
  return false;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
