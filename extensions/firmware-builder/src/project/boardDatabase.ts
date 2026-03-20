// Copyright 2026 VirtusCo
// Board database — capabilities and peripheral availability per board

export interface PeripheralCapability {
  type: string;           // matches node type in registry
  label: string;
  instances?: number;     // e.g., 3 UARTs
  channels?: number;      // e.g., 8 PWM channels
  pins?: number;          // e.g., 40 GPIO pins
  maxFrequency?: string;  // e.g., "80MHz"
  notes?: string;
}

export interface BoardDefinition {
  id: string;
  name: string;
  vendor: string;
  arch: string;
  cpu: string;
  flash: string;
  ram: string;
  description: string;
  westBoard: string;      // exact `west build -b <this>` value
  peripherals: PeripheralCapability[];
  supportedNodeTypes: string[];  // which node types are compatible
}

// ── ESP32 Family ─────────────────────────────────────────────────────

const esp32DevkitcWroom: BoardDefinition = {
  id: 'esp32_devkitc_wroom',
  name: 'ESP32-DevKitC (WROOM)',
  vendor: 'Espressif',
  arch: 'Xtensa',
  cpu: 'Xtensa LX6 Dual Core @ 240MHz',
  flash: '4 MB',
  ram: '520 KB SRAM',
  description: 'General-purpose ESP32 development board with WROOM module',
  westBoard: 'esp32_devkitc_wroom',
  peripherals: [
    { type: 'gpio', label: 'GPIO', pins: 34, notes: 'GPIO0-39 (6 input-only: 34-39)' },
    { type: 'pwm', label: 'LEDC PWM', channels: 8, notes: '8 channels, 2 timers' },
    { type: 'uart', label: 'UART', instances: 3, notes: 'UART0 (console), UART1, UART2' },
    { type: 'i2c', label: 'I2C', instances: 2, notes: 'I2C0, I2C1 (any GPIO)' },
    { type: 'spi', label: 'SPI', instances: 3, notes: 'SPI1 (flash), SPI2 (HSPI), SPI3 (VSPI)' },
    { type: 'adc', label: 'ADC', channels: 18, notes: 'ADC1 (8ch), ADC2 (10ch, shared with WiFi)' },
    { type: 'ble', label: 'Bluetooth LE 4.2', notes: 'BLE + Classic' },
    { type: 'wifi', label: 'WiFi 802.11 b/g/n', notes: '2.4GHz' },
    { type: 'dac', label: 'DAC', channels: 2, notes: 'GPIO25, GPIO26' },
    { type: 'touch', label: 'Touch Sensors', channels: 10, notes: 'T0-T9' },
  ],
  supportedNodeTypes: [
    'gpio_output', 'gpio_input', 'pwm_channel', 'uart_bus', 'i2c_bus',
    'spi_bus', 'adc_channel', 'ble_peripheral',
    'zephyr_thread', 'zephyr_timer', 'zephyr_semaphore', 'zephyr_mutex',
    'zephyr_work', 'zephyr_msgq', 'zephyr_fifo',
    'bts7960_motor', 'tof_sensor', 'ultrasonic_sensor',
    'sensor_fusion_uart', 'kalman_filter',
    'west_build', 'west_flash', 'serial_monitor', 'menuconfig', 'west_clean',
  ],
};

const esp32s3DevkitcN8r8: BoardDefinition = {
  id: 'esp32s3_devkitc',
  name: 'ESP32-S3-DevKitC',
  vendor: 'Espressif',
  arch: 'Xtensa',
  cpu: 'Xtensa LX7 Dual Core @ 240MHz',
  flash: '8 MB',
  ram: '512 KB SRAM + 8 MB PSRAM',
  description: 'ESP32-S3 with AI acceleration, USB OTG, and more GPIO',
  westBoard: 'esp32s3_devkitc/esp32s3/procpu',
  peripherals: [
    { type: 'gpio', label: 'GPIO', pins: 45, notes: 'GPIO0-48 (some strapping)' },
    { type: 'pwm', label: 'LEDC PWM', channels: 8, notes: '8 channels, 4 timers' },
    { type: 'uart', label: 'UART', instances: 3, notes: 'UART0 (console), UART1, UART2' },
    { type: 'i2c', label: 'I2C', instances: 2, notes: 'I2C0, I2C1 (any GPIO)' },
    { type: 'spi', label: 'SPI', instances: 3, notes: 'SPI1 (flash), SPI2, SPI3' },
    { type: 'adc', label: 'ADC', channels: 20, notes: 'ADC1 (10ch), ADC2 (10ch)' },
    { type: 'ble', label: 'Bluetooth LE 5.0', notes: 'BLE only (no Classic)' },
    { type: 'wifi', label: 'WiFi 802.11 b/g/n', notes: '2.4GHz' },
    { type: 'usb', label: 'USB OTG', notes: 'Native USB (CDC ACM)' },
  ],
  supportedNodeTypes: [
    'gpio_output', 'gpio_input', 'pwm_channel', 'uart_bus', 'i2c_bus',
    'spi_bus', 'adc_channel', 'ble_peripheral',
    'zephyr_thread', 'zephyr_timer', 'zephyr_semaphore', 'zephyr_mutex',
    'zephyr_work', 'zephyr_msgq', 'zephyr_fifo',
    'bts7960_motor', 'tof_sensor', 'ultrasonic_sensor',
    'sensor_fusion_uart', 'kalman_filter',
    'west_build', 'west_flash', 'serial_monitor', 'menuconfig', 'west_clean',
  ],
};

const esp32c3Devkitm: BoardDefinition = {
  id: 'esp32c3_devkitm',
  name: 'ESP32-C3-DevKitM',
  vendor: 'Espressif',
  arch: 'RISC-V',
  cpu: 'RISC-V Single Core @ 160MHz',
  flash: '4 MB',
  ram: '400 KB SRAM',
  description: 'Low-cost RISC-V ESP32 with WiFi and BLE 5.0',
  westBoard: 'esp32c3_devkitm',
  peripherals: [
    { type: 'gpio', label: 'GPIO', pins: 22, notes: 'GPIO0-21' },
    { type: 'pwm', label: 'LEDC PWM', channels: 6, notes: '6 channels' },
    { type: 'uart', label: 'UART', instances: 2, notes: 'UART0 (console), UART1' },
    { type: 'i2c', label: 'I2C', instances: 1, notes: 'I2C0 (any GPIO)' },
    { type: 'spi', label: 'SPI', instances: 2, notes: 'SPI1 (flash), SPI2' },
    { type: 'adc', label: 'ADC', channels: 6, notes: 'ADC1 (5ch), ADC2 (1ch)' },
    { type: 'ble', label: 'Bluetooth LE 5.0', notes: 'BLE only' },
    { type: 'wifi', label: 'WiFi 802.11 b/g/n', notes: '2.4GHz' },
    { type: 'usb', label: 'USB Serial/JTAG', notes: 'Built-in' },
  ],
  supportedNodeTypes: [
    'gpio_output', 'gpio_input', 'pwm_channel', 'uart_bus', 'i2c_bus',
    'spi_bus', 'adc_channel', 'ble_peripheral',
    'zephyr_thread', 'zephyr_timer', 'zephyr_semaphore', 'zephyr_mutex',
    'zephyr_work', 'zephyr_msgq', 'zephyr_fifo',
    'tof_sensor', 'ultrasonic_sensor', 'kalman_filter',
    'west_build', 'west_flash', 'serial_monitor', 'menuconfig', 'west_clean',
  ],
};

// ── Nordic nRF Family ────────────────────────────────────────────────

const nrf52840dk: BoardDefinition = {
  id: 'nrf52840dk_nrf52840',
  name: 'nRF52840 DK',
  vendor: 'Nordic',
  arch: 'ARM',
  cpu: 'Cortex-M4F @ 64MHz',
  flash: '1 MB',
  ram: '256 KB',
  description: 'Nordic nRF52840 development kit — BLE 5.0, Thread, Zigbee',
  westBoard: 'nrf52840dk_nrf52840',
  peripherals: [
    { type: 'gpio', label: 'GPIO', pins: 48, notes: 'P0.00-P1.15' },
    { type: 'pwm', label: 'PWM', channels: 4, instances: 4, notes: '4 instances × 4 channels' },
    { type: 'uart', label: 'UARTE', instances: 2, notes: 'EasyDMA UART' },
    { type: 'i2c', label: 'TWIM', instances: 2, notes: 'I2C master' },
    { type: 'spi', label: 'SPIM', instances: 4, notes: 'SPI master' },
    { type: 'adc', label: 'SAADC', channels: 8, notes: '12-bit, 8 channels' },
    { type: 'ble', label: 'Bluetooth LE 5.0', notes: 'BLE + Thread + Zigbee' },
    { type: 'usb', label: 'USB 2.0', notes: 'Full speed' },
  ],
  supportedNodeTypes: [
    'gpio_output', 'gpio_input', 'pwm_channel', 'uart_bus', 'i2c_bus',
    'spi_bus', 'adc_channel', 'ble_peripheral',
    'zephyr_thread', 'zephyr_timer', 'zephyr_semaphore', 'zephyr_mutex',
    'zephyr_work', 'zephyr_msgq', 'zephyr_fifo',
    'tof_sensor', 'kalman_filter',
    'west_build', 'west_flash', 'serial_monitor', 'menuconfig', 'west_clean',
  ],
};

// ── STM32 Family ─────────────────────────────────────────────────────

const stm32f411Discovery: BoardDefinition = {
  id: 'stm32f411e_disco',
  name: 'STM32F411E Discovery',
  vendor: 'STMicroelectronics',
  arch: 'ARM',
  cpu: 'Cortex-M4F @ 100MHz',
  flash: '512 KB',
  ram: '128 KB',
  description: 'STM32F411 discovery board with accelerometer, audio, and USB OTG',
  westBoard: 'stm32f411e_disco',
  peripherals: [
    { type: 'gpio', label: 'GPIO', pins: 50, notes: 'PA0-PD15' },
    { type: 'pwm', label: 'PWM', channels: 16, instances: 4, notes: 'TIM1-TIM5 channels' },
    { type: 'uart', label: 'USART', instances: 3, notes: 'USART1, USART2, USART6' },
    { type: 'i2c', label: 'I2C', instances: 3, notes: 'I2C1-I2C3' },
    { type: 'spi', label: 'SPI', instances: 5, notes: 'SPI1-SPI5' },
    { type: 'adc', label: 'ADC', channels: 16, notes: '12-bit, 16 channels' },
    { type: 'usb', label: 'USB OTG FS', notes: 'Full speed' },
  ],
  supportedNodeTypes: [
    'gpio_output', 'gpio_input', 'pwm_channel', 'uart_bus', 'i2c_bus',
    'spi_bus', 'adc_channel',
    'zephyr_thread', 'zephyr_timer', 'zephyr_semaphore', 'zephyr_mutex',
    'zephyr_work', 'zephyr_msgq', 'zephyr_fifo',
    'tof_sensor', 'ultrasonic_sensor', 'kalman_filter',
    'west_build', 'west_flash', 'serial_monitor', 'menuconfig', 'west_clean',
  ],
};

// ── Board Registry ───────────────────────────────────────────────────

export const boardDatabase: Record<string, BoardDefinition> = {
  esp32_devkitc_wroom: esp32DevkitcWroom,
  esp32s3_devkitc: esp32s3DevkitcN8r8,
  esp32c3_devkitm: esp32c3Devkitm,
  nrf52840dk_nrf52840: nrf52840dk,
  stm32f411e_disco: stm32f411Discovery,
};

export const boardList: BoardDefinition[] = Object.values(boardDatabase);

export function getBoardById(id: string): BoardDefinition | undefined {
  return boardDatabase[id];
}
