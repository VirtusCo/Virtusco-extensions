import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export function isWindows(): boolean {
    return process.platform === 'win32';
}

export function isLinux(): boolean {
    return process.platform === 'linux';
}

export function isMacOS(): boolean {
    return process.platform === 'darwin';
}

export async function findEsptool(customPath?: string): Promise<string | undefined> {
    if (customPath && await fileExists(customPath)) {
        return customPath;
    }

    const names = isWindows()
        ? ['esptool.exe', 'esptool.py']
        : ['esptool.py', 'esptool'];

    for (const name of names) {
        const found = await findOnPath(name);
        if (found) {
            return found;
        }
    }

    const pipPaths = getPipInstallPaths();
    for (const dir of pipPaths) {
        for (const name of names) {
            const candidate = path.join(dir, name);
            if (await fileExists(candidate)) {
                return candidate;
            }
        }
    }

    return undefined;
}

export async function findWest(customPath?: string): Promise<string | undefined> {
    if (customPath && await fileExists(customPath)) {
        return customPath;
    }

    const name = isWindows() ? 'west.exe' : 'west';
    const found = await findOnPath(name);
    if (found) {
        return found;
    }

    const pipPaths = getPipInstallPaths();
    for (const dir of pipPaths) {
        const candidate = path.join(dir, name);
        if (await fileExists(candidate)) {
            return candidate;
        }
    }

    return undefined;
}

export function getSerialPortGlobPattern(): string {
    if (isWindows()) {
        return 'COM*';
    }
    if (isMacOS()) {
        return '/dev/cu.*';
    }
    return '/dev/ttyUSB*';
}

export function getDefaultSshKeyPath(): string {
    return path.join(os.homedir(), '.ssh', 'id_rsa');
}

function getPipInstallPaths(): string[] {
    const home = os.homedir();
    if (isWindows()) {
        return [
            path.join(home, 'AppData', 'Roaming', 'Python', 'Scripts'),
            path.join(home, 'AppData', 'Local', 'Programs', 'Python', 'Scripts'),
            path.join(home, '.local', 'bin'),
        ];
    }
    return [
        path.join(home, '.local', 'bin'),
        '/usr/local/bin',
    ];
}

async function findOnPath(binary: string): Promise<string | undefined> {
    const cmd = isWindows() ? 'where' : 'which';
    try {
        const { stdout } = await execFileAsync(cmd, [binary], { timeout: 5000 });
        const result = stdout.trim().split(/\r?\n/)[0];
        if (result && await fileExists(result)) {
            return result;
        }
    } catch {
        // Not found on PATH
    }
    return undefined;
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) { return '0 B'; }
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function serialPortPermissionError(): string {
    if (isLinux()) {
        return 'Permission denied. Add your user to the dialout group:\n  sudo usermod -a -G dialout $USER\nThen log out and back in.';
    }
    if (isMacOS()) {
        return 'Permission denied. Add your user to the dialout group:\n  sudo dseditgroup -o edit -a $USER -t user dialout';
    }
    return 'Permission denied. Check that no other application is using the serial port.';
}
