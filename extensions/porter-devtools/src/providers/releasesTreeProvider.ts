import * as vscode from 'vscode';

import { PorterRelease, ReleaseArtifact } from '../models/types';
import { ArtifactType } from '../models/enums';
import { Logger } from '../utils/logger';
import { formatBytes } from '../utils/platformUtils';
import { TREE_ITEM_CONTEXT } from '../constants';

/**
 * Discriminated-union payload carried by every tree item so commands
 * can act on the item without a secondary lookup.
 */
type ReleaseItemData =
    | { readonly kind: 'release'; readonly release: PorterRelease }
    | { readonly kind: 'artifact'; readonly artifact: ReleaseArtifact; readonly releaseTag: string };

/**
 * Tree item representing either a release or an individual artifact.
 */
export class ReleaseTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly data: ReleaseItemData,
    ) {
        super(label, collapsibleState);
        this.contextValue = data.kind === 'release'
            ? TREE_ITEM_CONTEXT.RELEASE
            : TREE_ITEM_CONTEXT.ARTIFACT;
    }
}

/** Tracks which artifacts have been downloaded and where they live on disk. */
interface DownloadedArtifact {
    readonly localPath: string;
}

/**
 * TreeDataProvider for the Releases sidebar panel.
 *
 * Root level shows releases sorted newest-first.  Expanding a release
 * lists its artifacts with size, download status, and quick-download action.
 */
export class ReleasesTreeProvider implements vscode.TreeDataProvider<ReleaseTreeItem> {

    private readonly _onDidChangeTreeData = new vscode.EventEmitter<ReleaseTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ReleaseTreeItem | undefined | void> =
        this._onDidChangeTreeData.event;

    private releases: readonly PorterRelease[] = [];

    /**
     * Map of `releaseTag -> artifactName -> DownloadedArtifact` to track
     * which artifacts have been downloaded (and their local path).
     */
    private readonly downloadedMap = new Map<string, Map<string, DownloadedArtifact>>();

    constructor(private readonly logger: Logger) {}

    /**
     * Fires the tree-change event so VS Code re-renders the view.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Replaces the stored release list with a new one and refreshes the tree.
     */
    setReleases(releases: PorterRelease[]): void {
        this.releases = Object.freeze([...releases]);
        this.logger.info(`ReleasesTreeProvider: loaded ${releases.length} release(s)`);
        this.refresh();
    }

    /**
     * Records that a specific artifact has been downloaded successfully.
     *
     * @param releaseTag  - The release version tag (e.g., "v0.3.2")
     * @param artifactName - The artifact filename (e.g., "motor_controller.bin")
     * @param localPath    - Absolute path where the artifact was saved
     */
    markArtifactDownloaded(releaseTag: string, artifactName: string, localPath: string): void {
        let tagMap = this.downloadedMap.get(releaseTag);
        if (!tagMap) {
            tagMap = new Map();
            this.downloadedMap.set(releaseTag, tagMap);
        }
        tagMap.set(artifactName, { localPath });
        this.logger.info(
            `ReleasesTreeProvider: marked ${artifactName} (${releaseTag}) as downloaded -> ${localPath}`,
        );
        this.refresh();
    }

    getTreeItem(element: ReleaseTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ReleaseTreeItem): ReleaseTreeItem[] {
        if (!element) {
            return this.getReleaseItems();
        }

        if (element.data.kind === 'release') {
            return this.getArtifactItems(element.data.release);
        }

        return [];
    }

    // ── private helpers ─────────────────────────────────────────────────

    private getReleaseItems(): ReleaseTreeItem[] {
        if (this.releases.length === 0) {
            const placeholder = new ReleaseTreeItem(
                'No releases loaded',
                vscode.TreeItemCollapsibleState.None,
                { kind: 'release', release: this.createEmptyRelease() },
            );
            placeholder.description = 'Run "Refresh Releases"';
            placeholder.iconPath = new vscode.ThemeIcon('info');
            placeholder.contextValue = TREE_ITEM_CONTEXT.CATEGORY;
            return [placeholder];
        }

        return this.releases.map((release, index) => this.createReleaseItem(release, index));
    }

    private createReleaseItem(release: PorterRelease, index: number): ReleaseTreeItem {
        const item = new ReleaseTreeItem(
            release.tag,
            vscode.TreeItemCollapsibleState.Collapsed,
            { kind: 'release', release },
        );

        // First release in the (already-sorted) list is "latest"
        const badges: string[] = [];
        if (index === 0 && !release.prerelease) {
            badges.push('latest');
        }
        if (release.prerelease) {
            badges.push('prerelease');
        }

        item.description = this.formatReleaseDescription(release, badges);
        item.tooltip = this.buildReleaseTooltip(release);
        item.iconPath = release.prerelease
            ? new vscode.ThemeIcon('tag', new vscode.ThemeColor('charts.yellow'))
            : new vscode.ThemeIcon('tag', new vscode.ThemeColor('charts.green'));

        // Expand the latest full release by default
        if (index === 0 && !release.prerelease) {
            item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }

        return item;
    }

    private getArtifactItems(release: PorterRelease): ReleaseTreeItem[] {
        if (release.assets.length === 0) {
            const empty = new ReleaseTreeItem(
                'No artifacts',
                vscode.TreeItemCollapsibleState.None,
                { kind: 'artifact', artifact: this.createEmptyArtifact(), releaseTag: release.tag },
            );
            empty.iconPath = new vscode.ThemeIcon('info');
            empty.contextValue = TREE_ITEM_CONTEXT.CATEGORY;
            return [empty];
        }

        return release.assets.map((artifact) => this.createArtifactItem(artifact, release.tag));
    }

    private createArtifactItem(artifact: ReleaseArtifact, releaseTag: string): ReleaseTreeItem {
        const item = new ReleaseTreeItem(
            artifact.name,
            vscode.TreeItemCollapsibleState.None,
            { kind: 'artifact', artifact, releaseTag },
        );

        const sizeLabel = formatBytes(artifact.size);
        const isDownloaded = this.isArtifactDownloaded(releaseTag, artifact.name) || artifact.downloaded;

        item.description = `(${sizeLabel})`;
        item.iconPath = isDownloaded
            ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
            : new vscode.ThemeIcon('cloud-download');
        item.tooltip = this.buildArtifactTooltip(artifact, releaseTag, isDownloaded);

        if (!isDownloaded) {
            item.command = {
                command: 'porterRobot.downloadArtifact',
                title: 'Download Artifact',
                arguments: [item],
            };
        }

        return item;
    }

    private isArtifactDownloaded(releaseTag: string, artifactName: string): boolean {
        return this.downloadedMap.get(releaseTag)?.has(artifactName) ?? false;
    }

    private formatReleaseDescription(release: PorterRelease, badges: string[]): string {
        const parts: string[] = [];
        if (badges.length > 0) {
            parts.push(`(${badges.join(', ')})`);
        }
        parts.push(this.formatDate(release.date));
        return parts.join('  ');
    }

    private formatDate(isoDate: string): string {
        try {
            const date = new Date(isoDate);
            return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        } catch {
            return isoDate;
        }
    }

    private buildReleaseTooltip(release: PorterRelease): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${release.name || release.tag}**\n\n`);
        md.appendMarkdown(`- **Tag:** ${release.tag}\n`);
        md.appendMarkdown(`- **Date:** ${this.formatDate(release.date)}\n`);
        md.appendMarkdown(`- **Artifacts:** ${release.assets.length}\n`);
        if (release.prerelease) {
            md.appendMarkdown(`- **Pre-release:** Yes\n`);
        }
        if (release.body) {
            md.appendMarkdown(`\n---\n\n${release.body}\n`);
        }
        return md;
    }

    private buildArtifactTooltip(
        artifact: ReleaseArtifact,
        releaseTag: string,
        isDownloaded: boolean,
    ): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${artifact.name}**\n\n`);
        md.appendMarkdown(`- **Size:** ${formatBytes(artifact.size)}\n`);
        md.appendMarkdown(`- **Type:** ${this.formatArtifactTypeLabel(artifact.type)}\n`);
        md.appendMarkdown(`- **Release:** ${releaseTag}\n`);
        md.appendMarkdown(`- **Downloaded:** ${isDownloaded ? 'Yes' : 'No'}\n`);

        const localInfo = this.downloadedMap.get(releaseTag)?.get(artifact.name);
        if (localInfo) {
            md.appendMarkdown(`- **Local path:** ${localInfo.localPath}\n`);
        } else if (artifact.localPath) {
            md.appendMarkdown(`- **Local path:** ${artifact.localPath}\n`);
        }

        return md;
    }

    private formatArtifactTypeLabel(type: ArtifactType): string {
        switch (type) {
            case ArtifactType.MotorFirmware:
                return 'Motor Controller Firmware';
            case ArtifactType.SensorFirmware:
                return 'Sensor Fusion Firmware';
            case ArtifactType.MotorDebug:
                return 'Motor Controller Debug (ELF)';
            case ArtifactType.SensorDebug:
                return 'Sensor Fusion Debug (ELF)';
            case ArtifactType.DockerImage:
                return 'Docker Image';
            case ArtifactType.FlutterGui:
                return 'Flutter GUI Bundle';
            case ArtifactType.Checksum:
                return 'SHA256 Checksums';
            case ArtifactType.BuildInfo:
                return 'Build Information';
            case ArtifactType.Unknown:
            default:
                return 'Unknown';
        }
    }

    /** Creates a sentinel release object used only for the "No releases" placeholder. */
    private createEmptyRelease(): PorterRelease {
        return {
            tag: '',
            name: '',
            date: '',
            prerelease: false,
            body: '',
            htmlUrl: '',
            assets: [],
        };
    }

    /** Creates a sentinel artifact object used only for the "No artifacts" placeholder. */
    private createEmptyArtifact(): ReleaseArtifact {
        return {
            name: '',
            size: 0,
            downloadUrl: '',
            type: ArtifactType.Unknown,
            downloaded: false,
        };
    }
}
