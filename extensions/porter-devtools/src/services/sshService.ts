import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Client, SFTPWrapper } from 'ssh2';

import { Logger } from '../utils/logger';
import { SSH_CONNECT_TIMEOUT_MS, SSH_TRANSFER_TIMEOUT_MS } from '../constants';

/**
 * SSH/SFTP service for deploying Docker images and Flutter GUI bundles
 * to the Raspberry Pi over an SSH connection.
 *
 * Wraps the `ssh2` npm package, maintaining a single persistent connection
 * that can be reused across multiple deploy operations. Large file transfers
 * (Docker images can exceed 500 MB) use SFTP streaming with progress
 * callbacks.
 */
export class SshService implements vscode.Disposable {
    private readonly logger: Logger;
    private client: Client;
    private connected: boolean = false;

    constructor(logger: Logger) {
        this.logger = logger;
        this.client = new Client();
    }

    // ── Connection lifecycle ──────────────────────────────────────────

    /**
     * Establishes an SSH connection to the target host using private-key
     * authentication.
     *
     * @param host     Hostname or IP address of the Raspberry Pi.
     * @param username SSH username (typically `"pi"`).
     * @param privateKeyPath Absolute path to the SSH private key file.
     *
     * @throws If the connection cannot be established within
     *         {@link SSH_CONNECT_TIMEOUT_MS}, the key file is unreadable,
     *         or authentication fails.
     */
    async connect(host: string, username: string, privateKeyPath: string): Promise<void> {
        if (this.connected) {
            this.logger.info('SSH already connected, disconnecting before reconnecting');
            this.disconnect();
        }

        const resolvedKeyPath = privateKeyPath.startsWith('~')
            ? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '', privateKeyPath.slice(1))
            : privateKeyPath;

        this.logger.info(`Reading SSH private key from ${resolvedKeyPath}`);

        let privateKey: Buffer;
        try {
            privateKey = fs.readFileSync(resolvedKeyPath);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to read SSH private key: ${message}`);
            throw new Error(
                `Cannot read SSH private key at "${resolvedKeyPath}". ` +
                'Check that the file exists and is readable.',
            );
        }

        // Re-create the Client so we start from a clean state after any
        // previous disconnect. ssh2 Clients are single-use once ended.
        this.client = new Client();

        return new Promise<void>((resolve, reject) => {
            let settled = false;

            const timeoutHandle = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    this.logger.error(`SSH connection to ${host} timed out after ${SSH_CONNECT_TIMEOUT_MS}ms`);
                    this.client.end();
                    reject(new Error(
                        `Connection timed out after ${SSH_CONNECT_TIMEOUT_MS / 1000}s. ` +
                        `Check that ${host} is reachable and the SSH daemon is running.`,
                    ));
                }
            }, SSH_CONNECT_TIMEOUT_MS);

            this.client.on('ready', () => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeoutHandle);
                    this.connected = true;
                    this.logger.info(`SSH connection established to ${username}@${host}`);
                    resolve();
                }
            });

            this.client.on('error', (err: Error) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeoutHandle);
                    this.connected = false;
                    const friendlyMessage = this.classifyConnectionError(err);
                    this.logger.error(`SSH connection error: ${err.message}`);
                    reject(new Error(friendlyMessage));
                }
            });

            this.client.on('end', () => {
                this.connected = false;
                this.logger.info('SSH connection ended');
            });

            this.client.on('close', () => {
                this.connected = false;
                this.logger.debug('SSH connection closed');
            });

            this.logger.info(`Connecting to ${username}@${host} via SSH...`);

            this.client.connect({
                host,
                port: 22,
                username,
                privateKey,
                readyTimeout: SSH_CONNECT_TIMEOUT_MS,
            });
        });
    }

    /**
     * Closes the current SSH connection. Safe to call even if not connected.
     */
    disconnect(): void {
        if (this.connected) {
            this.logger.info('Disconnecting SSH');
            this.client.end();
            this.connected = false;
        }
    }

    /**
     * Returns `true` if there is an active SSH connection.
     */
    isConnected(): boolean {
        return this.connected;
    }

    // ── Remote command execution ──────────────────────────────────────

    /**
     * Executes a command on the remote host and returns the captured
     * stdout, stderr, and exit code.
     *
     * @param command The shell command to run remotely.
     * @param timeout Optional timeout in milliseconds. Defaults to
     *                {@link SSH_CONNECT_TIMEOUT_MS}.
     *
     * @throws If the SSH session is not connected or the command times
     *         out.
     */
    async exec(
        command: string,
        timeout: number = SSH_CONNECT_TIMEOUT_MS,
    ): Promise<{ stdout: string; stderr: string; code: number }> {
        this.assertConnected();
        this.logger.debug(`SSH exec: ${command}`);

        return new Promise((resolve, reject) => {
            let settled = false;

            const timeoutHandle = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    this.logger.error(`SSH exec timed out after ${timeout}ms: ${command}`);
                    reject(new Error(
                        `Remote command timed out after ${timeout / 1000}s: ${command}`,
                    ));
                }
            }, timeout);

            this.client.exec(command, (err, stream) => {
                if (err) {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timeoutHandle);
                        this.logger.error(`SSH exec error: ${err.message}`);
                        reject(new Error(`Failed to execute remote command: ${err.message}`));
                    }
                    return;
                }

                let stdout = '';
                let stderr = '';

                stream.on('data', (data: Buffer) => {
                    stdout += data.toString();
                });

                stream.stderr.on('data', (data: Buffer) => {
                    stderr += data.toString();
                });

                stream.on('close', (code: number | null) => {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timeoutHandle);
                        const exitCode = code ?? 0;
                        this.logger.debug(
                            `SSH exec completed (code ${exitCode}): ${command}`,
                        );
                        if (stderr.length > 0) {
                            this.logger.debug(`SSH stderr: ${stderr.trim()}`);
                        }
                        resolve({ stdout, stderr, code: exitCode });
                    }
                });
            });
        });
    }

    // ── File transfer ─────────────────────────────────────────────────

    /**
     * Uploads a local file to the remote host via SFTP streaming.
     *
     * Uses a read stream piped through the SFTP write stream so that
     * large files (500 MB+ Docker images) do not need to be buffered
     * in memory.
     *
     * @param localPath   Absolute path to the local file.
     * @param remotePath  Destination path on the remote host.
     * @param onProgress  Optional callback invoked as bytes are written.
     *                    Receives `(transferred, total)` in bytes.
     *
     * @throws If the local file does not exist, the SFTP subsystem
     *         cannot be opened, or the transfer fails / times out.
     */
    async uploadFile(
        localPath: string,
        remotePath: string,
        onProgress?: (transferred: number, total: number) => void,
    ): Promise<void> {
        this.assertConnected();

        let fileSize: number;
        try {
            const stat = fs.statSync(localPath);
            fileSize = stat.size;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Cannot stat local file for upload: ${message}`);
            throw new Error(`Local file not found or unreadable: ${localPath}`);
        }

        this.logger.info(
            `Uploading ${localPath} (${this.formatBytes(fileSize)}) → ${remotePath}`,
        );

        const sftp = await this.openSftp();

        return new Promise<void>((resolve, reject) => {
            let settled = false;
            let transferred = 0;

            const timeoutHandle = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    this.logger.error(
                        `SFTP upload timed out after ${SSH_TRANSFER_TIMEOUT_MS / 1000}s`,
                    );
                    readStream.destroy();
                    reject(new Error(
                        `File transfer timed out after ${SSH_TRANSFER_TIMEOUT_MS / 1000}s. ` +
                        'The file may be too large or the network too slow.',
                    ));
                }
            }, SSH_TRANSFER_TIMEOUT_MS);

            const readStream = fs.createReadStream(localPath);
            const writeStream = sftp.createWriteStream(remotePath);

            readStream.on('data', (chunk: Buffer | string) => {
                transferred += chunk.length;
                onProgress?.(transferred, fileSize);
            });

            writeStream.on('close', () => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeoutHandle);
                    this.logger.info(`Upload complete: ${remotePath}`);
                    resolve();
                }
            });

            writeStream.on('error', (err: Error) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeoutHandle);
                    readStream.destroy();
                    this.logger.error(`SFTP write error: ${err.message}`);
                    reject(new Error(`File transfer failed: ${err.message}`));
                }
            });

            readStream.on('error', (err: Error) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeoutHandle);
                    writeStream.destroy();
                    this.logger.error(`Local file read error during upload: ${err.message}`);
                    reject(new Error(`File transfer failed: ${err.message}`));
                }
            });

            readStream.pipe(writeStream);
        });
    }

    // ── High-level deployment workflows ───────────────────────────────

    /**
     * Deploys a Docker image tarball to the Raspberry Pi.
     *
     * Workflow:
     * 1. Upload tarball to `/tmp/porter-robot-{version}.tar.gz`
     * 2. `docker load` the image from the tarball
     * 3. `docker compose up -d` to restart the stack
     * 4. Remove the temporary tarball
     *
     * Each stage is reported via {@link vscode.window.withProgress}.
     *
     * @param localTarPath     Local path to the Docker image tarball.
     * @param version          Version string used for the temp filename.
     * @param dockerComposePath Remote path to the Docker Compose file.
     */
    async deployDockerImage(
        localTarPath: string,
        version: string,
        dockerComposePath: string,
    ): Promise<void> {
        this.assertConnected();

        const remoteTarPath = `/tmp/porter-robot-${version}.tar.gz`;

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Deploying Docker Image to RPi',
                cancellable: false,
            },
            async (progress) => {
                // Stage 1: Upload
                progress.report({ message: 'Uploading Docker image...', increment: 0 });
                this.logger.info(`[Deploy Docker] Uploading ${localTarPath} → ${remoteTarPath}`);

                await this.uploadFile(localTarPath, remoteTarPath, (transferred, total) => {
                    const pct = Math.round((transferred / total) * 40);
                    progress.report({
                        message: `Uploading Docker image... ${this.formatBytes(transferred)} / ${this.formatBytes(total)}`,
                        increment: pct,
                    });
                });

                // Stage 2: docker load
                progress.report({ message: 'Loading Docker image...', increment: 40 });
                this.logger.info('[Deploy Docker] Loading image with docker load');

                const loadResult = await this.exec(
                    `docker load < ${remoteTarPath}`,
                    SSH_TRANSFER_TIMEOUT_MS,
                );
                if (loadResult.code !== 0) {
                    throw new Error(
                        `docker load failed (exit ${loadResult.code}): ${loadResult.stderr.trim()}`,
                    );
                }
                this.logger.info(`[Deploy Docker] docker load output: ${loadResult.stdout.trim()}`);

                // Stage 3: docker compose up
                progress.report({ message: 'Starting containers...', increment: 20 });
                this.logger.info('[Deploy Docker] Running docker compose up -d');

                const composeResult = await this.exec(
                    `docker compose -f ${dockerComposePath} up -d`,
                    SSH_TRANSFER_TIMEOUT_MS,
                );
                if (composeResult.code !== 0) {
                    throw new Error(
                        `docker compose up failed (exit ${composeResult.code}): ${composeResult.stderr.trim()}`,
                    );
                }
                this.logger.info(`[Deploy Docker] Compose output: ${composeResult.stdout.trim()}`);

                // Stage 4: Cleanup
                progress.report({ message: 'Cleaning up...', increment: 10 });
                this.logger.info(`[Deploy Docker] Removing temp file ${remoteTarPath}`);

                await this.exec(`rm ${remoteTarPath}`);

                progress.report({ message: 'Docker deployment complete.', increment: 10 });
                this.logger.info('[Deploy Docker] Deployment complete');
            },
        );
    }

    /**
     * Deploys a Flutter GUI bundle tarball to the Raspberry Pi.
     *
     * Workflow:
     * 1. Upload tarball to `/tmp/porter-gui.tar.gz`
     * 2. Create the install directory if it does not exist
     * 3. Extract the tarball into the install directory
     * 4. Remove the temporary tarball
     * 5. Restart the `porter-gui` systemd service (if it exists)
     *
     * @param localTarPath  Local path to the Flutter GUI tarball.
     * @param installPath   Remote directory to extract the bundle into.
     */
    async deployFlutterGui(
        localTarPath: string,
        installPath: string,
    ): Promise<void> {
        this.assertConnected();

        const remoteTarPath = '/tmp/porter-gui.tar.gz';

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Deploying Flutter GUI to RPi',
                cancellable: false,
            },
            async (progress) => {
                // Stage 1: Upload
                progress.report({ message: 'Uploading Flutter GUI bundle...', increment: 0 });
                this.logger.info(`[Deploy GUI] Uploading ${localTarPath} → ${remoteTarPath}`);

                await this.uploadFile(localTarPath, remoteTarPath, (transferred, total) => {
                    const pct = Math.round((transferred / total) * 40);
                    progress.report({
                        message: `Uploading Flutter GUI... ${this.formatBytes(transferred)} / ${this.formatBytes(total)}`,
                        increment: pct,
                    });
                });

                // Stage 2: Create install directory
                progress.report({ message: 'Preparing install directory...', increment: 10 });
                this.logger.info(`[Deploy GUI] Creating directory ${installPath}`);

                const mkdirResult = await this.exec(`mkdir -p ${installPath}`);
                if (mkdirResult.code !== 0) {
                    throw new Error(
                        `Failed to create directory ${installPath}: ${mkdirResult.stderr.trim()}`,
                    );
                }

                // Stage 3: Extract tarball
                progress.report({ message: 'Extracting Flutter GUI bundle...', increment: 20 });
                this.logger.info(`[Deploy GUI] Extracting ${remoteTarPath} → ${installPath}`);

                const extractResult = await this.exec(
                    `tar xzf ${remoteTarPath} -C ${installPath}`,
                    SSH_TRANSFER_TIMEOUT_MS,
                );
                if (extractResult.code !== 0) {
                    throw new Error(
                        `tar extraction failed (exit ${extractResult.code}): ${extractResult.stderr.trim()}`,
                    );
                }

                // Stage 4: Cleanup
                progress.report({ message: 'Cleaning up...', increment: 10 });
                this.logger.info(`[Deploy GUI] Removing temp file ${remoteTarPath}`);

                await this.exec(`rm ${remoteTarPath}`);

                // Stage 5: Restart systemd service (best-effort)
                progress.report({ message: 'Restarting GUI service...', increment: 10 });
                this.logger.info('[Deploy GUI] Restarting porter-gui systemd service');

                const restartResult = await this.exec(
                    'sudo systemctl restart porter-gui 2>/dev/null || true',
                );
                if (restartResult.code === 0) {
                    this.logger.info('[Deploy GUI] porter-gui service restarted (or was not found)');
                }

                progress.report({ message: 'Flutter GUI deployment complete.', increment: 10 });
                this.logger.info('[Deploy GUI] Deployment complete');
            },
        );
    }

    // ── Connection test ───────────────────────────────────────────────

    /**
     * Tests whether an SSH connection can be established and a simple
     * command executed successfully.
     *
     * Connects, runs `echo ok`, and disconnects. Returns `true` if the
     * command output matches `"ok"`. Errors are logged but not thrown.
     *
     * @param host           Hostname or IP.
     * @param username       SSH username.
     * @param privateKeyPath Path to the SSH private key file.
     */
    async testConnection(
        host: string,
        username: string,
        privateKeyPath: string,
    ): Promise<boolean> {
        this.logger.info(`Testing SSH connection to ${username}@${host}`);

        try {
            await this.connect(host, username, privateKeyPath);
            const result = await this.exec('echo ok');
            this.disconnect();

            const success = result.code === 0 && result.stdout.trim() === 'ok';
            this.logger.info(`SSH connection test ${success ? 'passed' : 'failed'}`);
            return success;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`SSH connection test failed: ${message}`);
            this.disconnect();
            return false;
        }
    }

    // ── Disposable ────────────────────────────────────────────────────

    dispose(): void {
        this.disconnect();
    }

    // ── Private helpers ───────────────────────────────────────────────

    /**
     * Opens an SFTP subsystem on the current SSH connection.
     *
     * @throws If the SFTP subsystem cannot be initialised.
     */
    private openSftp(): Promise<SFTPWrapper> {
        return new Promise<SFTPWrapper>((resolve, reject) => {
            this.client.sftp((err, sftp) => {
                if (err) {
                    this.logger.error(`Failed to open SFTP subsystem: ${err.message}`);
                    reject(new Error(`File transfer failed: ${err.message}`));
                    return;
                }
                resolve(sftp);
            });
        });
    }

    /**
     * Asserts that the SSH connection is established. Throws a
     * descriptive error if not.
     */
    private assertConnected(): void {
        if (!this.connected) {
            throw new Error(
                'Not connected to the Raspberry Pi. ' +
                'Call connect() or configure the RPi target first.',
            );
        }
    }

    /**
     * Classifies an SSH connection error into a user-friendly message.
     */
    private classifyConnectionError(err: Error): string {
        const msg = err.message.toLowerCase();

        if (msg.includes('econnrefused') || msg.includes('connection refused')) {
            return 'Cannot connect to RPi. Check host/port.';
        }

        if (
            msg.includes('authentication') ||
            msg.includes('auth') ||
            msg.includes('permission denied') ||
            msg.includes('publickey')
        ) {
            return 'Authentication failed. Check SSH key.';
        }

        if (
            msg.includes('timed out') ||
            msg.includes('timeout') ||
            msg.includes('etimedout')
        ) {
            return 'Connection timed out.';
        }

        if (
            msg.includes('enotfound') ||
            msg.includes('getaddrinfo') ||
            msg.includes('dns')
        ) {
            return `Host not found: "${err.message}". Check the hostname or IP address.`;
        }

        if (msg.includes('enetunreach') || msg.includes('network is unreachable')) {
            return 'Network unreachable. Check your network connection and the RPi IP address.';
        }

        return `SSH connection failed: ${err.message}`;
    }

    /**
     * Formats a byte count into a human-readable string
     * (e.g. `"128.5 MB"`).
     */
    private formatBytes(bytes: number): string {
        if (bytes < 1024) {
            return `${bytes} B`;
        }
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        if (bytes < 1024 * 1024 * 1024) {
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
}
