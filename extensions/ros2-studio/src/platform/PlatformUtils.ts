// Copyright 2026 VirtusCo
// Platform-aware utilities for running ROS 2 CLI commands

import * as child_process from 'child_process';
import * as path from 'path';

export const Platform = {
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',
  isMac: process.platform === 'darwin',
};

/**
 * Wraps a ROS 2 CLI command for the current platform.
 * On Windows, prefixes with 'wsl' so the command runs inside WSL.
 */
export function ros2Cmd(args: string): string {
  if (Platform.isWindows) {
    return `wsl bash -lc "${args.replace(/"/g, '\\"')}"`;
  }
  return args;
}

/**
 * Returns spawn/exec options appropriate for the current platform.
 */
export function spawnOpts(cwd?: string): child_process.ExecOptions {
  const opts: child_process.ExecOptions = {
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  };

  if (Platform.isWindows) {
    opts.shell = true;
  }

  if (cwd) {
    opts.cwd = cwd;
  }

  return opts;
}

/**
 * Executes a command and returns stdout as a string.
 */
export function execAsync(cmd: string, opts?: child_process.ExecOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    child_process.exec(cmd, opts ?? spawnOpts(), (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${cmd}\n${stderr || error.message}`));
        return;
      }
      resolve(stdout.toString().trim());
    });
  });
}

/**
 * Converts a path for use in WSL if running on Windows.
 */
export function toWslPath(windowsPath: string): string {
  if (!Platform.isWindows) {
    return windowsPath;
  }
  // Convert C:\foo\bar → /mnt/c/foo/bar
  const normalized = path.normalize(windowsPath);
  const match = normalized.match(/^([A-Za-z]):(.*)/);
  if (match) {
    const drive = match[1].toLowerCase();
    const rest = match[2].replace(/\\/g, '/');
    return `/mnt/${drive}${rest}`;
  }
  return windowsPath;
}
