// Copyright 2026 VirtusCo
// Codegen orchestrator — FlowGraph → output files

import * as vscode from 'vscode';
import { FlowGraph, FlowNode } from '../types';
import { nodeRegistry } from './nodeRegistry';
import { renderDTS } from './dtsGen';
import { renderConfFlags, OptimizationProfile } from './confGen';
import { renderHeader, renderSource } from './codeGen';

export async function generateAll(
  graph: FlowGraph,
  workspaceRoot: vscode.Uri,
  optimization?: OptimizationProfile
): Promise<string[]> {
  const ordered = topologicalSort(graph);

  const dtsFragments: string[] = [];
  const dtsPeripheralBlocks: string[] = [];
  const confFlags: Set<string> = new Set();
  const headerLines: string[] = [];
  const initLines: string[] = [];
  const loopLines: string[] = [];
  const includes: Set<string> = new Set();

  for (const node of ordered) {
    const def = nodeRegistry[node.type];
    if (!def) continue;
    const cfg = node.data.config as Record<string, unknown>;

    if (def.codegen.dtsFragment) {
      const fragment = def.codegen.dtsFragment(cfg);
      if (fragment.trim()) {
        // Separate alias fragments from peripheral blocks
        if (fragment.includes('&')) {
          dtsPeripheralBlocks.push(fragment);
        } else {
          dtsFragments.push(fragment);
        }
      }
    }

    if (def.codegen.confFlags) {
      for (const flag of def.codegen.confFlags(cfg)) {
        confFlags.add(flag);
      }
    }

    if (def.codegen.headerCode) {
      const code = def.codegen.headerCode(cfg);
      if (code.trim()) headerLines.push(code);
    }

    if (def.codegen.initCode) {
      const code = def.codegen.initCode(cfg);
      if (code.trim()) initLines.push(code);
    }

    if (def.codegen.loopCode) {
      const code = def.codegen.loopCode(cfg);
      if (code.trim()) loopLines.push(code);
    }

    // Auto-detect required includes from category
    switch (def.category) {
      case 'peripheral':
        if (node.type.startsWith('gpio')) includes.add('#include <zephyr/drivers/gpio.h>');
        if (node.type.startsWith('pwm')) includes.add('#include <zephyr/drivers/pwm.h>');
        if (node.type.startsWith('uart')) includes.add('#include <zephyr/drivers/uart.h>');
        if (node.type.startsWith('i2c')) includes.add('#include <zephyr/drivers/i2c.h>');
        if (node.type.startsWith('spi')) includes.add('#include <zephyr/drivers/spi.h>');
        if (node.type.startsWith('adc')) includes.add('#include <zephyr/drivers/adc.h>');
        break;
      case 'composite':
        if (node.type.includes('motor') || node.type.includes('bts7960')) {
          includes.add('#include <zephyr/drivers/gpio.h>');
          includes.add('#include <zephyr/drivers/pwm.h>');
        }
        if (node.type.includes('tof') || node.type.includes('i2c')) {
          includes.add('#include <zephyr/drivers/i2c.h>');
        }
        if (node.type.includes('ultrasonic')) {
          includes.add('#include <zephyr/drivers/gpio.h>');
        }
        if (node.type.includes('uart') || node.type.includes('sensor_fusion')) {
          includes.add('#include <zephyr/drivers/uart.h>');
        }
        break;
    }
  }

  const files: [string, string][] = [
    ['boards/esp32.overlay', renderDTS(dtsFragments, dtsPeripheralBlocks)],
    ['prj.conf', renderConfFlags(confFlags, optimization ?? 'debug')],
    ['src/virtus_generated.h', renderHeader(headerLines, includes)],
    ['src/virtus_generated.c', renderSource(initLines, loopLines)],
  ];

  const writtenPaths: string[] = [];

  for (const [relativePath, content] of files) {
    const uri = vscode.Uri.joinPath(workspaceRoot, relativePath);

    // Ensure parent directory exists
    const parentUri = vscode.Uri.joinPath(
      workspaceRoot,
      relativePath.substring(0, relativePath.lastIndexOf('/'))
    );
    try {
      await vscode.workspace.fs.stat(parentUri);
    } catch {
      await vscode.workspace.fs.createDirectory(parentUri);
    }

    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    writtenPaths.push(relativePath);
  }

  return writtenPaths;
}

function topologicalSort(graph: FlowGraph): FlowNode[] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  }

  for (const edge of graph.edges) {
    const neighbors = adjList.get(edge.source);
    if (neighbors) neighbors.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: FlowNode[] = graph.nodes.filter(n => inDegree.get(n.id) === 0);
  const result: FlowNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighborId of adjList.get(node.id) ?? []) {
      const deg = (inDegree.get(neighborId) ?? 1) - 1;
      inDegree.set(neighborId, deg);
      if (deg === 0) {
        const neighbor = graph.nodes.find(n => n.id === neighborId);
        if (neighbor) queue.push(neighbor);
      }
    }
  }

  // Append any remaining nodes (disconnected) in original order
  for (const node of graph.nodes) {
    if (!result.find(n => n.id === node.id)) {
      result.push(node);
    }
  }

  return result;
}
