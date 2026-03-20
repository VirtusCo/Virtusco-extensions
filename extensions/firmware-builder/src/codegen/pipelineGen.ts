// Copyright 2026 VirtusCo
// Pipeline command generators (west build/flash shell commands)

import { BuildConfig, FlashConfig } from '../types';

export function buildCommand(cfg: BuildConfig): string {
  const parts = ['west build'];
  parts.push(`-b ${cfg.board}`);
  if (cfg.pristine) parts.push('--pristine');
  if (cfg.extraArgs) parts.push(cfg.extraArgs);
  return parts.join(' ');
}

export function flashCommand(cfg: FlashConfig): string {
  const parts = ['west flash'];
  parts.push(`--runner ${cfg.runner}`);
  if (cfg.port) parts.push(`--esp-device ${cfg.port}`);
  if (cfg.buildDir) parts.push(`--build-dir ${cfg.buildDir}`);
  return parts.join(' ');
}

export function monitorCommand(port: string, baud: number): string {
  return `python -m serial.tools.miniterm ${port} ${baud}`;
}

export function cleanCommand(): string {
  return 'west build --pristine always';
}

export function menuconfigCommand(): string {
  return 'west build -t menuconfig';
}
