// Copyright 2026 VirtusCo

import * as os from 'os';

export function isWindows(): boolean {
  return os.platform() === 'win32';
}

export function isMac(): boolean {
  return os.platform() === 'darwin';
}

export function isLinux(): boolean {
  return os.platform() === 'linux';
}

export function getPlatformName(): string {
  switch (os.platform()) {
    case 'win32': return 'Windows';
    case 'darwin': return 'macOS';
    case 'linux': return 'Linux';
    default: return os.platform();
  }
}

export function getHomeDir(): string {
  return os.homedir();
}

export function getDefaultShell(): string {
  if (isWindows()) {
    return 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}
