// Copyright 2026 VirtusCo
// Platform detection and command wrapping utilities

import { SpawnOptions } from 'child_process';

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isLinux(): boolean {
  return process.platform === 'linux';
}

export function isMac(): boolean {
  return process.platform === 'darwin';
}

export function launchCmd(cmd: string): string {
  if (isWindows()) {
    return `wsl ${cmd}`;
  }
  return cmd;
}

export function launchCmdParts(cmd: string): { command: string; args: string[] } {
  if (isWindows()) {
    return { command: 'wsl', args: cmd.split(/\s+/) };
  }
  const parts = cmd.split(/\s+/);
  return { command: parts[0], args: parts.slice(1) };
}

export function spawnOpts(cwd?: string): SpawnOptions {
  const opts: SpawnOptions = {
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  };
  if (cwd) {
    opts.cwd = cwd;
  }
  if (isWindows()) {
    opts.shell = true;
  }
  return opts;
}
