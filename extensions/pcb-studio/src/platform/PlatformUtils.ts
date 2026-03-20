// Copyright 2026 VirtusCo

import * as os from 'os';
import * as path from 'path';

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isMac(): boolean {
  return process.platform === 'darwin';
}

export function isLinux(): boolean {
  return process.platform === 'linux';
}

export function getHomeDir(): string {
  return os.homedir();
}

export function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

export function getDefaultOverlaySearchPaths(): string[] {
  const home = getHomeDir();
  return [
    path.join(home, 'zephyrproject'),
    path.join(home, 'porter_robot', 'esp32_firmware'),
  ];
}

export function getCpuCount(): number {
  return os.cpus().length;
}

export function getAvailableMemoryMB(): number {
  return Math.round(os.freemem() / (1024 * 1024));
}
