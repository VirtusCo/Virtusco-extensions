import * as vscode from 'vscode';
import { Octokit } from '@octokit/rest';

import { Settings } from '../config/settings';
import { Logger } from '../utils/logger';
import { downloadFile } from '../utils/downloader';
import { PorterRelease, ReleaseArtifact, DownloadProgress } from '../models/types';
import { ArtifactType } from '../models/enums';
import { ARTIFACT_PATTERNS } from '../constants';

/**
 * GitHub REST API service for fetching releases and downloading artifacts
 * from the Porter-ROS repository.
 *
 * Lazily initializes an Octokit client and re-creates it when the
 * configured auth token changes.
 */
export class GitHubService implements vscode.Disposable {
    private readonly logger: Logger;
    private client: Octokit | undefined;
    private lastToken: string | undefined;
    private rateLimitRemaining: number | undefined;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    // ── Octokit lifecycle ──────────────────────────────────────────────

    /**
     * Returns an Octokit instance, creating or re-creating it when the
     * configured token has changed since the last call.
     */
    private getClient(): Octokit {
        const token = Settings.github.token;

        if (this.client && token === this.lastToken) {
            return this.client;
        }

        this.lastToken = token;
        this.client = new Octokit({
            ...(token ? { auth: token } : {}),
            userAgent: 'Porter-DevTools-VSCode/0.1.0',
        });

        this.logger.info(
            token
                ? 'GitHub client initialised with auth token'
                : 'GitHub client initialised without auth token (rate-limited to 60 req/hr)',
        );

        return this.client;
    }

    // ── Public API ─────────────────────────────────────────────────────

    /**
     * Fetches a page of releases from GitHub and maps each release's
     * assets to strongly-typed {@link ReleaseArtifact} objects.
     */
    async listReleases(page = 1, perPage = 10): Promise<PorterRelease[]> {
        const owner = Settings.github.owner;
        const repo = Settings.github.repo;

        this.logger.info(`Fetching releases (page ${page}, perPage ${perPage}) from ${owner}/${repo}`);

        try {
            const client = this.getClient();
            const response = await client.repos.listReleases({
                owner,
                repo,
                page,
                per_page: perPage,
            });

            this.updateRateLimit(response.headers);

            const releases: PorterRelease[] = response.data.map((rel) => {
                const assets: ReleaseArtifact[] = rel.assets.map((asset) => ({
                    name: asset.name,
                    size: asset.size,
                    downloadUrl: asset.browser_download_url,
                    type: this.classifyArtifact(asset.name),
                    downloaded: false,
                }));

                return {
                    tag: rel.tag_name,
                    name: rel.name ?? rel.tag_name,
                    date: rel.published_at ?? rel.created_at,
                    prerelease: rel.prerelease,
                    body: rel.body ?? '',
                    htmlUrl: rel.html_url,
                    assets,
                };
            });

            this.logger.info(`Fetched ${releases.length} release(s)`);
            return releases;
        } catch (error: unknown) {
            this.handleApiError('listReleases', error);
            return [];
        }
    }

    /**
     * Convenience wrapper that returns the most recent release (the first
     * entry from the releases list endpoint), or `undefined` if none exist.
     */
    async getLatestRelease(): Promise<PorterRelease | undefined> {
        const owner = Settings.github.owner;
        const repo = Settings.github.repo;

        this.logger.info(`Fetching latest release from ${owner}/${repo}`);

        try {
            const client = this.getClient();
            const response = await client.repos.getLatestRelease({
                owner,
                repo,
            });

            this.updateRateLimit(response.headers);

            const rel = response.data;
            const assets: ReleaseArtifact[] = rel.assets.map((asset) => ({
                name: asset.name,
                size: asset.size,
                downloadUrl: asset.browser_download_url,
                type: this.classifyArtifact(asset.name),
                downloaded: false,
            }));

            const release: PorterRelease = {
                tag: rel.tag_name,
                name: rel.name ?? rel.tag_name,
                date: rel.published_at ?? rel.created_at,
                prerelease: rel.prerelease,
                body: rel.body ?? '',
                htmlUrl: rel.html_url,
                assets,
            };

            this.logger.info(`Latest release: ${release.tag}`);
            return release;
        } catch (error: unknown) {
            // GitHub returns 404 when the repo has no releases at all
            if (isOctokitError(error) && error.status === 404) {
                this.logger.info('No releases found');
                return undefined;
            }
            this.handleApiError('getLatestRelease', error);
            return undefined;
        }
    }

    /**
     * Downloads a single release artifact to the local artifacts directory
     * resolved via {@link Settings.resolveArtifactPath}.
     *
     * @returns The absolute local path the artifact was saved to.
     */
    async downloadArtifact(
        artifact: ReleaseArtifact,
        version: string,
        onProgress?: (progress: DownloadProgress) => void,
    ): Promise<string> {
        const destPath = Settings.resolveArtifactPath(version, artifact.name);

        this.logger.info(`Downloading artifact ${artifact.name} (${artifact.size} bytes) to ${destPath}`);

        const headers: Record<string, string> = {};
        const token = Settings.github.token;
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        try {
            await downloadFile(artifact.downloadUrl, destPath, headers, onProgress);
            this.logger.info(`Download complete: ${artifact.name}`);
            return destPath;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to download ${artifact.name}: ${message}`);
            throw error;
        }
    }

    /**
     * Downloads every asset attached to a release. Returns an array of
     * local file paths for the successfully downloaded artifacts.
     *
     * The optional `onProgress` callback is invoked per-artifact with the
     * download progress for that individual file.
     */
    async downloadAllArtifacts(
        release: PorterRelease,
        onProgress?: (artifact: ReleaseArtifact, progress: DownloadProgress) => void,
    ): Promise<string[]> {
        this.logger.info(`Downloading all artifacts for release ${release.tag} (${release.assets.length} assets)`);

        const paths: string[] = [];

        for (const artifact of release.assets) {
            try {
                const perArtifactProgress = onProgress
                    ? (progress: DownloadProgress) => onProgress(artifact, progress)
                    : undefined;

                const localPath = await this.downloadArtifact(artifact, release.tag, perArtifactProgress);
                paths.push(localPath);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Skipping ${artifact.name} — download failed: ${message}`);
                // Continue downloading remaining artifacts instead of aborting
            }
        }

        this.logger.info(`Downloaded ${paths.length}/${release.assets.length} artifact(s) for ${release.tag}`);
        return paths;
    }

    /**
     * Returns the number of API requests remaining in the current
     * rate-limit window, as reported by the most recent GitHub API
     * response. Returns `undefined` if no API call has been made yet.
     */
    getRateLimitRemaining(): number | undefined {
        return this.rateLimitRemaining;
    }

    // ── Disposable ─────────────────────────────────────────────────────

    dispose(): void {
        this.client = undefined;
        this.lastToken = undefined;
        this.rateLimitRemaining = undefined;
    }

    // ── Private helpers ────────────────────────────────────────────────

    /**
     * Classifies an asset filename against the known artifact patterns
     * defined in {@link ARTIFACT_PATTERNS}.
     */
    private classifyArtifact(name: string): ArtifactType {
        if (ARTIFACT_PATTERNS.MOTOR_FIRMWARE.test(name)) {
            return ArtifactType.MotorFirmware;
        }
        if (ARTIFACT_PATTERNS.SENSOR_FIRMWARE.test(name)) {
            return ArtifactType.SensorFirmware;
        }
        if (ARTIFACT_PATTERNS.MOTOR_DEBUG.test(name)) {
            return ArtifactType.MotorDebug;
        }
        if (ARTIFACT_PATTERNS.SENSOR_DEBUG.test(name)) {
            return ArtifactType.SensorDebug;
        }
        if (ARTIFACT_PATTERNS.DOCKER_IMAGE.test(name)) {
            return ArtifactType.DockerImage;
        }
        if (ARTIFACT_PATTERNS.FLUTTER_GUI.test(name)) {
            return ArtifactType.FlutterGui;
        }
        if (ARTIFACT_PATTERNS.CHECKSUM.test(name)) {
            return ArtifactType.Checksum;
        }
        if (ARTIFACT_PATTERNS.BUILD_INFO.test(name)) {
            return ArtifactType.BuildInfo;
        }

        this.logger.warn(`Unknown artifact type for filename: ${name}`);
        return ArtifactType.Unknown;
    }

    /**
     * Extracts the `x-ratelimit-remaining` header from an Octokit
     * response and caches it locally.
     */
    private updateRateLimit(headers: { [header: string]: string | number | undefined }): void {
        const remaining = headers['x-ratelimit-remaining'];
        if (remaining !== undefined) {
            this.rateLimitRemaining = parseInt(String(remaining), 10);
            this.logger.debug(`GitHub API rate limit remaining: ${this.rateLimitRemaining}`);

            if (this.rateLimitRemaining <= 10) {
                this.logger.warn(
                    `GitHub API rate limit is very low (${this.rateLimitRemaining} remaining). ` +
                    'Consider configuring a personal access token in porterRobot.github.token.',
                );
            }
        }
    }

    /**
     * Centralised error handler for Octokit API calls. Logs the error and
     * shows an appropriate VS Code notification.
     */
    private handleApiError(method: string, error: unknown): void {
        if (isOctokitError(error)) {
            const status = error.status;
            const message = error.message;

            this.logger.error(`GitHub API error in ${method}: HTTP ${status} — ${message}`);

            if (status === 401) {
                vscode.window.showErrorMessage(
                    'GitHub authentication failed. Check the token in porterRobot.github.token.',
                );
            } else if (status === 403) {
                vscode.window.showErrorMessage(
                    'GitHub API rate limit exceeded or access denied. ' +
                    'Set a personal access token in porterRobot.github.token to raise the limit.',
                );
            } else if (status === 404) {
                vscode.window.showErrorMessage(
                    `Repository ${Settings.github.owner}/${Settings.github.repo} not found. ` +
                    'Check porterRobot.github.owner and porterRobot.github.repo settings.',
                );
            } else {
                vscode.window.showErrorMessage(`GitHub API error (HTTP ${status}): ${message}`);
            }
        } else {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Unexpected error in ${method}: ${message}`);
            vscode.window.showErrorMessage(`Failed to contact GitHub: ${message}`);
        }
    }
}

// ── Type guard for Octokit errors ──────────────────────────────────────

interface OctokitError {
    status: number;
    message: string;
}

function isOctokitError(error: unknown): error is OctokitError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof (error as OctokitError).status === 'number' &&
        'message' in error &&
        typeof (error as OctokitError).message === 'string'
    );
}
