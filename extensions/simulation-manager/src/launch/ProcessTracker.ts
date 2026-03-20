// Copyright 2026 VirtusCo
// Tracks all spawned simulation processes

import { ChildProcess } from 'child_process';
import { ProcessInfo } from '../types';

interface TrackedProcess {
  info: ProcessInfo;
  proc: ChildProcess;
}

export class ProcessTracker {
  private _processes = new Map<string, TrackedProcess>();
  private _onChange?: () => void;

  setOnChange(callback: () => void): void {
    this._onChange = callback;
  }

  add(id: string, name: string, proc: ChildProcess): void {
    const info: ProcessInfo = {
      id,
      name,
      pid: proc.pid ?? -1,
      status: 'running',
      startTime: Date.now(),
    };

    this._processes.set(id, { info, proc });

    proc.on('exit', (code) => {
      const tracked = this._processes.get(id);
      if (tracked) {
        tracked.info.status = code === 0 || code === null ? 'stopped' : 'error';
        this._notify();
      }
    });

    proc.on('error', () => {
      const tracked = this._processes.get(id);
      if (tracked) {
        tracked.info.status = 'error';
        this._notify();
      }
    });

    this._notify();
  }

  remove(id: string): void {
    const tracked = this._processes.get(id);
    if (tracked) {
      if (tracked.info.status === 'running') {
        this._killProcess(tracked.proc);
      }
      this._processes.delete(id);
      this._notify();
    }
  }

  getAll(): ProcessInfo[] {
    return Array.from(this._processes.values()).map((t) => ({ ...t.info }));
  }

  getProcess(id: string): ChildProcess | undefined {
    return this._processes.get(id)?.proc;
  }

  killAll(): void {
    const ids = Array.from(this._processes.keys()).reverse();
    for (const id of ids) {
      const tracked = this._processes.get(id);
      if (tracked && tracked.info.status === 'running') {
        this._killProcess(tracked.proc);
        tracked.info.status = 'stopped';
      }
    }
    this._notify();
  }

  killProcess(id: string): void {
    const tracked = this._processes.get(id);
    if (tracked && tracked.info.status === 'running') {
      this._killProcess(tracked.proc);
      tracked.info.status = 'stopped';
      this._notify();
    }
  }

  clear(): void {
    this.killAll();
    this._processes.clear();
    this._notify();
  }

  get size(): number {
    return this._processes.size;
  }

  private _killProcess(proc: ChildProcess): void {
    try {
      if (process.platform === 'win32') {
        proc.kill();
      } else {
        proc.kill('SIGTERM');
        setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            // Process already exited
          }
        }, 3000);
      }
    } catch {
      // Process already exited
    }
  }

  private _notify(): void {
    this._onChange?.();
  }
}
