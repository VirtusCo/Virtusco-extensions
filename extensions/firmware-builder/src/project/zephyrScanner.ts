// Copyright 2026 VirtusCo
// Zephyr API Scanner — reads ZEPHYR_BASE/include/zephyr/drivers/*.h
// and extracts function signatures to generate dynamic nodes.
//
// This is the engine that turns "all Zephyr functions" into drag-and-drop nodes.
// It scans the user's installed Zephyr SDK and discovers available APIs.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// ── Types ────────────────────────────────────────────────────────────

export interface ZephyrFunction {
  name: string;           // e.g. "gpio_pin_configure"
  returnType: string;     // e.g. "int"
  params: ZephyrParam[];
  subsystem: string;      // e.g. "gpio"
  headerFile: string;     // e.g. "zephyr/drivers/gpio.h"
  brief?: string;         // extracted from comment above
}

export interface ZephyrParam {
  type: string;           // e.g. "const struct device *"
  name: string;           // e.g. "port"
}

export interface ZephyrSubsystem {
  name: string;           // e.g. "gpio"
  displayName: string;    // e.g. "GPIO"
  headerPath: string;     // absolute path to header
  functions: ZephyrFunction[];
  macros: string[];       // CONFIG_* flags needed
}

export interface ScannedAPI {
  zephyrVersion: string;
  subsystems: ZephyrSubsystem[];
  totalFunctions: number;
}

// ── Subsystem metadata (maps header filenames to display info) ────────

const SUBSYSTEM_META: Record<string, { displayName: string; color: string; icon: string; confFlags: string[] }> = {
  gpio:       { displayName: 'GPIO',          color: '#4fc3f7', icon: 'plug',        confFlags: ['CONFIG_GPIO=y'] },
  pwm:        { displayName: 'PWM',           color: '#4fc3f7', icon: 'activity',    confFlags: ['CONFIG_PWM=y'] },
  uart:       { displayName: 'UART',          color: '#4fc3f7', icon: 'cable',       confFlags: ['CONFIG_SERIAL=y'] },
  serial:     { displayName: 'Serial',        color: '#4fc3f7', icon: 'cable',       confFlags: ['CONFIG_SERIAL=y'] },
  i2c:        { displayName: 'I2C',           color: '#4fc3f7', icon: 'git-merge',   confFlags: ['CONFIG_I2C=y'] },
  spi:        { displayName: 'SPI',           color: '#4fc3f7', icon: 'layers',      confFlags: ['CONFIG_SPI=y'] },
  adc:        { displayName: 'ADC',           color: '#4fc3f7', icon: 'bar-chart-2', confFlags: ['CONFIG_ADC=y'] },
  dac:        { displayName: 'DAC',           color: '#4fc3f7', icon: 'bar-chart',   confFlags: ['CONFIG_DAC=y'] },
  sensor:     { displayName: 'Sensor',        color: '#ce93d8', icon: 'thermometer', confFlags: ['CONFIG_SENSOR=y'] },
  counter:    { displayName: 'Counter/Timer', color: '#81c784', icon: 'clock',       confFlags: ['CONFIG_COUNTER=y'] },
  watchdog:   { displayName: 'Watchdog',      color: '#ff8a65', icon: 'shield',      confFlags: ['CONFIG_WATCHDOG=y'] },
  flash:      { displayName: 'Flash',         color: '#ffb74d', icon: 'database',    confFlags: ['CONFIG_FLASH=y'] },
  display:    { displayName: 'Display',       color: '#ce93d8', icon: 'monitor',     confFlags: ['CONFIG_DISPLAY=y'] },
  led:        { displayName: 'LED',           color: '#4fc3f7', icon: 'lightbulb',   confFlags: ['CONFIG_LED=y'] },
  led_strip:  { displayName: 'LED Strip',     color: '#ce93d8', icon: 'lightbulb',   confFlags: ['CONFIG_LED_STRIP=y'] },
  can:        { displayName: 'CAN Bus',       color: '#4fc3f7', icon: 'git-branch',  confFlags: ['CONFIG_CAN=y'] },
  dma:        { displayName: 'DMA',           color: '#81c784', icon: 'arrow-right', confFlags: ['CONFIG_DMA=y'] },
  eeprom:     { displayName: 'EEPROM',        color: '#ffb74d', icon: 'save',        confFlags: ['CONFIG_EEPROM=y'] },
  entropy:    { displayName: 'Entropy (RNG)', color: '#81c784', icon: 'shuffle',     confFlags: ['CONFIG_ENTROPY_GENERATOR=y'] },
  rtc:        { displayName: 'RTC',           color: '#81c784', icon: 'calendar',    confFlags: ['CONFIG_RTC=y'] },
  regulator:  { displayName: 'Regulator',     color: '#ff8a65', icon: 'battery',     confFlags: ['CONFIG_REGULATOR=y'] },
  stepper:    { displayName: 'Stepper Motor', color: '#ce93d8', icon: 'settings',    confFlags: ['CONFIG_STEPPER=y'] },
  wifi:       { displayName: 'WiFi',          color: '#4fc3f7', icon: 'globe',       confFlags: ['CONFIG_WIFI=y'] },
  hwinfo:     { displayName: 'HW Info',       color: '#81c784', icon: 'info',        confFlags: ['CONFIG_HWINFO=y'] },
  pinctrl:    { displayName: 'Pin Control',   color: '#4fc3f7', icon: 'map-pin',     confFlags: ['CONFIG_PINCTRL=y'] },
  reset:      { displayName: 'Reset',         color: '#ff8a65', icon: 'refresh-cw',  confFlags: [] },
  i2s:        { displayName: 'I2S (Audio)',   color: '#ce93d8', icon: 'music',       confFlags: ['CONFIG_I2S=y'] },
  comparator: { displayName: 'Comparator',    color: '#4fc3f7', icon: 'git-compare', confFlags: ['CONFIG_COMPARATOR=y'] },
};

// Functions to skip (internal, static inline helpers, callbacks)
const SKIP_PATTERNS = [
  /^__/,                    // internal double-underscore
  /^z_/,                    // internal z_ prefix
  /^sys_/,                  // sys_ internals
  /_cb$/,                   // callback typedefs
  /^typedef/,               // skip typedefs caught by regex
  /_ISR$/,                  // ISR handlers
];

// ── Scanner ──────────────────────────────────────────────────────────

export async function scanZephyrAPIs(zephyrBase: string): Promise<ScannedAPI> {
  const driversDir = path.join(zephyrBase, 'include', 'zephyr', 'drivers');
  const subsystems: ZephyrSubsystem[] = [];
  let totalFunctions = 0;

  // Read Zephyr version
  let zephyrVersion = 'unknown';
  try {
    const versionFile = path.join(zephyrBase, 'VERSION');
    const versionContent = fs.readFileSync(versionFile, 'utf8');
    const major = versionContent.match(/VERSION_MAJOR\s*=\s*(\d+)/)?.[1] ?? '?';
    const minor = versionContent.match(/VERSION_MINOR\s*=\s*(\d+)/)?.[1] ?? '?';
    const patch = versionContent.match(/PATCHLEVEL\s*=\s*(\d+)/)?.[1] ?? '?';
    zephyrVersion = `${major}.${minor}.${patch}`;
  } catch { /* ignore */ }

  // Scan driver headers
  let headerFiles: string[] = [];
  try {
    const entries = fs.readdirSync(driversDir);
    headerFiles = entries.filter(f => f.endsWith('.h'));
  } catch (err) {
    vscode.window.showErrorMessage(
      `Cannot read ${driversDir}: ${err instanceof Error ? err.message : err}`
    );
    return { zephyrVersion, subsystems: [], totalFunctions: 0 };
  }

  for (const headerFile of headerFiles) {
    const subsystemName = headerFile.replace('.h', '');
    const meta = SUBSYSTEM_META[subsystemName];
    if (!meta) continue; // Skip unknown subsystems

    const fullPath = path.join(driversDir, headerFile);
    const functions = parseHeaderFile(fullPath, subsystemName);

    if (functions.length > 0) {
      subsystems.push({
        name: subsystemName,
        displayName: meta.displayName,
        headerPath: fullPath,
        functions,
        macros: meta.confFlags,
      });
      totalFunctions += functions.length;
    }
  }

  // Also scan kernel APIs
  const kernelHeader = path.join(zephyrBase, 'include', 'zephyr', 'kernel.h');
  if (fs.existsSync(kernelHeader)) {
    const kernelFns = parseHeaderFile(kernelHeader, 'kernel');
    // Filter to just the commonly used k_* functions
    const filtered = kernelFns.filter(f =>
      f.name.startsWith('k_thread_') ||
      f.name.startsWith('k_timer_') ||
      f.name.startsWith('k_sem_') ||
      f.name.startsWith('k_mutex_') ||
      f.name.startsWith('k_msgq_') ||
      f.name.startsWith('k_work_') ||
      f.name.startsWith('k_fifo_') ||
      f.name.startsWith('k_sleep') ||
      f.name.startsWith('k_busy_wait')
    );
    if (filtered.length > 0) {
      subsystems.push({
        name: 'kernel',
        displayName: 'Kernel (RTOS)',
        headerPath: kernelHeader,
        functions: filtered,
        macros: [],
      });
      totalFunctions += filtered.length;
    }
  }

  return { zephyrVersion, subsystems, totalFunctions };
}

// ── Header Parser ────────────────────────────────────────────────────

function parseHeaderFile(filePath: string, subsystem: string): ZephyrFunction[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const functions: ZephyrFunction[] = [];

  // Match function declarations:
  //   int gpio_pin_configure(const struct device *port, gpio_pin_t pin, gpio_flags_t flags);
  //   static inline int gpio_pin_set(...)  — also catch static inline
  //
  // Pattern: optional_qualifiers return_type function_name(params);
  const funcRegex = /(?:__syscall\s+|static\s+inline\s+)?(\w[\w\s*]+?)\s+(\w+)\s*\(([^)]*)\)\s*;/g;

  // Also try to capture the brief comment above each function
  const lines = content.split('\n');

  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    const returnType = match[1].trim();
    const funcName = match[2].trim();
    const paramStr = match[3].trim();

    // Skip internal functions
    if (SKIP_PATTERNS.some(p => p.test(funcName))) continue;

    // Skip if return type looks like a macro or typedef
    if (returnType.includes('#') || returnType.includes('typedef')) continue;

    // Parse parameters
    const params = parseParams(paramStr);

    // Try to find a brief comment above
    const matchPos = match.index;
    const lineNum = content.substring(0, matchPos).split('\n').length - 1;
    const brief = extractBrief(lines, lineNum);

    functions.push({
      name: funcName,
      returnType,
      params,
      subsystem,
      headerFile: `zephyr/drivers/${path.basename(filePath)}`,
      brief,
    });
  }

  return functions;
}

function parseParams(paramStr: string): ZephyrParam[] {
  if (!paramStr || paramStr === 'void') return [];

  return paramStr.split(',').map(p => {
    const trimmed = p.trim();
    // Split "const struct device *port" into type="const struct device *" name="port"
    const lastSpace = trimmed.lastIndexOf(' ');
    const lastStar = trimmed.lastIndexOf('*');
    const splitAt = Math.max(lastSpace, lastStar + 1);

    if (splitAt <= 0) {
      return { type: trimmed, name: '' };
    }

    return {
      type: trimmed.substring(0, splitAt).trim(),
      name: trimmed.substring(splitAt).trim().replace(/^\*/, ''),
    };
  });
}

function extractBrief(lines: string[], lineNum: number): string | undefined {
  // Look backwards for a @brief or /** ... */ comment
  for (let i = lineNum - 1; i >= Math.max(0, lineNum - 10); i--) {
    const line = lines[i].trim();
    if (line.includes('@brief')) {
      return line.replace(/.*@brief\s*/, '').trim();
    }
    if (line.startsWith('*/')) continue;
    if (line.startsWith('*') && !line.startsWith('*/') && !line.startsWith('/**')) {
      const text = line.replace(/^\*\s*/, '').trim();
      if (text && !text.startsWith('@') && text.length > 10) {
        return text;
      }
    }
    if (line === '' || (!line.startsWith('*') && !line.startsWith('/'))) break;
  }
  return undefined;
}

// ── Node Generation from Scanned APIs ────────────────────────────────

export interface DynamicNodeDef {
  type: string;
  category: string;
  label: string;
  icon: string;
  color: string;
  subsystem: string;
  functionName: string;
  returnType: string;
  params: ZephyrParam[];
  brief: string;
  confFlags: string[];
  headerFile: string;
}

export function generateDynamicNodes(api: ScannedAPI): DynamicNodeDef[] {
  const nodes: DynamicNodeDef[] = [];

  for (const subsystem of api.subsystems) {
    const meta = SUBSYSTEM_META[subsystem.name] ?? {
      displayName: subsystem.name,
      color: '#888',
      icon: 'code',
      confFlags: [],
    };

    for (const fn of subsystem.functions) {
      nodes.push({
        type: `zapi_${fn.name}`,
        category: subsystem.name === 'kernel' ? 'rtos' : 'peripheral',
        label: formatFunctionLabel(fn.name),
        icon: meta.icon,
        color: meta.color,
        subsystem: subsystem.name,
        functionName: fn.name,
        returnType: fn.returnType,
        params: fn.params,
        brief: fn.brief ?? `${fn.returnType} ${fn.name}(${fn.params.map(p => p.name).join(', ')})`,
        confFlags: meta.confFlags,
        headerFile: fn.headerFile,
      });
    }
  }

  return nodes;
}

function formatFunctionLabel(name: string): string {
  // "gpio_pin_configure" → "Pin Configure"
  // "k_thread_create" → "Thread Create"
  return name
    .replace(/^(gpio_|pwm_|uart_|i2c_|spi_|adc_|sensor_|can_|dma_|flash_|wdt_|counter_|led_|k_)/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
