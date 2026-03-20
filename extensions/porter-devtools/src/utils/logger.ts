import * as vscode from 'vscode';

import { OUTPUT_CHANNEL_NAME } from '../constants';

export class Logger implements vscode.Disposable {
    private readonly channel: vscode.OutputChannel;

    constructor() {
        this.channel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    }

    info(message: string, ...args: unknown[]): void {
        this.log('INFO', message, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        this.log('WARN', message, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        this.log('ERROR', message, ...args);
    }

    debug(message: string, ...args: unknown[]): void {
        this.log('DEBUG', message, ...args);
    }

    show(): void {
        this.channel.show(true);
    }

    dispose(): void {
        this.channel.dispose();
    }

    private log(level: string, message: string, ...args: unknown[]): void {
        const timestamp = new Date().toISOString();
        const suffix = args.length > 0
            ? ' ' + args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
            : '';
        this.channel.appendLine(`[${timestamp}] [${level}] ${message}${suffix}`);
    }
}
