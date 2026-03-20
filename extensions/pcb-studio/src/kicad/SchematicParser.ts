// Copyright 2026 VirtusCo

import { KicadSchematic, KicadSymbol, KicadWire, KicadLabel } from '../types';

type SExpr = string | SExpr[];

/**
 * Tokenizes KiCad S-expression content into nested arrays.
 */
export function parseSExpr(content: string): SExpr {
  const tokens: string[] = [];
  let i = 0;
  const len = content.length;

  while (i < len) {
    const ch = content[i];
    if (ch === '(' || ch === ')') {
      tokens.push(ch);
      i++;
    } else if (ch === '"') {
      let str = '';
      i++; // skip opening quote
      while (i < len && content[i] !== '"') {
        if (content[i] === '\\' && i + 1 < len) {
          str += content[i + 1];
          i += 2;
        } else {
          str += content[i];
          i++;
        }
      }
      i++; // skip closing quote
      tokens.push(str);
    } else if (/\s/.test(ch)) {
      i++;
    } else {
      let atom = '';
      while (i < len && !/[\s()"]/.test(content[i])) {
        atom += content[i];
        i++;
      }
      tokens.push(atom);
    }
  }

  // Build nested structure
  const stack: SExpr[][] = [[]];

  for (const token of tokens) {
    if (token === '(') {
      const newList: SExpr[] = [];
      stack[stack.length - 1].push(newList);
      stack.push(newList);
    } else if (token === ')') {
      if (stack.length > 1) {
        stack.pop();
      }
    } else {
      stack[stack.length - 1].push(token);
    }
  }

  const root = stack[0];
  return root.length === 1 ? root[0] : root;
}

function findChildren(expr: SExpr[], tag: string): SExpr[][] {
  return expr.filter(
    (child): child is SExpr[] =>
      Array.isArray(child) && child.length > 0 && child[0] === tag
  );
}

function findChild(expr: SExpr[], tag: string): SExpr[] | undefined {
  return findChildren(expr, tag)[0];
}

function getStringProp(expr: SExpr[], tag: string): string {
  const child = findChild(expr, tag);
  if (child && child.length > 1 && typeof child[1] === 'string') {
    return child[1];
  }
  return '';
}

function getNumberProp(expr: SExpr[], tag: string, index: number = 1): number {
  const child = findChild(expr, tag);
  if (child && child.length > index && typeof child[index] === 'string') {
    return parseFloat(child[index]);
  }
  return 0;
}

function parseAt(expr: SExpr[]): { x: number; y: number; angle: number } {
  const atNode = findChild(expr, 'at');
  if (!atNode) {
    return { x: 0, y: 0, angle: 0 };
  }
  return {
    x: typeof atNode[1] === 'string' ? parseFloat(atNode[1]) : 0,
    y: typeof atNode[2] === 'string' ? parseFloat(atNode[2]) : 0,
    angle: atNode.length > 3 && typeof atNode[3] === 'string' ? parseFloat(atNode[3]) : 0,
  };
}

function parsePts(expr: SExpr[]): { x: number; y: number }[] {
  const ptsNode = findChild(expr, 'pts');
  if (!ptsNode) {
    return [];
  }
  return findChildren(ptsNode, 'xy').map((xy) => ({
    x: typeof xy[1] === 'string' ? parseFloat(xy[1]) : 0,
    y: typeof xy[2] === 'string' ? parseFloat(xy[2]) : 0,
  }));
}

function parseSymbol(expr: SExpr[]): KicadSymbol {
  const libId = getStringProp(expr, 'lib_id');
  const at = parseAt(expr);

  let reference = '';
  let value = '';
  const pins: { number: string; name: string; at: { x: number; y: number } }[] = [];

  // Properties
  for (const prop of findChildren(expr, 'property')) {
    const propName = typeof prop[1] === 'string' ? prop[1] : '';
    const propValue = typeof prop[2] === 'string' ? prop[2] : '';
    if (propName === 'Reference') {
      reference = propValue;
    } else if (propName === 'Value') {
      value = propValue;
    }
  }

  // Pins
  for (const pinNode of findChildren(expr, 'pin')) {
    const pinAt = parseAt(pinNode);
    const pinNumber = getStringProp(pinNode, 'number');
    const pinName = getStringProp(pinNode, 'name');
    pins.push({ number: pinNumber || '?', name: pinName || '', at: pinAt });
  }

  return { lib_id: libId, reference, value, at, pins };
}

/**
 * Parses a .kicad_sch file content into a structured KicadSchematic.
 * Handles KiCad 6+ format (version field check).
 */
export function parseKicadSch(content: string): KicadSchematic {
  const tree = parseSExpr(content);

  if (!Array.isArray(tree) || tree[0] !== 'kicad_sch') {
    throw new Error('Invalid KiCad schematic: root element is not kicad_sch');
  }

  const root = tree as SExpr[];
  const version = getNumberProp(root, 'version');

  if (version < 20211014) {
    console.warn('KiCad schematic version may be older than expected (pre-6.0)');
  }

  const wires: KicadWire[] = findChildren(root, 'wire').map((w) => ({
    pts: parsePts(w),
  }));

  const symbols: KicadSymbol[] = findChildren(root, 'symbol').map(parseSymbol);

  const labels: KicadLabel[] = [
    ...findChildren(root, 'label').map((l) => ({
      text: typeof l[1] === 'string' ? l[1] : '',
      at: parseAt(l),
    })),
    ...findChildren(root, 'global_label').map((l) => ({
      text: typeof l[1] === 'string' ? l[1] : '',
      at: parseAt(l),
    })),
  ];

  const junctions: { x: number; y: number }[] = findChildren(root, 'junction').map((j) => {
    const at = parseAt(j);
    return { x: at.x, y: at.y };
  });

  return { version, wires, symbols, labels, junctions };
}
