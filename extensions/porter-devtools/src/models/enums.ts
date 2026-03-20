export enum DeviceType {
    MotorController = 'motor_controller',
    SensorFusion = 'sensor_fusion',
    Unknown = 'unknown',
}

export enum ConnectionStatus {
    Connected = 'connected',
    Disconnected = 'disconnected',
    Flashing = 'flashing',
    Deploying = 'deploying',
    Error = 'error',
}

export enum ArtifactType {
    MotorFirmware = 'motor_firmware',
    SensorFirmware = 'sensor_firmware',
    MotorDebug = 'motor_debug',
    SensorDebug = 'sensor_debug',
    DockerImage = 'docker_image',
    FlutterGui = 'flutter_gui',
    Checksum = 'checksum',
    BuildInfo = 'build_info',
    Unknown = 'unknown',
}

export enum FlashMode {
    Esptool = 'esptool',
    West = 'west',
}

export enum FlashState {
    Idle = 'idle',
    Connecting = 'connecting',
    Erasing = 'erasing',
    Writing = 'writing',
    Verifying = 'verifying',
    Complete = 'complete',
    Failed = 'failed',
}

export enum DeployState {
    Idle = 'idle',
    Connecting = 'connecting',
    Uploading = 'uploading',
    Loading = 'loading',
    Restarting = 'restarting',
    Complete = 'complete',
    Failed = 'failed',
}
