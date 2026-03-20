// Copyright 2026 VirtusCo

import * as os from 'os';
import type { SpawnOptions } from 'child_process';

export type PlatformType = 'win32' | 'linux' | 'darwin';

export class PlatformUtils {
  static getPlatform(): PlatformType {
    return os.platform() as PlatformType;
  }

  static isWindows(): boolean {
    return PlatformUtils.getPlatform() === 'win32';
  }

  static isLinux(): boolean {
    return PlatformUtils.getPlatform() === 'linux';
  }

  static isMac(): boolean {
    return PlatformUtils.getPlatform() === 'darwin';
  }

  /** Default telemetry serial port based on platform */
  static defaultTelemetryPort(): string {
    switch (PlatformUtils.getPlatform()) {
      case 'win32':
        return 'COM5';
      case 'linux':
        return '/dev/ttyUSB2';
      case 'darwin':
        return '/dev/cu.usbserial-0001';
      default:
        return '/dev/ttyUSB2';
    }
  }

  /** Default spawn options for child processes */
  static spawnOpts(cwd?: string): SpawnOptions {
    const opts: SpawnOptions = {
      cwd: cwd || process.cwd(),
      stdio: 'pipe',
    };
    if (PlatformUtils.isWindows()) {
      opts.shell = true;
    }
    return opts;
  }

  /** Serial port glob pattern for auto-detection */
  static serialPortPattern(): string {
    switch (PlatformUtils.getPlatform()) {
      case 'win32':
        return 'COM*';
      case 'linux':
        return '/dev/ttyUSB*';
      case 'darwin':
        return '/dev/cu.usbserial-*';
      default:
        return '/dev/ttyUSB*';
    }
  }
}
