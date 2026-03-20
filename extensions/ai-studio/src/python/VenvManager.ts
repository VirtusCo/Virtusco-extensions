// Copyright 2026 VirtusCo
// Manages isolated Python virtual environments for AI Studio workloads

import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import * as vscode from 'vscode';
import { PlatformUtils, Platform } from '../platform/PlatformUtils';

export type VenvName = 'base' | 'vision' | 'llm' | 'rl';

const VIRTUS_DIR = '.virtus-ai';

export class VenvManager {
  /**
   * Returns the venv directory path for a given environment name.
   * Located at {workspaceRoot}/.virtus-ai/venv-{name}
   */
  static getVenvDir(name: VenvName): string {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error('No workspace folder open — cannot locate venv directory');
    }
    return path.join(workspaceRoot, VIRTUS_DIR, `venv-${name}`);
  }

  /**
   * Returns the full path to the Python binary inside the named venv.
   */
  static pythonExe(name: VenvName): string {
    const venvDir = VenvManager.getVenvDir(name);
    return PlatformUtils.pythonBin(venvDir);
  }

  /**
   * Checks whether the named venv exists and its Python binary is accessible.
   */
  static async isVenvReady(name: VenvName): Promise<boolean> {
    try {
      const pythonPath = VenvManager.pythonExe(name);
      await fs.promises.access(pythonPath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Creates the named venv if it does not exist, optionally installs
   * dependencies from a requirements file.
   * Returns the venv directory path.
   */
  static async ensureVenv(
    name: VenvName,
    requirementsFile?: string
  ): Promise<string> {
    const venvDir = VenvManager.getVenvDir(name);
    const ready = await VenvManager.isVenvReady(name);

    if (!ready) {
      // Ensure parent directory exists
      const parentDir = path.dirname(venvDir);
      await fs.promises.mkdir(parentDir, { recursive: true });

      // Create venv using uv for speed, fall back to python -m venv
      await VenvManager.createVenv(venvDir);
    }

    if (requirementsFile) {
      await VenvManager.installRequirements(venvDir, requirementsFile);
    }

    return venvDir;
  }

  /**
   * Creates a new virtual environment at the specified path.
   * Tries uv first for speed, falls back to python -m venv.
   */
  private static createVenv(venvDir: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const uvBin = PlatformUtils.uvBin();
      const spawnOpts = PlatformUtils.spawnOpts(path.dirname(venvDir));

      // Try uv venv first
      execFile(uvBin, ['venv', venvDir], spawnOpts, (uvErr) => {
        if (!uvErr) {
          resolve();
          return;
        }

        // Fall back to python -m venv
        const pythonCmd = Platform.isWindows ? 'python' : 'python3';
        execFile(
          pythonCmd,
          ['-m', 'venv', venvDir],
          spawnOpts,
          (pyErr, _stdout, stderr) => {
            if (pyErr) {
              reject(
                new Error(
                  `Failed to create venv at ${venvDir}: ${stderr || pyErr.message}`
                )
              );
              return;
            }
            resolve();
          }
        );
      });
    });
  }

  /**
   * Installs packages from a requirements file into the given venv.
   * Uses uv pip install for speed, falls back to pip.
   */
  private static installRequirements(
    venvDir: string,
    requirementsFile: string
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const pythonBin = PlatformUtils.pythonBin(venvDir);
      const spawnOpts = PlatformUtils.spawnOpts(path.dirname(venvDir));
      const uvBin = PlatformUtils.uvBin();

      // Try uv pip install first
      execFile(
        uvBin,
        ['pip', 'install', '-r', requirementsFile, '--python', pythonBin],
        spawnOpts,
        (uvErr) => {
          if (!uvErr) {
            resolve();
            return;
          }

          // Fall back to pip via the venv's Python
          execFile(
            pythonBin,
            ['-m', 'pip', 'install', '-r', requirementsFile],
            spawnOpts,
            (pipErr, _stdout, stderr) => {
              if (pipErr) {
                reject(
                  new Error(
                    `Failed to install requirements from ${requirementsFile}: ${stderr || pipErr.message}`
                  )
                );
                return;
              }
              resolve();
            }
          );
        }
      );
    });
  }
}
