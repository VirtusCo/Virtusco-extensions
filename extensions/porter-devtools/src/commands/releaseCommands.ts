import * as vscode from 'vscode';
import * as fs from 'fs';

import { GitHubService } from '../services/githubService';
import { ChecksumService } from '../services/checksumService';
import { ReleasesTreeProvider } from '../providers/releasesTreeProvider';
import { Logger } from '../utils/logger';
import { ReleaseArtifact, PorterRelease, ChecksumResult } from '../models/types';
import { Settings } from '../config/settings';
import { formatBytes } from '../utils/platformUtils';

// ── Dependencies interface ──────────────────────────────────────────────

interface ReleaseCommandDeps {
    readonly githubService: GitHubService;
    readonly checksumService: ChecksumService;
    readonly releasesTreeProvider: ReleasesTreeProvider;
    readonly logger: Logger;
}

/**
 * Tree item shape expected from the ReleasesTreeProvider.
 *
 * Release tree items carry metadata about the artifact and release they
 * represent, allowing download commands to retrieve the necessary context
 * from the tree-view click event.
 */
interface ReleaseTreeItem extends vscode.TreeItem {
    /** The specific artifact this item represents (if it is an artifact node). */
    readonly artifact?: ReleaseArtifact;
    /** The release this item (or its parent) belongs to. */
    readonly release?: PorterRelease;
    /** The release tag (e.g. "v0.3.2"). Populated on both release and artifact nodes. */
    readonly releaseTag?: string;
}

// ── Registration ────────────────────────────────────────────────────────

/**
 * Registers all GitHub release-related commands: refresh, download, and
 * checksum verification.
 */
export function register(deps: ReleaseCommandDeps): vscode.Disposable[] {
    const { githubService, checksumService, releasesTreeProvider, logger } = deps;

    return [
        vscode.commands.registerCommand(
            'porterRobot.refreshReleases',
            () => refreshReleases(githubService, releasesTreeProvider, logger),
        ),

        vscode.commands.registerCommand(
            'porterRobot.downloadArtifact',
            (item: ReleaseTreeItem) =>
                downloadArtifact(item, githubService, checksumService, releasesTreeProvider, logger),
        ),

        vscode.commands.registerCommand(
            'porterRobot.downloadAllArtifacts',
            (item: ReleaseTreeItem) =>
                downloadAllArtifacts(item, githubService, checksumService, releasesTreeProvider, logger),
        ),

        vscode.commands.registerCommand(
            'porterRobot.verifyChecksums',
            () => verifyChecksums(checksumService, logger),
        ),
    ];
}

// ── Refresh releases ────────────────────────────────────────────────────

async function refreshReleases(
    githubService: GitHubService,
    releasesTreeProvider: ReleasesTreeProvider,
    logger: Logger,
): Promise<void> {
    logger.info('Refreshing releases from GitHub');

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Fetching releases...',
            cancellable: false,
        },
        async (progress) => {
            try {
                progress.report({ message: 'Contacting GitHub...' });

                const releases = await githubService.listReleases();

                releasesTreeProvider.setReleases(releases);

                const count = releases.length;
                const rateLimitInfo = githubService.getRateLimitRemaining();
                const rateLimitSuffix = rateLimitInfo !== undefined
                    ? ` (API rate limit: ${rateLimitInfo} remaining)`
                    : '';

                vscode.window.showInformationMessage(
                    `Loaded ${count} release${count !== 1 ? 's' : ''} from GitHub.${rateLimitSuffix}`,
                );
                logger.info(`Refreshed ${count} release(s)`);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                logger.error('Failed to refresh releases', message);
                vscode.window.showErrorMessage(
                    `Failed to fetch releases: ${message}`,
                    'Show Output',
                ).then((action) => {
                    if (action === 'Show Output') {
                        logger.show();
                    }
                });
            }
        },
    );
}

// ── Download single artifact ────────────────────────────────────────────

async function downloadArtifact(
    item: ReleaseTreeItem,
    githubService: GitHubService,
    checksumService: ChecksumService,
    releasesTreeProvider: ReleasesTreeProvider,
    logger: Logger,
): Promise<void> {
    const artifact = item.artifact;
    const releaseTag = item.releaseTag;

    if (!artifact || !releaseTag) {
        vscode.window.showErrorMessage(
            'No artifact information available. Try refreshing the releases list.',
        );
        return;
    }

    logger.info(`Downloading artifact: ${artifact.name} from release ${releaseTag}`);

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Downloading ${artifact.name}`,
            cancellable: true,
        },
        async (progress, token) => {
            try {
                const localPath = await githubService.downloadArtifact(
                    artifact,
                    releaseTag,
                    (downloadProgress) => {
                        if (token.isCancellationRequested) {
                            return;
                        }

                        const pct = downloadProgress.percentage;
                        const downloaded = formatBytes(downloadProgress.bytesDownloaded);
                        const total = downloadProgress.totalBytes > 0
                            ? formatBytes(downloadProgress.totalBytes)
                            : 'unknown size';

                        progress.report({
                            message: `${downloaded} / ${total} (${pct}%)`,
                        });
                    },
                );

                if (token.isCancellationRequested) {
                    // Clean up partially downloaded file
                    try {
                        await fs.promises.unlink(localPath);
                    } catch {
                        // File may not exist yet
                    }
                    vscode.window.showWarningMessage(`Download of ${artifact.name} was cancelled.`);
                    return;
                }

                // Auto-verify checksum if SHA256SUMS.txt is available
                const checksumVerified = await autoVerifyChecksum(
                    localPath,
                    artifact.name,
                    releaseTag,
                    checksumService,
                    logger,
                );

                // Update tree to show downloaded status
                releasesTreeProvider.markArtifactDownloaded(releaseTag, artifact.name, localPath);

                if (checksumVerified === true) {
                    vscode.window.showInformationMessage(
                        `Downloaded and verified: ${artifact.name}`,
                    );
                } else if (checksumVerified === false) {
                    vscode.window.showWarningMessage(
                        `Downloaded ${artifact.name} but checksum verification FAILED. ` +
                        'The file may be corrupted. Consider re-downloading.',
                    );
                } else {
                    // checksumVerified === undefined — no checksum available
                    vscode.window.showInformationMessage(
                        `Downloaded: ${artifact.name}`,
                    );
                }

                logger.info(`Download complete: ${artifact.name} -> ${localPath}`);
            } catch (err: unknown) {
                if (token.isCancellationRequested) {
                    vscode.window.showWarningMessage(`Download of ${artifact.name} was cancelled.`);
                    return;
                }

                const message = err instanceof Error ? err.message : String(err);
                logger.error(`Failed to download ${artifact.name}`, message);
                vscode.window.showErrorMessage(
                    `Failed to download ${artifact.name}: ${message}`,
                    'Show Output',
                ).then((action) => {
                    if (action === 'Show Output') {
                        logger.show();
                    }
                });
            }
        },
    );
}

// ── Download all artifacts ──────────────────────────────────────────────

async function downloadAllArtifacts(
    item: ReleaseTreeItem,
    githubService: GitHubService,
    checksumService: ChecksumService,
    releasesTreeProvider: ReleasesTreeProvider,
    logger: Logger,
): Promise<void> {
    const release = item.release;
    const releaseTag = item.releaseTag;

    if (!release || !releaseTag) {
        vscode.window.showErrorMessage(
            'No release information available. Try refreshing the releases list.',
        );
        return;
    }

    const assetCount = release.assets.length;
    if (assetCount === 0) {
        vscode.window.showInformationMessage('This release has no downloadable artifacts.');
        return;
    }

    logger.info(`Downloading all ${assetCount} artifact(s) for release ${releaseTag}`);

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Downloading ${releaseTag} (${assetCount} artifacts)`,
            cancellable: true,
        },
        async (progress, token) => {
            let downloadedCount = 0;
            let failedCount = 0;

            try {
                const paths = await githubService.downloadAllArtifacts(
                    release,
                    (artifact, downloadProgress) => {
                        if (token.isCancellationRequested) {
                            return;
                        }

                        const pct = downloadProgress.percentage;
                        progress.report({
                            message: `${artifact.name} (${pct}%) — ${downloadedCount + 1}/${assetCount}`,
                        });
                    },
                );

                downloadedCount = paths.length;
                failedCount = assetCount - downloadedCount;

                // Mark all successfully downloaded artifacts in the tree
                for (const artifact of release.assets) {
                    const localPath = Settings.resolveArtifactPath(releaseTag, artifact.name);
                    try {
                        await fs.promises.access(localPath, fs.constants.R_OK);
                        releasesTreeProvider.markArtifactDownloaded(releaseTag, artifact.name, localPath);
                    } catch {
                        // File was not downloaded successfully
                    }
                }

                // Auto-verify all checksums
                const versionDir = Settings.resolveVersionDir(releaseTag);
                const checksumResults = await runChecksumVerification(versionDir, checksumService, logger);

                if (token.isCancellationRequested) {
                    vscode.window.showWarningMessage(
                        `Download of ${releaseTag} was cancelled. ${downloadedCount} file(s) were downloaded.`,
                    );
                    return;
                }

                // Build summary message
                const summaryParts: string[] = [
                    `Downloaded ${downloadedCount}/${assetCount} artifact(s) for ${releaseTag}.`,
                ];

                if (failedCount > 0) {
                    summaryParts.push(`${failedCount} download(s) failed.`);
                }

                if (checksumResults.length > 0) {
                    const passed = checksumResults.filter((r) => r.match).length;
                    const failed = checksumResults.filter((r) => !r.match).length;
                    summaryParts.push(`Checksums: ${passed} passed, ${failed} failed.`);
                }

                const severity = failedCount > 0 || checksumResults.some((r) => !r.match)
                    ? 'warning'
                    : 'info';

                if (severity === 'warning') {
                    vscode.window.showWarningMessage(summaryParts.join(' '), 'Show Output')
                        .then((action) => {
                            if (action === 'Show Output') {
                                logger.show();
                            }
                        });
                } else {
                    vscode.window.showInformationMessage(summaryParts.join(' '));
                }
            } catch (err: unknown) {
                if (token.isCancellationRequested) {
                    vscode.window.showWarningMessage(
                        `Download of ${releaseTag} was cancelled.`,
                    );
                    return;
                }

                const message = err instanceof Error ? err.message : String(err);
                logger.error(`Failed to download artifacts for ${releaseTag}`, message);
                vscode.window.showErrorMessage(
                    `Failed to download artifacts: ${message}`,
                    'Show Output',
                ).then((action) => {
                    if (action === 'Show Output') {
                        logger.show();
                    }
                });
            }
        },
    );
}

// ── Verify checksums ────────────────────────────────────────────────────

async function verifyChecksums(
    checksumService: ChecksumService,
    logger: Logger,
): Promise<void> {
    logger.info('Manual checksum verification requested');

    // Find the latest downloaded version directory
    const versionDir = await findLatestVersionDir(logger);
    if (!versionDir) {
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Verifying checksums...',
            cancellable: false,
        },
        async (progress) => {
            try {
                progress.report({ message: 'Computing SHA256 hashes...' });

                const results = await checksumService.verifyAll(versionDir);

                if (results.length === 0) {
                    vscode.window.showWarningMessage(
                        'No checksums to verify. SHA256SUMS.txt not found or empty in the latest downloaded release.',
                    );
                    return;
                }

                displayChecksumResults(results, logger);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                logger.error('Checksum verification failed', message);
                vscode.window.showErrorMessage(
                    `Checksum verification failed: ${message}`,
                    'Show Output',
                ).then((action) => {
                    if (action === 'Show Output') {
                        logger.show();
                    }
                });
            }
        },
    );
}

// ── Utility functions ───────────────────────────────────────────────────

/**
 * Auto-verifies a single downloaded file against SHA256SUMS.txt in the
 * same version directory.
 *
 * @returns `true` if checksum matches, `false` if mismatch, `undefined`
 *          if no checksum is available.
 */
async function autoVerifyChecksum(
    localPath: string,
    filename: string,
    releaseTag: string,
    checksumService: ChecksumService,
    logger: Logger,
): Promise<boolean | undefined> {
    const versionDir = Settings.resolveVersionDir(releaseTag);
    const sumsPath = `${versionDir}/SHA256SUMS.txt`;

    try {
        await fs.promises.access(sumsPath, fs.constants.R_OK);
    } catch {
        // SHA256SUMS.txt not yet downloaded — skip verification
        logger.info(`SHA256SUMS.txt not available for ${releaseTag}, skipping auto-verify`);
        return undefined;
    }

    try {
        const expectedMap = await checksumService.parseSha256Sums(sumsPath);
        const expectedHash = expectedMap.get(filename);

        if (!expectedHash) {
            logger.info(`No checksum entry for ${filename} in SHA256SUMS.txt`);
            return undefined;
        }

        const actualHash = await checksumService.computeSha256(localPath);
        const match = actualHash === expectedHash;

        if (match) {
            logger.info(`Auto-verify checksum OK: ${filename}`);
        } else {
            logger.error(
                `Auto-verify checksum MISMATCH: ${filename} — ` +
                `expected ${expectedHash}, got ${actualHash}`,
            );
        }

        return match;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(`Auto-verify checksum error for ${filename}: ${message}`);
        return undefined;
    }
}

/**
 * Runs full checksum verification on a version directory and returns results.
 * Returns an empty array on error.
 */
async function runChecksumVerification(
    versionDir: string,
    checksumService: ChecksumService,
    logger: Logger,
): Promise<ChecksumResult[]> {
    try {
        return await checksumService.verifyAll(versionDir);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(`Checksum verification skipped: ${message}`);
        return [];
    }
}

/**
 * Finds the most recently modified version directory in the artifacts folder.
 */
async function findLatestVersionDir(logger: Logger): Promise<string | undefined> {
    const artifactsDir = Settings.artifactsDir;

    try {
        await fs.promises.access(artifactsDir, fs.constants.R_OK);
    } catch {
        vscode.window.showErrorMessage(
            `Artifacts directory not found: ${artifactsDir}. ` +
            'Download a release first using the Releases panel.',
        );
        return undefined;
    }

    try {
        const entries = await fs.promises.readdir(artifactsDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory());

        if (dirs.length === 0) {
            vscode.window.showErrorMessage(
                'No downloaded releases found. Download a release first using the Releases panel.',
            );
            return undefined;
        }

        // Sort by modification time, newest first
        const withStats = await Promise.all(
            dirs.map(async (d) => {
                const fullPath = `${artifactsDir}/${d.name}`;
                const stat = await fs.promises.stat(fullPath);
                return { name: d.name, path: fullPath, mtime: stat.mtimeMs };
            }),
        );
        withStats.sort((a, b) => b.mtime - a.mtime);

        const latest = withStats[0];
        logger.info(`Latest version directory: ${latest.path} (${latest.name})`);
        return latest.path;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to find latest version directory', message);
        vscode.window.showErrorMessage(
            `Failed to read artifacts directory: ${message}`,
        );
        return undefined;
    }
}

/**
 * Displays checksum verification results as an information or warning message,
 * with detailed output logged to the output channel.
 */
function displayChecksumResults(results: ChecksumResult[], logger: Logger): void {
    const passed = results.filter((r) => r.match);
    const failed = results.filter((r) => !r.match);

    // Log detailed results
    logger.info('--- Checksum Verification Results ---');
    for (const result of results) {
        const status = result.match ? 'OK' : 'MISMATCH';
        logger.info(`  [${status}] ${result.file}`);
        if (!result.match) {
            logger.info(`    Expected: ${result.expected}`);
            logger.info(`    Actual:   ${result.actual || '(file not found)'}`);
        }
    }
    logger.info(`--- ${passed.length} passed, ${failed.length} failed ---`);

    if (failed.length === 0) {
        vscode.window.showInformationMessage(
            `All ${passed.length} checksum(s) verified successfully.`,
        );
    } else {
        const failedNames = failed.map((r) => r.file).join(', ');
        vscode.window.showWarningMessage(
            `Checksum verification: ${passed.length} passed, ${failed.length} failed. ` +
            `Failed files: ${failedNames}`,
            'Show Output',
        ).then((action) => {
            if (action === 'Show Output') {
                logger.show();
            }
        });
    }
}
