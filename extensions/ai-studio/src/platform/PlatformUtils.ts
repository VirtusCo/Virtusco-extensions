// Copyright 2026 VirtusCo
// Central platform abstraction — all OS-specific logic lives here

import * as path from 'path';
import type { SpawnOptions } from 'child_process';

// ── Platform Detection ──────────────────────────────────────────────

export const Platform = {
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',
  isMac: process.platform === 'darwin',
} as const;

// ── Platform Utility Functions ──────────────────────────────────────

export const PlatformUtils = {
  /**
   * Returns the path to the Python binary inside a virtual environment.
   * Windows: Scripts/python.exe — Unix: bin/python
   */
  pythonBin(venvDir: string): string {
    if (Platform.isWindows) {
      return path.join(venvDir, 'Scripts', 'python.exe');
    }
    return path.join(venvDir, 'bin', 'python');
  },

  /**
   * Returns the uv binary name for the current platform.
   */
  uvBin(): string {
    return Platform.isWindows ? 'uv.exe' : 'uv';
  },

  /**
   * Returns the full path to nvidia-smi for GPU queries.
   * Windows: C:\Windows\System32\nvidia-smi.exe — Unix: nvidia-smi (on PATH)
   */
  nvidiaSmi(): string {
    if (Platform.isWindows) {
      return 'C:\\Windows\\System32\\nvidia-smi.exe';
    }
    return 'nvidia-smi';
  },

  /**
   * Returns the path to the llama-server binary inside the given base directory.
   */
  llamaServerBin(baseDir: string): string {
    if (Platform.isWindows) {
      return path.join(baseDir, 'llama-server.exe');
    }
    return path.join(baseDir, 'llama-server');
  },

  /**
   * Returns SpawnOptions appropriate for the current platform.
   * Windows requires shell:true for .exe resolution and PATH lookup.
   */
  spawnOpts(cwd?: string): SpawnOptions {
    const opts: SpawnOptions = {
      stdio: 'pipe',
    };
    if (Platform.isWindows) {
      opts.shell = true;
    }
    if (cwd) {
      opts.cwd = cwd;
    }
    return opts;
  },

  /**
   * Converts a Windows path to a WSL-compatible path.
   * C:\Users\foo → /mnt/c/Users/foo
   */
  toWslPath(winPath: string): string {
    const normalized = winPath.replace(/\\/g, '/');
    const match = normalized.match(/^([A-Za-z]):(\/.*)/);
    if (!match) {
      return normalized;
    }
    const drive = match[1].toLowerCase();
    const rest = match[2];
    return `/mnt/${drive}${rest}`;
  },

  /**
   * Converts a WSL path back to a Windows path.
   * /mnt/c/Users/foo → C:\Users\foo
   */
  fromWslPath(wslPath: string): string {
    const match = wslPath.match(/^\/mnt\/([a-z])(\/.*)/);
    if (!match) {
      return wslPath;
    }
    const drive = match[1].toUpperCase();
    const rest = match[2].replace(/\//g, '\\');
    return `${drive}:${rest}`;
  },

  /**
   * Returns the platform-specific PATH delimiter.
   */
  pathSep(): string {
    return path.delimiter;
  },
} as const;
