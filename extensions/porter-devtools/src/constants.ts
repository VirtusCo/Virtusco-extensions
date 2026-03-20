export const EXTENSION_ID = 'porter-devtools';
export const EXTENSION_NAME = 'Porter DevTools';
export const OUTPUT_CHANNEL_NAME = 'Porter Robot';

export const GITHUB_OWNER = 'austin207';
export const GITHUB_REPO = 'Porter-ROS';

export const ESP32_CHIP = 'esp32';
export const ESP32_FLASH_ADDRESS = '0x1000';
export const ESP32_FLASH_BAUD = 460800;
export const ESP32_MONITOR_BAUD = 115200;

export const DEVICE_POLL_INTERVAL_MS = 3000;

export const USB_VID_PID = {
    CP2102: { vendorId: '10c4', productId: 'ea60' },
    CH340: { vendorId: '1a86', productId: '7523' },
    ESPRESSIF: { vendorId: '303a', productId: '1001' },
} as const;

export const KNOWN_VENDOR_IDS = new Set([
    USB_VID_PID.CP2102.vendorId,
    USB_VID_PID.CH340.vendorId,
    USB_VID_PID.ESPRESSIF.vendorId,
]);

export const PROTOCOL_HEADER = Buffer.from([0xaa, 0x55]);
export const CMD_MOTOR_STATUS = 0x03;
export const CMD_SENSOR_STATUS = 0x14;
export const CRC16_POLY = 0x1021;
export const CRC16_INIT = 0xffff;

export const ARTIFACT_PATTERNS = {
    MOTOR_FIRMWARE: /^motor_controller\.bin$/,
    SENSOR_FIRMWARE: /^sensor_fusion\.bin$/,
    MOTOR_DEBUG: /^motor_controller\.elf$/,
    SENSOR_DEBUG: /^sensor_fusion\.elf$/,
    DOCKER_IMAGE: /^porter-robot-[\d.]+\.tar\.gz$/,
    FLUTTER_GUI: /^porter-gui-linux-x64-[\d.]+\.tar\.gz$/,
    CHECKSUM: /^SHA256SUMS\.txt$/,
    BUILD_INFO: /^BUILD_INFO\.txt$/,
} as const;

export const ARTIFACTS_SUBDIR = 'artifacts';

export const SSH_CONNECT_TIMEOUT_MS = 10000;
export const SSH_TRANSFER_TIMEOUT_MS = 600000;
export const ESPTOOL_TIMEOUT_MS = 120000;
export const WEST_FLASH_TIMEOUT_MS = 120000;

export const TREE_ITEM_CONTEXT = {
    ESP32_DEVICE: 'esp32Device',
    RPI_TARGET: 'rpiTarget',
    RELEASE: 'release',
    ARTIFACT: 'artifact',
    ACTION: 'action',
    CATEGORY: 'category',
} as const;
