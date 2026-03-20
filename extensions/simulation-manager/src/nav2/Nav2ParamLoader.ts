// Copyright 2026 VirtusCo
// Loads and saves Nav2 parameter YAML files using simple manual parsing

import * as fs from 'fs';

export function loadParams(yamlPath: string): Record<string, unknown> {
  const content = fs.readFileSync(yamlPath, 'utf-8');
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  const keyStack: string[] = [];
  const indentStack: number[] = [-1];

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const indent = line.length - line.trimStart().length;
    const stripped = trimmed.trim();
    const colonIdx = stripped.indexOf(':');

    if (colonIdx === -1) {
      continue;
    }

    const key = stripped.substring(0, colonIdx).trim();
    const rawValue = stripped.substring(colonIdx + 1).trim();

    // Pop stack to correct indentation level
    while (indentStack.length > 1 && indent <= indentStack[indentStack.length - 1]) {
      indentStack.pop();
      keyStack.pop();
    }

    if (rawValue === '' || rawValue.startsWith('#')) {
      // Nested key — push onto stack
      keyStack.push(key);
      indentStack.push(indent);
    } else {
      // Leaf value
      const fullKey = [...keyStack, key].join('.');
      result[fullKey] = parseValue(rawValue);
    }
  }

  return result;
}

export function saveParams(yamlPath: string, params: Record<string, unknown>): void {
  const lines: string[] = [];
  const sortedKeys = Object.keys(params).sort();

  let prevParts: string[] = [];

  for (const key of sortedKeys) {
    const parts = key.split('.');
    let commonDepth = 0;

    while (
      commonDepth < prevParts.length &&
      commonDepth < parts.length &&
      prevParts[commonDepth] === parts[commonDepth]
    ) {
      commonDepth++;
    }

    for (let i = commonDepth; i < parts.length - 1; i++) {
      lines.push('  '.repeat(i) + parts[i] + ':');
    }

    const value = params[key];
    const valueStr = formatValue(value);
    const leafKey = parts[parts.length - 1];
    const depth = parts.length - 1;
    lines.push('  '.repeat(depth) + leafKey + ': ' + valueStr);

    prevParts = parts;
  }

  fs.writeFileSync(yamlPath, lines.join('\n') + '\n', 'utf-8');
}

function parseValue(raw: string): unknown {
  // Remove inline comments
  const commentIdx = raw.indexOf(' #');
  const value = commentIdx >= 0 ? raw.substring(0, commentIdx).trim() : raw;

  if (value === 'true' || value === 'True') return true;
  if (value === 'false' || value === 'False') return false;

  // Check for quoted strings
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Check for numbers
  const num = Number(value);
  if (!isNaN(num) && value !== '') return num;

  return value;
}

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}
