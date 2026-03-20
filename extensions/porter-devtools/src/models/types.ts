import { ArtifactType, ConnectionStatus, DeviceType, FlashMode } from './enums';

export interface PorterRelease {
    readonly tag: string;
    readonly name: string;
    readonly date: string;
    readonly prerelease: boolean;
    readonly body: string;
    readonly htmlUrl: string;
    readonly assets: readonly ReleaseArtifact[];
}

export interface ReleaseArtifact {
    readonly name: string;
    readonly size: number;
    readonly downloadUrl: string;
    readonly type: ArtifactType;
    readonly downloaded: boolean;
    readonly localPath?: string;
}

export interface SerialDevice {
    readonly port: string;
    readonly vendorId?: string;
    readonly productId?: string;
    readonly serialNumber?: string;
    readonly manufacturer?: string;
    readonly deviceType: DeviceType;
    readonly status: ConnectionStatus;
}

export interface RpiTarget {
    readonly host: string;
    readonly username: string;
    readonly authMethod: 'key' | 'password';
    readonly sshKeyPath?: string;
    readonly status: ConnectionStatus;
}

export interface FlashConfig {
    readonly port: string;
    readonly firmwarePath: string;
    readonly chip: string;
    readonly baudRate: number;
    readonly flashAddress: string;
    readonly mode: FlashMode;
    readonly buildDir?: string;
}

export interface FlashProgress {
    readonly state: string;
    readonly percentage: number;
    readonly message: string;
}

export interface DeployConfig {
    readonly host: string;
    readonly username: string;
    readonly sshKeyPath: string;
    readonly localPath: string;
    readonly remotePath: string;
    readonly dockerComposePath?: string;
}

export interface DeployProgress {
    readonly state: string;
    readonly percentage: number;
    readonly message: string;
    readonly bytesTransferred?: number;
    readonly totalBytes?: number;
}

export interface ChecksumResult {
    readonly file: string;
    readonly expected: string;
    readonly actual: string;
    readonly match: boolean;
}

export interface DeviceChangeEvent {
    readonly added: readonly SerialDevice[];
    readonly removed: readonly SerialDevice[];
}

export interface DownloadProgress {
    readonly bytesDownloaded: number;
    readonly totalBytes: number;
    readonly percentage: number;
}
