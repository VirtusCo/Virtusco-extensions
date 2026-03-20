// Copyright 2026 VirtusCo
// Master node type registry — UI definitions for all node types
// Adding a new node = adding one object to this file.

import type { ConfigField, PortDef, NodeCategory } from './types';

export interface VirtusNodeDefUI {
  type: string;
  category: NodeCategory;
  label: string;
  icon: string;
  color: string;
  inputs: PortDef[];
  outputs: PortDef[];
  configSchema: ConfigField[];
}

// ── Tier 1: Peripheral Nodes ─────────────────────────────────────────

const gpioOutput: VirtusNodeDefUI = {
  type: 'gpio_output',
  category: 'peripheral',
  label: 'GPIO Output',
  icon: 'toggle-right',
  color: '#4fc3f7',
  inputs: [
    { id: 'signal_in', label: 'Signal', type: 'signal' },
  ],
  outputs: [
    { id: 'pin_out', label: 'Pin', type: 'signal' },
  ],
  configSchema: [
    { key: 'alias', label: 'Alias Name', type: 'text', default: 'led', placeholder: 'e.g. led, motor_en' },
    { key: 'port', label: 'GPIO Port', type: 'number', default: 0, min: 0, max: 1 },
    { key: 'pin', label: 'GPIO Pin', type: 'number', default: 2, min: 0, max: 39 },
    { key: 'active_low', label: 'Active Low', type: 'boolean', default: false },
    { key: 'init_state', label: 'Initial ON', type: 'boolean', default: false },
  ],
};

const gpioInput: VirtusNodeDefUI = {
  type: 'gpio_input',
  category: 'peripheral',
  label: 'GPIO Input',
  icon: 'radio',
  color: '#4fc3f7',
  inputs: [],
  outputs: [
    { id: 'pin_out', label: 'Pin State', type: 'signal' },
    { id: 'irq_out', label: 'Interrupt', type: 'signal' },
  ],
  configSchema: [
    { key: 'alias', label: 'Alias Name', type: 'text', default: 'button', placeholder: 'e.g. button, limit_sw' },
    { key: 'port', label: 'GPIO Port', type: 'number', default: 0, min: 0, max: 1 },
    { key: 'pin', label: 'GPIO Pin', type: 'number', default: 0, min: 0, max: 39 },
    { key: 'pull', label: 'Pull Resistor', type: 'select', default: 'up', options: ['up', 'down', 'none'] },
    { key: 'irq_type', label: 'Interrupt Type', type: 'select', default: 'edge_rising', options: ['edge_rising', 'edge_falling', 'edge_both'] },
    { key: 'active_low', label: 'Active Low', type: 'boolean', default: false },
  ],
};

const pwmChannel: VirtusNodeDefUI = {
  type: 'pwm_channel',
  category: 'peripheral',
  label: 'PWM Channel',
  icon: 'activity',
  color: '#4fc3f7',
  inputs: [
    { id: 'duty_in', label: 'Duty %', type: 'data' },
  ],
  outputs: [
    { id: 'pwm_out', label: 'PWM', type: 'signal' },
  ],
  configSchema: [
    { key: 'alias', label: 'Alias Name', type: 'text', default: 'pwm_out', placeholder: 'e.g. servo, fan' },
    { key: 'channel', label: 'LEDC Channel', type: 'number', default: 0, min: 0, max: 7 },
    { key: 'period_us', label: 'Period (us)', type: 'number', default: 1000, min: 1 },
  ],
};

const uartBus: VirtusNodeDefUI = {
  type: 'uart_bus',
  category: 'peripheral',
  label: 'UART Bus',
  icon: 'cable',
  color: '#4fc3f7',
  inputs: [
    { id: 'tx_data', label: 'TX Data', type: 'data' },
  ],
  outputs: [
    { id: 'rx_data', label: 'RX Data', type: 'data' },
  ],
  configSchema: [
    { key: 'alias', label: 'Alias Name', type: 'text', default: 'uart1' },
    { key: 'instance', label: 'UART Instance', type: 'select', default: 'uart1', options: ['uart0', 'uart1', 'uart2'] },
    { key: 'baud', label: 'Baud Rate', type: 'number', default: 115200 },
    { key: 'tx_pin', label: 'TX Pin', type: 'number', default: 17, min: 0, max: 39 },
    { key: 'rx_pin', label: 'RX Pin', type: 'number', default: 16, min: 0, max: 39 },
  ],
};

const i2cBus: VirtusNodeDefUI = {
  type: 'i2c_bus',
  category: 'peripheral',
  label: 'I2C Bus',
  icon: 'git-merge',
  color: '#4fc3f7',
  inputs: [],
  outputs: [
    { id: 'i2c_bus', label: 'I2C Bus', type: 'data' },
  ],
  configSchema: [
    { key: 'alias', label: 'Alias Name', type: 'text', default: 'i2c0' },
    { key: 'instance', label: 'I2C Instance', type: 'select', default: 'i2c0', options: ['i2c0', 'i2c1'] },
    { key: 'speed', label: 'Speed', type: 'select', default: '400k', options: ['100k', '400k', '1M'] },
    { key: 'sda_pin', label: 'SDA Pin', type: 'number', default: 21, min: 0, max: 39 },
    { key: 'scl_pin', label: 'SCL Pin', type: 'number', default: 22, min: 0, max: 39 },
  ],
};

const spiBus: VirtusNodeDefUI = {
  type: 'spi_bus',
  category: 'peripheral',
  label: 'SPI Bus',
  icon: 'layers',
  color: '#4fc3f7',
  inputs: [],
  outputs: [
    { id: 'spi_bus', label: 'SPI Bus', type: 'data' },
  ],
  configSchema: [
    { key: 'alias', label: 'Alias Name', type: 'text', default: 'spi2' },
    { key: 'instance', label: 'SPI Instance', type: 'select', default: 'spi2', options: ['spi1', 'spi2', 'spi3'] },
    { key: 'mosi', label: 'MOSI Pin', type: 'number', default: 23, min: 0, max: 39 },
    { key: 'miso', label: 'MISO Pin', type: 'number', default: 19, min: 0, max: 39 },
    { key: 'sck', label: 'SCK Pin', type: 'number', default: 18, min: 0, max: 39 },
    { key: 'cs_pin', label: 'CS Pin', type: 'number', default: 5, min: 0, max: 39 },
    { key: 'frequency', label: 'Frequency (Hz)', type: 'number', default: 1000000 },
  ],
};

const adcChannel: VirtusNodeDefUI = {
  type: 'adc_channel',
  category: 'peripheral',
  label: 'ADC Channel',
  icon: 'bar-chart-2',
  color: '#4fc3f7',
  inputs: [],
  outputs: [
    { id: 'adc_value', label: 'ADC Value', type: 'data' },
  ],
  configSchema: [
    { key: 'alias', label: 'Alias Name', type: 'text', default: 'adc_ch' },
    { key: 'channel', label: 'ADC Channel', type: 'number', default: 0, min: 0, max: 9 },
    { key: 'resolution', label: 'Resolution (bits)', type: 'select', default: '12', options: ['9', '10', '11', '12', '13'] },
    { key: 'oversampling', label: 'Oversampling', type: 'number', default: 1, min: 1, max: 16 },
  ],
};

const blePeripheral: VirtusNodeDefUI = {
  type: 'ble_peripheral',
  category: 'peripheral',
  label: 'BLE Peripheral',
  icon: 'bluetooth',
  color: '#4fc3f7',
  inputs: [],
  outputs: [
    { id: 'ble_conn', label: 'Connection', type: 'data' },
  ],
  configSchema: [
    { key: 'device_name', label: 'Device Name', type: 'text', default: 'Virtus', placeholder: 'BLE advertised name' },
    { key: 'num_services', label: 'GATT Services', type: 'number', default: 1, min: 1, max: 8 },
    { key: 'tx_power', label: 'TX Power (dBm)', type: 'select', default: '0', options: ['-40', '-20', '-16', '-12', '-8', '-4', '0', '4'] },
  ],
};

// ── Tier 2: RTOS Nodes ───────────────────────────────────────────────

const zephyrThread: VirtusNodeDefUI = {
  type: 'zephyr_thread',
  category: 'rtos',
  label: 'Thread',
  icon: 'cpu',
  color: '#81c784',
  inputs: [
    { id: 'data_in', label: 'Data In', type: 'data' },
  ],
  outputs: [
    { id: 'data_out', label: 'Data Out', type: 'data' },
  ],
  configSchema: [
    { key: 'name', label: 'Thread Name', type: 'text', default: 'worker' },
    { key: 'stack_kb', label: 'Stack Size (KB)', type: 'number', default: 1, min: 1, max: 16 },
    { key: 'priority', label: 'Priority', type: 'number', default: 5, min: -16, max: 15 },
    { key: 'entry_fn', label: 'Entry Function', type: 'text', default: 'worker_entry', placeholder: 'void fn(void*,void*,void*)' },
    { key: 'delay_ms', label: 'Start Delay (ms)', type: 'number', default: 0, min: 0 },
  ],
};

const zephyrTimer: VirtusNodeDefUI = {
  type: 'zephyr_timer',
  category: 'rtos',
  label: 'Timer',
  icon: 'clock',
  color: '#81c784',
  inputs: [],
  outputs: [
    { id: 'expiry', label: 'Expiry', type: 'signal' },
  ],
  configSchema: [
    { key: 'name', label: 'Timer Name', type: 'text', default: 'periodic' },
    { key: 'duration_ms', label: 'Initial Delay (ms)', type: 'number', default: 1000, min: 1 },
    { key: 'period_ms', label: 'Period (ms)', type: 'number', default: 1000, min: 0 },
    { key: 'handler_fn', label: 'Handler Function', type: 'text', default: 'timer_handler' },
  ],
};

const zephyrSemaphore: VirtusNodeDefUI = {
  type: 'zephyr_semaphore',
  category: 'rtos',
  label: 'Semaphore',
  icon: 'lock',
  color: '#81c784',
  inputs: [
    { id: 'give', label: 'Give', type: 'signal' },
  ],
  outputs: [
    { id: 'take', label: 'Take', type: 'signal' },
  ],
  configSchema: [
    { key: 'name', label: 'Semaphore Name', type: 'text', default: 'sync' },
    { key: 'initial_count', label: 'Initial Count', type: 'number', default: 0, min: 0 },
    { key: 'max_count', label: 'Max Count', type: 'number', default: 1, min: 1 },
  ],
};

const zephyrMutex: VirtusNodeDefUI = {
  type: 'zephyr_mutex',
  category: 'rtos',
  label: 'Mutex',
  icon: 'shield',
  color: '#81c784',
  inputs: [],
  outputs: [],
  configSchema: [
    { key: 'name', label: 'Mutex Name', type: 'text', default: 'lock' },
  ],
};

const zephyrWork: VirtusNodeDefUI = {
  type: 'zephyr_work',
  category: 'rtos',
  label: 'Work Item',
  icon: 'zap',
  color: '#81c784',
  inputs: [
    { id: 'trigger', label: 'Trigger', type: 'signal' },
  ],
  outputs: [],
  configSchema: [
    { key: 'name', label: 'Work Name', type: 'text', default: 'task' },
    { key: 'handler_fn', label: 'Handler Function', type: 'text', default: 'work_handler' },
  ],
};

const zephyrMsgq: VirtusNodeDefUI = {
  type: 'zephyr_msgq',
  category: 'rtos',
  label: 'Message Queue',
  icon: 'inbox',
  color: '#81c784',
  inputs: [
    { id: 'put', label: 'Put', type: 'data' },
  ],
  outputs: [
    { id: 'get', label: 'Get', type: 'data' },
  ],
  configSchema: [
    { key: 'name', label: 'Queue Name', type: 'text', default: 'cmd' },
    { key: 'msg_size', label: 'Message Size (bytes)', type: 'number', default: 4, min: 1 },
    { key: 'max_msgs', label: 'Max Messages', type: 'number', default: 10, min: 1, max: 256 },
  ],
};

const zephyrFifo: VirtusNodeDefUI = {
  type: 'zephyr_fifo',
  category: 'rtos',
  label: 'FIFO',
  icon: 'list',
  color: '#81c784',
  inputs: [
    { id: 'put', label: 'Put', type: 'data' },
  ],
  outputs: [
    { id: 'get', label: 'Get', type: 'data' },
  ],
  configSchema: [
    { key: 'name', label: 'FIFO Name', type: 'text', default: 'queue' },
  ],
};

// ── Tier 3: Composite Nodes ──────────────────────────────────────────

const bts7960Motor: VirtusNodeDefUI = {
  type: 'bts7960_motor',
  category: 'composite',
  label: 'BTS7960 Motor',
  icon: 'settings',
  color: '#ce93d8',
  inputs: [
    { id: 'speed_cmd', label: 'Speed (-100..100)', type: 'data' },
  ],
  outputs: [
    { id: 'status', label: 'Status', type: 'data' },
  ],
  configSchema: [
    { key: 'name', label: 'Motor Name', type: 'text', default: 'motor_left', placeholder: 'e.g. motor_left, motor_right' },
    { key: 'rpwm_pin', label: 'RPWM Pin (Forward)', type: 'number', default: 18, min: 0, max: 39 },
    { key: 'lpwm_pin', label: 'LPWM Pin (Reverse)', type: 'number', default: 19, min: 0, max: 39 },
    { key: 'en_pin', label: 'Enable Pin', type: 'number', default: 5, min: 0, max: 39 },
    { key: 'rpwm_channel', label: 'RPWM LEDC Channel', type: 'number', default: 0, min: 0, max: 7 },
    { key: 'lpwm_channel', label: 'LPWM LEDC Channel', type: 'number', default: 1, min: 0, max: 7 },
    { key: 'pwm_period_us', label: 'PWM Period (us)', type: 'number', default: 1000, min: 100 },
  ],
};

const tofSensor: VirtusNodeDefUI = {
  type: 'tof_sensor',
  category: 'composite',
  label: 'ToF Sensor (VL53L0X)',
  icon: 'crosshair',
  color: '#ce93d8',
  inputs: [
    { id: 'i2c_in', label: 'I2C Bus', type: 'data' },
  ],
  outputs: [
    { id: 'distance', label: 'Distance (mm)', type: 'data' },
  ],
  configSchema: [
    { key: 'alias', label: 'Alias Name', type: 'text', default: 'tof' },
    { key: 'i2c_instance', label: 'I2C Instance', type: 'select', default: 'i2c0', options: ['i2c0', 'i2c1'] },
    { key: 'i2c_addr', label: 'I2C Address', type: 'text', default: '0x29' },
  ],
};

const ultrasonicSensor: VirtusNodeDefUI = {
  type: 'ultrasonic_sensor',
  category: 'composite',
  label: 'Ultrasonic (HC-SR04)',
  icon: 'radio',
  color: '#ce93d8',
  inputs: [],
  outputs: [
    { id: 'distance', label: 'Distance (cm)', type: 'data' },
  ],
  configSchema: [
    { key: 'alias', label: 'Alias Name', type: 'text', default: 'ultrasonic' },
    { key: 'trig_pin', label: 'Trigger Pin', type: 'number', default: 26, min: 0, max: 39 },
    { key: 'echo_pin', label: 'Echo Pin', type: 'number', default: 27, min: 0, max: 39 },
  ],
};

const sensorFusionUart: VirtusNodeDefUI = {
  type: 'sensor_fusion_uart',
  category: 'composite',
  label: 'Sensor Fusion UART',
  icon: 'radio-tower',
  color: '#ce93d8',
  inputs: [
    { id: 'sensor_data', label: 'Sensor Data', type: 'data' },
  ],
  outputs: [
    { id: 'uart_tx', label: 'UART TX', type: 'data' },
  ],
  configSchema: [
    { key: 'alias', label: 'Alias Name', type: 'text', default: 'fusion_uart' },
    { key: 'uart_instance', label: 'UART Instance', type: 'select', default: 'uart1', options: ['uart0', 'uart1', 'uart2'] },
    { key: 'baud', label: 'Baud Rate', type: 'number', default: 115200 },
  ],
};

const kalmanFilter: VirtusNodeDefUI = {
  type: 'kalman_filter',
  category: 'composite',
  label: 'Kalman Filter (1D)',
  icon: 'trending-up',
  color: '#ce93d8',
  inputs: [
    { id: 'measurement', label: 'Measurement', type: 'data' },
  ],
  outputs: [
    { id: 'estimate', label: 'Estimate', type: 'data' },
  ],
  configSchema: [
    { key: 'alias', label: 'Filter Name', type: 'text', default: 'kalman' },
    { key: 'process_noise', label: 'Process Noise (Q)', type: 'number', default: 0.1, min: 0.001 },
    { key: 'measurement_noise', label: 'Measurement Noise (R)', type: 'number', default: 1.0, min: 0.001 },
  ],
};

// ── Tier 4: Pipeline Nodes ───────────────────────────────────────────

const westBuild: VirtusNodeDefUI = {
  type: 'west_build',
  category: 'pipeline',
  label: 'West Build',
  icon: 'hammer',
  color: '#ff8a65',
  inputs: [
    { id: 'source_in', label: 'Source', type: 'data' },
  ],
  outputs: [
    { id: 'build_out', label: 'Build Output', type: 'data' },
  ],
  configSchema: [
    { key: 'board', label: 'Board', type: 'text', default: 'esp32_devkitc_wroom' },
    { key: 'optimization', label: 'Optimization', type: 'select', default: 'debug', options: ['debug', 'release_size', 'release_speed', 'none'] },
    { key: 'pristine', label: 'Pristine Build', type: 'boolean', default: false },
    { key: 'extra_args', label: 'Extra Arguments', type: 'text', default: '' },
  ],
};

const westFlash: VirtusNodeDefUI = {
  type: 'west_flash',
  category: 'pipeline',
  label: 'West Flash',
  icon: 'upload',
  color: '#ff8a65',
  inputs: [
    { id: 'build_in', label: 'Build Input', type: 'data' },
  ],
  outputs: [],
  configSchema: [
    { key: 'runner', label: 'Runner', type: 'select', default: 'esptool', options: ['esptool', 'jlink', 'openocd'] },
    { key: 'port', label: 'Serial Port', type: 'text', default: '/dev/ttyUSB0', placeholder: 'COM3 or /dev/ttyUSB0' },
  ],
};

const serialMonitor: VirtusNodeDefUI = {
  type: 'serial_monitor',
  category: 'pipeline',
  label: 'Serial Monitor',
  icon: 'terminal',
  color: '#ff8a65',
  inputs: [],
  outputs: [],
  configSchema: [
    { key: 'port', label: 'Serial Port', type: 'text', default: '/dev/ttyUSB0' },
    { key: 'baud', label: 'Baud Rate', type: 'number', default: 115200 },
  ],
};

const menuconfig: VirtusNodeDefUI = {
  type: 'menuconfig',
  category: 'pipeline',
  label: 'Menuconfig',
  icon: 'sliders',
  color: '#ff8a65',
  inputs: [],
  outputs: [],
  configSchema: [],
};

const westClean: VirtusNodeDefUI = {
  type: 'west_clean',
  category: 'pipeline',
  label: 'West Clean',
  icon: 'trash-2',
  color: '#ff8a65',
  inputs: [],
  outputs: [],
  configSchema: [],
};

// ── Registry Export ──────────────────────────────────────────────────

export const nodeDefRegistry: Record<string, VirtusNodeDefUI> = {
  // Peripherals
  gpio_output: gpioOutput,
  gpio_input: gpioInput,
  pwm_channel: pwmChannel,
  uart_bus: uartBus,
  i2c_bus: i2cBus,
  spi_bus: spiBus,
  adc_channel: adcChannel,
  ble_peripheral: blePeripheral,
  // RTOS
  zephyr_thread: zephyrThread,
  zephyr_timer: zephyrTimer,
  zephyr_semaphore: zephyrSemaphore,
  zephyr_mutex: zephyrMutex,
  zephyr_work: zephyrWork,
  zephyr_msgq: zephyrMsgq,
  zephyr_fifo: zephyrFifo,
  // Composite
  bts7960_motor: bts7960Motor,
  tof_sensor: tofSensor,
  ultrasonic_sensor: ultrasonicSensor,
  sensor_fusion_uart: sensorFusionUart,
  kalman_filter: kalmanFilter,
  // Pipeline
  west_build: westBuild,
  west_flash: westFlash,
  serial_monitor: serialMonitor,
  menuconfig,
  west_clean: westClean,
};
