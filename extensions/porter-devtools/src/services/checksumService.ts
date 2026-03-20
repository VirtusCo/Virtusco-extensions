import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

import { Logger } from '../utils/logger';
import { ChecksumResult } from '../models/types';

/**
 * SHA256 checksum verification service.
 *
 * Reads a `SHA256SUMS.txt` file (one `hash  filename` entry per line),
 * computes the SHA-256 digest of each referenced file on disk, and
 * reports whether the hashes match.
 */
export class ChecksumService {
    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    // ── Public API ─────────────────────────────────────────────────────

    /**
     * Verifies every file listed in `SHA256SUMS.txt` found inside
     * `artifactsDir`. For each entry the computed digest is compared with
     * the expected digest from the sums file.
     *
     * Files referenced in `SHA256SUMS.txt` that do not exist on disk are
     * reported with an empty `actual` hash and `match: false`.
     *
     * @returns An array of {@link ChecksumResult} objects, one per entry.
     */
    async verifyAll(artifactsDir: string): Promise<ChecksumResult[]> {
        const sumsPath = path.join(artifactsDir, 'SHA256SUMS.txt');

        this.logger.info(`Verifying checksums using ${sumsPath}`);

        let expectedMap: Map<string, string>;
        try {
            expectedMap = await this.parseSha256Sums(sumsPath);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to read SHA256SUMS.txt: ${message}`);
            return [];
        }

        if (expectedMap.size === 0) {
            this.logger.warn('SHA256SUMS.txt is empty — nothing to verify');
            return [];
        }

        const results: ChecksumResult[] = [];

        for (const [filename, expectedHash] of expectedMap) {
            const filePath = path.join(artifactsDir, filename);

            try {
                await fs.promises.access(filePath, fs.constants.R_OK);
            } catch {
                this.logger.warn(`File not found for checksum verification: ${filePath}`);
                results.push({
                    file: filename,
                    expected: expectedHash,
                    actual: '',
                    match: false,
                });
                continue;
            }

            try {
                const actualHash = await this.computeSha256(filePath);
                const match = actualHash === expectedHash;

                if (match) {
                    this.logger.info(`Checksum OK: ${filename}`);
                } else {
                    this.logger.error(
                        `Checksum MISMATCH: ${filename} — ` +
                        `expected ${expectedHash}, got ${actualHash}`,
                    );
                }

                results.push({
                    file: filename,
                    expected: expectedHash,
                    actual: actualHash,
                    match,
                });
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Failed to compute SHA256 for ${filename}: ${message}`);
                results.push({
                    file: filename,
                    expected: expectedHash,
                    actual: '',
                    match: false,
                });
            }
        }

        const passed = results.filter((r) => r.match).length;
        this.logger.info(
            `Checksum verification complete: ${passed}/${results.length} passed`,
        );

        return results;
    }

    /**
     * Computes the SHA-256 digest of a file by streaming its contents
     * through a hash transform. Returns the lowercase hex string.
     */
    async computeSha256(filePath: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);

            stream.on('data', (chunk: Buffer | string) => {
                hash.update(chunk);
            });

            stream.on('end', () => {
                resolve(hash.digest('hex'));
            });

            stream.on('error', (err: Error) => {
                reject(err);
            });
        });
    }

    /**
     * Parses a `SHA256SUMS.txt` file into a map of `filename -> hash`.
     *
     * The expected format is one entry per line:
     * ```
     * <64-char-hex-hash>  <filename>
     * ```
     *
     * Both GNU coreutils two-space format and BSD single-space format are
     * accepted. Blank lines and lines that do not match are skipped with
     * a warning.
     */
    async parseSha256Sums(sha256sumsPath: string): Promise<Map<string, string>> {
        const content = await fs.promises.readFile(sha256sumsPath, 'utf-8');
        const entries = new Map<string, string>();

        const lines = content.split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length === 0) {
                continue;
            }

            // Match: <64 hex chars> followed by one or more spaces and a filename.
            // The GNU format uses two spaces (or a space and asterisk for binary mode);
            // BSD format uses a single space. We accept all variants.
            const match = line.match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
            if (!match) {
                this.logger.warn(
                    `SHA256SUMS.txt line ${i + 1}: unrecognised format, skipping: "${line}"`,
                );
                continue;
            }

            const hash = match[1].toLowerCase();
            const filename = match[2].trim();

            if (entries.has(filename)) {
                this.logger.warn(
                    `SHA256SUMS.txt line ${i + 1}: duplicate entry for "${filename}", ` +
                    'using latest value',
                );
            }

            entries.set(filename, hash);
        }

        this.logger.info(`Parsed ${entries.size} entry/entries from ${sha256sumsPath}`);
        return entries;
    }
}
