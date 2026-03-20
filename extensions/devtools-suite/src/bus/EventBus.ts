// Copyright 2026 VirtusCo

import * as vscode from 'vscode';

type EventHandler = (data: unknown) => void;

const COMMAND_PREFIX = 'virtusco.bus.';

const handlers = new Map<string, EventHandler[]>();
const registeredCommands: vscode.Disposable[] = [];

export type BusEvent =
  | 'alert'
  | 'hardware-update'
  | 'training-complete'
  | 'deploy-done';

export function emit(event: BusEvent, data: unknown): void {
  const commandId = `${COMMAND_PREFIX}${event}`;

  // Fire to local handlers
  const localHandlers = handlers.get(event);
  if (localHandlers) {
    for (const handler of localHandlers) {
      try {
        handler(data);
      } catch (err) {
        console.error(`EventBus handler error for ${event}:`, err);
      }
    }
  }

  // Fire as VS Code command for cross-extension communication
  vscode.commands.executeCommand(commandId, data).then(
    () => {},
    () => {} // Ignore if command not registered
  );
}

export function on(
  event: BusEvent,
  handler: EventHandler,
  context: vscode.ExtensionContext
): void {
  // Register local handler
  if (!handlers.has(event)) {
    handlers.set(event, []);
  }
  handlers.get(event)!.push(handler);

  // Register VS Code command handler
  const commandId = `${COMMAND_PREFIX}${event}`;
  const disposable = vscode.commands.registerCommand(commandId, (data) => {
    handler(data);
  });
  registeredCommands.push(disposable);
  context.subscriptions.push(disposable);
}

export function dispose(): void {
  handlers.clear();
  for (const cmd of registeredCommands) {
    cmd.dispose();
  }
  registeredCommands.length = 0;
}
