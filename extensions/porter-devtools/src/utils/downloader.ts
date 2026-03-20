import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

import { DownloadProgress } from '../models/types';

export async function downloadFile(
    url: string,
    destPath: string,
    headers: Record<string, string> = {},
    onProgress?: (progress: DownloadProgress) => void,
    abortSignal?: AbortSignal,
): Promise<void> {
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

    const tmpPath = destPath + '.tmp';

    try {
        await new Promise<void>((resolve, reject) => {
            const parsedUrl = new URL(url);
            const transport = parsedUrl.protocol === 'https:' ? https : http;

            const reqHeaders: Record<string, string> = {
                'User-Agent': 'Porter-DevTools-VSCode/0.1.0',
                ...headers,
            };

            const req = transport.get(
                url,
                { headers: reqHeaders },
                (res) => {
                    if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        downloadFile(res.headers.location, destPath, headers, onProgress, abortSignal)
                            .then(resolve)
                            .catch(reject);
                        res.resume();
                        return;
                    }

                    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                        res.resume();
                        reject(new Error(`HTTP ${res.statusCode}: Failed to download ${url}`));
                        return;
                    }

                    const totalBytes = parseInt(res.headers['content-length'] ?? '0', 10);
                    let bytesDownloaded = 0;

                    const writeStream = fs.createWriteStream(tmpPath);

                    res.on('data', (chunk: Buffer) => {
                        bytesDownloaded += chunk.length;
                        if (onProgress) {
                            onProgress({
                                bytesDownloaded,
                                totalBytes,
                                percentage: totalBytes > 0
                                    ? Math.round((bytesDownloaded / totalBytes) * 100)
                                    : 0,
                            });
                        }
                    });

                    res.pipe(writeStream);

                    writeStream.on('finish', () => {
                        writeStream.close(() => {
                            fs.rename(tmpPath, destPath, (err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    });

                    writeStream.on('error', (err) => {
                        fs.unlink(tmpPath, () => { /* ignore cleanup error */ });
                        reject(err);
                    });

                    res.on('error', (err) => {
                        writeStream.destroy();
                        fs.unlink(tmpPath, () => { /* ignore cleanup error */ });
                        reject(err);
                    });
                },
            );

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy(new Error('Download timed out'));
            });

            if (abortSignal) {
                const onAbort = (): void => {
                    req.destroy(new Error('Download cancelled'));
                };
                abortSignal.addEventListener('abort', onAbort, { once: true });
            }
        });
    } catch (err) {
        try { await fs.promises.unlink(tmpPath); } catch { /* ignore */ }
        throw err;
    }
}

export async function ensureDirectory(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
}
