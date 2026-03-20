// Copyright 2026 VirtusCo
// Launches simulation profiles by spawning each step sequentially

import { spawn } from 'child_process';
import { LaunchProfile } from '../types';
import { ProcessTracker } from './ProcessTracker';
import { launchCmdParts, spawnOpts } from '../platform/PlatformUtils';

export class ProfileRunner {
  private _activeProfileId: string | null = null;

  constructor(private _tracker: ProcessTracker) {}

  get activeProfileId(): string | null {
    return this._activeProfileId;
  }

  async launchProfile(profile: LaunchProfile): Promise<void> {
    this._activeProfileId = profile.id;

    for (let i = 0; i < profile.steps.length; i++) {
      const step = profile.steps[i];

      if (this._activeProfileId !== profile.id) {
        break;
      }

      if (step.delay_ms && i > 0) {
        await this._delay(step.delay_ms);
      }

      if (this._activeProfileId !== profile.id) {
        break;
      }

      const { command, args } = launchCmdParts(step.cmd);
      const opts = spawnOpts();
      const proc = spawn(command, args, opts);

      const stepId = `${profile.id}_step_${i}_${Date.now()}`;
      this._tracker.add(stepId, step.name, proc);

      proc.stdout?.on('data', (data: Buffer) => {
        console.log(`[${step.name}] ${data.toString().trim()}`);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        console.error(`[${step.name}] ${data.toString().trim()}`);
      });
    }
  }

  stopAll(): void {
    this._activeProfileId = null;
    this._tracker.killAll();
  }

  stopProcess(id: string): void {
    this._tracker.killProcess(id);
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
