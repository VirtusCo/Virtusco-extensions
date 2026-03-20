// Copyright 2026 VirtusCo
// Extension-host node registry — codegen definitions for all node types
// This is the single source of truth for code generation behavior.

import { NodeCodegenDef } from '../types';

interface RegistryEntry {
  codegen: NodeCodegenDef;
  category: string;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

function dtsAlias(alias: string, target: string): string {
  return `${alias} = ${target};`;
}

// ── Peripheral Nodes ─────────────────────────────────────────────────

const gpioOutput: RegistryEntry = {
  category: 'peripheral',
  codegen: {
    dtsFragment: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'led');
      const port = cfg.port as number ?? 0;
      const pin = cfg.pin as number ?? 2;
      return dtsAlias(alias, `&gpio${port} ${pin} GPIO_ACTIVE_${(cfg.active_low as boolean) ? 'LOW' : 'HIGH'}`);
    },
    confFlags: () => ['CONFIG_GPIO=y'],
    headerCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'led');
      return [
        `#define ${alias.toUpperCase()}_NODE DT_ALIAS(${alias})`,
        `static const struct gpio_dt_spec ${alias} = GPIO_DT_SPEC_GET(${alias.toUpperCase()}_NODE, gpios);`,
      ].join('\n');
    },
    initCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'led');
      const initState = (cfg.init_state as boolean) ? '1' : '0';
      return [
        `gpio_pin_configure_dt(&${alias}, GPIO_OUTPUT);`,
        `gpio_pin_set_dt(&${alias}, ${initState});`,
      ].join('\n');
    },
  },
};

const gpioInput: RegistryEntry = {
  category: 'peripheral',
  codegen: {
    dtsFragment: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'button');
      const port = cfg.port as number ?? 0;
      const pin = cfg.pin as number ?? 0;
      return dtsAlias(alias, `&gpio${port} ${pin} GPIO_ACTIVE_${(cfg.active_low as boolean) ? 'LOW' : 'HIGH'}`);
    },
    confFlags: () => ['CONFIG_GPIO=y'],
    headerCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'button');
      return [
        `#define ${alias.toUpperCase()}_NODE DT_ALIAS(${alias})`,
        `static const struct gpio_dt_spec ${alias} = GPIO_DT_SPEC_GET(${alias.toUpperCase()}_NODE, gpios);`,
        `static struct gpio_callback ${alias}_cb_data;`,
        `void ${alias}_handler(const struct device *dev, struct gpio_callback *cb, uint32_t pins);`,
      ].join('\n');
    },
    initCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'button');
      const pull = cfg.pull as string ?? 'up';
      const pullFlag = pull === 'up' ? ' | GPIO_PULL_UP' : pull === 'down' ? ' | GPIO_PULL_DOWN' : '';
      const irq = cfg.irq_type as string ?? 'edge_rising';
      const irqFlag = irq === 'edge_falling' ? 'GPIO_INT_EDGE_FALLING'
        : irq === 'edge_both' ? 'GPIO_INT_EDGE_BOTH'
        : 'GPIO_INT_EDGE_RISING';
      return [
        `gpio_pin_configure_dt(&${alias}, GPIO_INPUT${pullFlag});`,
        `gpio_pin_interrupt_configure_dt(&${alias}, ${irqFlag});`,
        `gpio_init_callback(&${alias}_cb_data, ${alias}_handler, BIT(${alias}.pin));`,
        `gpio_add_callback(${alias}.port, &${alias}_cb_data);`,
      ].join('\n');
    },
  },
};

const pwmChannel: RegistryEntry = {
  category: 'peripheral',
  codegen: {
    dtsFragment: (cfg) => {
      const channel = cfg.channel as number ?? 0;
      return `&ledc0 {\n    status = "okay";\n    #address-cells = <1>;\n    #size-cells = <0>;\n    #pwm-cells = <3>;\n\n    channel@${channel} {\n        reg = <${channel}>;\n        timer = <0>;\n    };\n};`;
    },
    confFlags: () => ['CONFIG_PWM=y', 'CONFIG_LED=y'],
    headerCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'pwm_out');
      return [
        `static const struct pwm_dt_spec ${alias} = PWM_DT_SPEC_GET(DT_ALIAS(${alias}));`,
        `static inline void ${alias}_set(uint32_t duty_pct) {`,
        `    uint32_t period = PWM_USEC(${cfg.period_us as number ?? 1000});`,
        `    pwm_set_dt(&${alias}, period, period * duty_pct / 100);`,
        `}`,
      ].join('\n');
    },
    initCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'pwm_out');
      return `/* PWM ${alias} ready — call ${alias}_set(duty_pct) */`;
    },
  },
};

const uartBus: RegistryEntry = {
  category: 'peripheral',
  codegen: {
    dtsFragment: (cfg) => {
      const instance = cfg.instance as string ?? 'uart1';
      const baud = cfg.baud as number ?? 115200;
      return [
        `&${instance} {`,
        `    status = "okay";`,
        `    current-speed = <${baud}>;`,
        `};`,
      ].join('\n');
    },
    confFlags: () => [
      'CONFIG_SERIAL=y',
      'CONFIG_UART_INTERRUPT_DRIVEN=y',
    ],
    headerCode: (cfg) => {
      const instance = cfg.instance as string ?? 'uart1';
      const alias = sanitize(cfg.alias as string || instance);
      return [
        `#define ${alias.toUpperCase()}_DEV DEVICE_DT_GET(DT_NODELABEL(${instance}))`,
        `extern const struct device *const ${alias}_dev;`,
      ].join('\n');
    },
    initCode: (cfg) => {
      const instance = cfg.instance as string ?? 'uart1';
      const alias = sanitize(cfg.alias as string || instance);
      return [
        `const struct device *const ${alias}_dev = ${alias.toUpperCase()}_DEV;`,
        `if (!device_is_ready(${alias}_dev)) {`,
        `    printk("${alias}: device not ready\\n");`,
        `}`,
      ].join('\n');
    },
  },
};

const i2cBus: RegistryEntry = {
  category: 'peripheral',
  codegen: {
    dtsFragment: (cfg) => {
      const instance = cfg.instance as string ?? 'i2c0';
      const speed = cfg.speed as string ?? '400k';
      const speedVal = speed === '1M' ? '1000000' : speed === '100k' ? '100000' : '400000';
      return [
        `&${instance} {`,
        `    status = "okay";`,
        `    clock-frequency = <${speedVal}>;`,
        `};`,
      ].join('\n');
    },
    confFlags: () => ['CONFIG_I2C=y'],
    headerCode: (cfg) => {
      const instance = cfg.instance as string ?? 'i2c0';
      const alias = sanitize(cfg.alias as string || instance);
      return [
        `#define ${alias.toUpperCase()}_DEV DEVICE_DT_GET(DT_NODELABEL(${instance}))`,
        `extern const struct device *const ${alias}_dev;`,
      ].join('\n');
    },
    initCode: (cfg) => {
      const instance = cfg.instance as string ?? 'i2c0';
      const alias = sanitize(cfg.alias as string || instance);
      return [
        `const struct device *const ${alias}_dev = ${alias.toUpperCase()}_DEV;`,
        `if (!device_is_ready(${alias}_dev)) {`,
        `    printk("${alias}: device not ready\\n");`,
        `}`,
      ].join('\n');
    },
  },
};

const spiBus: RegistryEntry = {
  category: 'peripheral',
  codegen: {
    dtsFragment: (cfg) => {
      const instance = cfg.instance as string ?? 'spi2';
      return [
        `&${instance} {`,
        `    status = "okay";`,
        `};`,
      ].join('\n');
    },
    confFlags: () => ['CONFIG_SPI=y'],
    headerCode: (cfg) => {
      const instance = cfg.instance as string ?? 'spi2';
      const alias = sanitize(cfg.alias as string || instance);
      return [
        `#define ${alias.toUpperCase()}_DEV DEVICE_DT_GET(DT_NODELABEL(${instance}))`,
        `extern const struct device *const ${alias}_dev;`,
      ].join('\n');
    },
    initCode: (cfg) => {
      const instance = cfg.instance as string ?? 'spi2';
      const alias = sanitize(cfg.alias as string || instance);
      return [
        `const struct device *const ${alias}_dev = ${alias.toUpperCase()}_DEV;`,
        `if (!device_is_ready(${alias}_dev)) {`,
        `    printk("${alias}: device not ready\\n");`,
        `}`,
      ].join('\n');
    },
  },
};

const adcChannel: RegistryEntry = {
  category: 'peripheral',
  codegen: {
    dtsFragment: (cfg) => {
      const channel = cfg.channel as number ?? 0;
      const resolution = cfg.resolution as number ?? 12;
      return [
        `&adc {`,
        `    status = "okay";`,
        `    #address-cells = <1>;`,
        `    #size-cells = <0>;`,
        ``,
        `    channel@${channel} {`,
        `        reg = <${channel}>;`,
        `        zephyr,gain = "ADC_GAIN_1";`,
        `        zephyr,reference = "ADC_REF_INTERNAL";`,
        `        zephyr,acquisition-time = <ADC_ACQ_TIME_DEFAULT>;`,
        `        zephyr,resolution = <${resolution}>;`,
        `    };`,
        `};`,
      ].join('\n');
    },
    confFlags: () => ['CONFIG_ADC=y'],
    headerCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'adc_ch');
      return [
        `#define ${alias.toUpperCase()}_DEV DEVICE_DT_GET(DT_NODELABEL(adc))`,
        `extern const struct device *const ${alias}_dev;`,
        `int ${alias}_read(void);`,
      ].join('\n');
    },
    initCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'adc_ch');
      const channel = cfg.channel as number ?? 0;
      const resolution = cfg.resolution as number ?? 12;
      return [
        `const struct device *const ${alias}_dev = ${alias.toUpperCase()}_DEV;`,
        `if (!device_is_ready(${alias}_dev)) {`,
        `    printk("${alias}: device not ready\\n");`,
        `}`,
        ``,
        `static struct adc_channel_cfg ${alias}_cfg = {`,
        `    .gain = ADC_GAIN_1,`,
        `    .reference = ADC_REF_INTERNAL,`,
        `    .acquisition_time = ADC_ACQ_TIME_DEFAULT,`,
        `    .channel_id = ${channel},`,
        `};`,
        `adc_channel_setup(${alias}_dev, &${alias}_cfg);`,
        ``,
        `int ${alias}_read(void) {`,
        `    int16_t buf;`,
        `    struct adc_sequence seq = {`,
        `        .channels = BIT(${channel}),`,
        `        .buffer = &buf,`,
        `        .buffer_size = sizeof(buf),`,
        `        .resolution = ${resolution},`,
        `    };`,
        `    int ret = adc_read(${alias}_dev, &seq);`,
        `    return ret < 0 ? ret : (int)buf;`,
        `}`,
      ].join('\n');
    },
  },
};

const blePeripheral: RegistryEntry = {
  category: 'peripheral',
  codegen: {
    confFlags: (cfg) => {
      const name = cfg.device_name as string ?? 'Virtus';
      return [
        'CONFIG_BT=y',
        'CONFIG_BT_PERIPHERAL=y',
        `CONFIG_BT_DEVICE_NAME="${name}"`,
        'CONFIG_BT_DEVICE_NAME_DYNAMIC=y',
        'CONFIG_BT_SMP=y',
        'CONFIG_BT_GATT_DYNAMIC_DB=y',
      ];
    },
    headerCode: () => {
      return [
        '#include <zephyr/bluetooth/bluetooth.h>',
        '#include <zephyr/bluetooth/gatt.h>',
        '',
        'void virtus_bt_ready(int err);',
        'int virtus_bt_init(void);',
      ].join('\n');
    },
    initCode: () => {
      return [
        `int virtus_bt_init(void) {`,
        `    int err = bt_enable(virtus_bt_ready);`,
        `    if (err) {`,
        `        printk("Bluetooth init failed (err %d)\\n", err);`,
        `    }`,
        `    return err;`,
        `}`,
        ``,
        `void virtus_bt_ready(int err) {`,
        `    if (err) {`,
        `        printk("BT ready failed (err %d)\\n", err);`,
        `        return;`,
        `    }`,
        `    printk("Bluetooth initialized\\n");`,
        `    /* Start advertising here */`,
        `}`,
      ].join('\n');
    },
  },
};

// ── RTOS Nodes ───────────────────────────────────────────────────────

const zephyrThread: RegistryEntry = {
  category: 'rtos',
  codegen: {
    headerCode: (cfg) => {
      const name = sanitize(cfg.name as string || 'worker');
      return `void ${cfg.entry_fn as string || name + '_entry'}(void *p1, void *p2, void *p3);`;
    },
    initCode: (cfg) => {
      const name = sanitize(cfg.name as string || 'worker');
      const stack = (cfg.stack_kb as number ?? 1) * 1024;
      const priority = cfg.priority as number ?? 5;
      const delay = cfg.delay_ms as number ?? 0;
      const entry = cfg.entry_fn as string || name + '_entry';
      return `K_THREAD_DEFINE(${name}_tid, ${stack}, ${entry}, NULL, NULL, NULL, ${priority}, 0, ${delay});`;
    },
  },
};

const zephyrTimer: RegistryEntry = {
  category: 'rtos',
  codegen: {
    headerCode: (cfg) => {
      const handler = cfg.handler_fn as string || 'timer_handler';
      return `void ${handler}(struct k_timer *timer);`;
    },
    initCode: (cfg) => {
      const name = sanitize(cfg.name as string || 'periodic');
      const handler = cfg.handler_fn as string || 'timer_handler';
      const duration = cfg.duration_ms as number ?? 1000;
      const period = cfg.period_ms as number ?? 1000;
      return [
        `K_TIMER_DEFINE(${name}_timer, ${handler}, NULL);`,
        `k_timer_start(&${name}_timer, K_MSEC(${duration}), K_MSEC(${period}));`,
      ].join('\n');
    },
  },
};

const zephyrSemaphore: RegistryEntry = {
  category: 'rtos',
  codegen: {
    initCode: (cfg) => {
      const name = sanitize(cfg.name as string || 'sync');
      const initial = cfg.initial_count as number ?? 0;
      const max = cfg.max_count as number ?? 1;
      return `K_SEM_DEFINE(${name}_sem, ${initial}, ${max});`;
    },
  },
};

const zephyrMutex: RegistryEntry = {
  category: 'rtos',
  codegen: {
    initCode: (cfg) => {
      const name = sanitize(cfg.name as string || 'lock');
      return `K_MUTEX_DEFINE(${name}_mtx);`;
    },
  },
};

const zephyrWork: RegistryEntry = {
  category: 'rtos',
  codegen: {
    headerCode: (cfg) => {
      const handler = cfg.handler_fn as string || 'work_handler';
      return `void ${handler}(struct k_work *work);`;
    },
    initCode: (cfg) => {
      const name = sanitize(cfg.name as string || 'task');
      const handler = cfg.handler_fn as string || 'work_handler';
      return `K_WORK_DEFINE(${name}_work, ${handler});`;
    },
  },
};

const zephyrMsgq: RegistryEntry = {
  category: 'rtos',
  codegen: {
    initCode: (cfg) => {
      const name = sanitize(cfg.name as string || 'cmd');
      const msgSize = cfg.msg_size as number ?? 4;
      const maxMsgs = cfg.max_msgs as number ?? 10;
      return `K_MSGQ_DEFINE(${name}_msgq, ${msgSize}, ${maxMsgs}, 4);`;
    },
  },
};

const zephyrFifo: RegistryEntry = {
  category: 'rtos',
  codegen: {
    initCode: (cfg) => {
      const name = sanitize(cfg.name as string || 'queue');
      return `K_FIFO_DEFINE(${name}_fifo);`;
    },
  },
};

// ── Composite Nodes ──────────────────────────────────────────────────

const bts7960Motor: RegistryEntry = {
  category: 'composite',
  codegen: {
    dtsFragment: (cfg) => {
      const name = sanitize(cfg.name as string || 'motor');
      const rpwmPin = cfg.rpwm_pin as number ?? 18;
      const lpwmPin = cfg.lpwm_pin as number ?? 19;
      const rpwmCh = cfg.rpwm_channel as number ?? 0;
      const lpwmCh = cfg.lpwm_channel as number ?? 1;
      return [
        `&ledc0 {`,
        `    status = "okay";`,
        `    #address-cells = <1>;`,
        `    #size-cells = <0>;`,
        `    #pwm-cells = <3>;`,
        ``,
        `    channel@${rpwmCh} {`,
        `        reg = <${rpwmCh}>;`,
        `        timer = <0>;`,
        `        /* GPIO${rpwmPin} = RPWM for ${name} */`,
        `    };`,
        `    channel@${lpwmCh} {`,
        `        reg = <${lpwmCh}>;`,
        `        timer = <0>;`,
        `        /* GPIO${lpwmPin} = LPWM for ${name} */`,
        `    };`,
        `};`,
      ].join('\n');
    },
    confFlags: () => ['CONFIG_PWM=y', 'CONFIG_LED=y', 'CONFIG_GPIO=y'],
    headerCode: (cfg) => {
      const name = sanitize(cfg.name as string || 'motor');
      return [
        `/* BTS7960 Motor: ${name} */`,
        `static const struct pwm_dt_spec ${name}_rpwm = PWM_DT_SPEC_GET(DT_ALIAS(${name}_rpwm));`,
        `static const struct pwm_dt_spec ${name}_lpwm = PWM_DT_SPEC_GET(DT_ALIAS(${name}_lpwm));`,
        `static const struct gpio_dt_spec ${name}_en = GPIO_DT_SPEC_GET(DT_ALIAS(${name}_en), gpios);`,
        ``,
        `void ${name}_init(void);`,
        `/** Set motor speed: -100 (full reverse) to +100 (full forward) */`,
        `void ${name}_set(int16_t speed);`,
        `void ${name}_stop(void);`,
      ].join('\n');
    },
    initCode: (cfg) => {
      const name = sanitize(cfg.name as string || 'motor');
      const period = cfg.pwm_period_us as number ?? 1000;
      return [
        `void ${name}_init(void) {`,
        `    gpio_pin_configure_dt(&${name}_en, GPIO_OUTPUT_ACTIVE);`,
        `    gpio_pin_set_dt(&${name}_en, 1);`,
        `}`,
        ``,
        `void ${name}_set(int16_t speed) {`,
        `    uint32_t period = PWM_USEC(${period});`,
        `    if (speed > 100) speed = 100;`,
        `    if (speed < -100) speed = -100;`,
        `    uint32_t duty = (uint32_t)((speed < 0 ? -speed : speed) * ${period} / 100);`,
        `    if (speed >= 0) {`,
        `        pwm_set_dt(&${name}_rpwm, period, PWM_USEC(duty));`,
        `        pwm_set_dt(&${name}_lpwm, period, PWM_USEC(0));`,
        `    } else {`,
        `        pwm_set_dt(&${name}_rpwm, period, PWM_USEC(0));`,
        `        pwm_set_dt(&${name}_lpwm, period, PWM_USEC(duty));`,
        `    }`,
        `}`,
        ``,
        `void ${name}_stop(void) {`,
        `    uint32_t period = PWM_USEC(${period});`,
        `    pwm_set_dt(&${name}_rpwm, period, PWM_USEC(0));`,
        `    pwm_set_dt(&${name}_lpwm, period, PWM_USEC(0));`,
        `}`,
      ].join('\n');
    },
  },
};

const tofSensor: RegistryEntry = {
  category: 'composite',
  codegen: {
    dtsFragment: (cfg) => {
      const instance = cfg.i2c_instance as string ?? 'i2c0';
      const addr = cfg.i2c_addr as string ?? '0x29';
      return [
        `&${instance} {`,
        `    status = "okay";`,
        `    clock-frequency = <400000>;`,
        ``,
        `    vl53l0x@${addr.replace('0x', '')} {`,
        `        compatible = "st,vl53l0x";`,
        `        reg = <${addr}>;`,
        `    };`,
        `};`,
      ].join('\n');
    },
    confFlags: () => ['CONFIG_I2C=y', 'CONFIG_SENSOR=y'],
    headerCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'tof');
      return [
        `/* VL53L0X ToF Sensor: ${alias} */`,
        `extern volatile uint16_t ${alias}_distance_mm;`,
        `int ${alias}_read(void);`,
      ].join('\n');
    },
    initCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'tof');
      const instance = cfg.i2c_instance as string ?? 'i2c0';
      return [
        `volatile uint16_t ${alias}_distance_mm = 0;`,
        ``,
        `int ${alias}_read(void) {`,
        `    const struct device *dev = DEVICE_DT_GET(DT_NODELABEL(${instance}));`,
        `    if (!device_is_ready(dev)) return -ENODEV;`,
        `    /* VL53L0X I2C read sequence — implement per datasheet */`,
        `    return 0;`,
        `}`,
      ].join('\n');
    },
  },
};

const ultrasonicSensor: RegistryEntry = {
  category: 'composite',
  codegen: {
    confFlags: () => ['CONFIG_GPIO=y'],
    headerCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'ultrasonic');
      return [
        `/* HC-SR04 Ultrasonic: ${alias} */`,
        `extern volatile uint32_t ${alias}_distance_cm;`,
        `int ${alias}_measure(void);`,
      ].join('\n');
    },
    initCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'ultrasonic');
      return [
        `volatile uint32_t ${alias}_distance_cm = 0;`,
        ``,
        `static const struct gpio_dt_spec ${alias}_trig = GPIO_DT_SPEC_GET(DT_ALIAS(${alias}_trig), gpios);`,
        `static const struct gpio_dt_spec ${alias}_echo = GPIO_DT_SPEC_GET(DT_ALIAS(${alias}_echo), gpios);`,
        ``,
        `int ${alias}_measure(void) {`,
        `    gpio_pin_configure_dt(&${alias}_trig, GPIO_OUTPUT);`,
        `    gpio_pin_configure_dt(&${alias}_echo, GPIO_INPUT);`,
        `    /* Trigger 10us pulse */`,
        `    gpio_pin_set_dt(&${alias}_trig, 1);`,
        `    k_busy_wait(10);`,
        `    gpio_pin_set_dt(&${alias}_trig, 0);`,
        `    /* Measure echo pulse width */`,
        `    uint32_t start = k_cycle_get_32();`,
        `    while (!gpio_pin_get_dt(&${alias}_echo)) {`,
        `        if (k_cyc_to_us_floor32(k_cycle_get_32() - start) > 30000) return -ETIMEDOUT;`,
        `    }`,
        `    start = k_cycle_get_32();`,
        `    while (gpio_pin_get_dt(&${alias}_echo)) {`,
        `        if (k_cyc_to_us_floor32(k_cycle_get_32() - start) > 30000) return -ETIMEDOUT;`,
        `    }`,
        `    uint32_t pulse_us = k_cyc_to_us_floor32(k_cycle_get_32() - start);`,
        `    ${alias}_distance_cm = pulse_us / 58;`,
        `    return 0;`,
        `}`,
      ].join('\n');
    },
  },
};

const sensorFusionUart: RegistryEntry = {
  category: 'composite',
  codegen: {
    dtsFragment: (cfg) => {
      const instance = cfg.uart_instance as string ?? 'uart1';
      const baud = cfg.baud as number ?? 115200;
      return [
        `&${instance} {`,
        `    status = "okay";`,
        `    current-speed = <${baud}>;`,
        `};`,
      ].join('\n');
    },
    confFlags: () => [
      'CONFIG_SERIAL=y',
      'CONFIG_UART_INTERRUPT_DRIVEN=y',
    ],
    headerCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'fusion_uart');
      return [
        `/* Sensor Fusion UART: ${alias} */`,
        `extern const struct device *const ${alias}_dev;`,
        `int ${alias}_send(const uint8_t *data, size_t len);`,
      ].join('\n');
    },
    initCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'fusion_uart');
      const instance = cfg.uart_instance as string ?? 'uart1';
      return [
        `const struct device *const ${alias}_dev = DEVICE_DT_GET(DT_NODELABEL(${instance}));`,
        ``,
        `int ${alias}_send(const uint8_t *data, size_t len) {`,
        `    if (!device_is_ready(${alias}_dev)) return -ENODEV;`,
        `    for (size_t i = 0; i < len; i++) {`,
        `        uart_poll_out(${alias}_dev, data[i]);`,
        `    }`,
        `    return 0;`,
        `}`,
      ].join('\n');
    },
  },
};

const kalmanFilter: RegistryEntry = {
  category: 'composite',
  codegen: {
    headerCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'kalman');
      return [
        `/* 1D Kalman Filter: ${alias} */`,
        `typedef struct {`,
        `    float x;      /* State estimate */`,
        `    float p;      /* Estimate covariance */`,
        `    float q;      /* Process noise */`,
        `    float r;      /* Measurement noise */`,
        `    float k;      /* Kalman gain */`,
        `} ${alias}_state_t;`,
        ``,
        `void ${alias}_init(${alias}_state_t *kf, float initial, float q, float r);`,
        `float ${alias}_update(${alias}_state_t *kf, float measurement);`,
      ].join('\n');
    },
    initCode: (cfg) => {
      const alias = sanitize(cfg.alias as string || 'kalman');
      return [
        `void ${alias}_init(${alias}_state_t *kf, float initial, float q, float r) {`,
        `    kf->x = initial;`,
        `    kf->p = 1.0f;`,
        `    kf->q = q;`,
        `    kf->r = r;`,
        `    kf->k = 0.0f;`,
        `}`,
        ``,
        `float ${alias}_update(${alias}_state_t *kf, float measurement) {`,
        `    /* Predict */`,
        `    kf->p += kf->q;`,
        `    /* Update */`,
        `    kf->k = kf->p / (kf->p + kf->r);`,
        `    kf->x += kf->k * (measurement - kf->x);`,
        `    kf->p *= (1.0f - kf->k);`,
        `    return kf->x;`,
        `}`,
      ].join('\n');
    },
  },
};

// ── Node Registry Export ─────────────────────────────────────────────

export const nodeRegistry: Record<string, RegistryEntry> = {
  gpio_output: gpioOutput,
  gpio_input: gpioInput,
  pwm_channel: pwmChannel,
  uart_bus: uartBus,
  i2c_bus: i2cBus,
  spi_bus: spiBus,
  adc_channel: adcChannel,
  ble_peripheral: blePeripheral,
  zephyr_thread: zephyrThread,
  zephyr_timer: zephyrTimer,
  zephyr_semaphore: zephyrSemaphore,
  zephyr_mutex: zephyrMutex,
  zephyr_work: zephyrWork,
  zephyr_msgq: zephyrMsgq,
  zephyr_fifo: zephyrFifo,
  bts7960_motor: bts7960Motor,
  tof_sensor: tofSensor,
  ultrasonic_sensor: ultrasonicSensor,
  sensor_fusion_uart: sensorFusionUart,
  kalman_filter: kalmanFilter,
};
