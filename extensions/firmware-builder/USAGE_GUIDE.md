# Virtus Firmware Builder — Usage Guide

**Visual node-based firmware development for Zephyr RTOS**
VirtusCo · v0.2.0

---

## Table of Contents

1. [Installation](#1-installation)
2. [First-Time Setup](#2-first-time-setup)
3. [Creating a New Project](#3-creating-a-new-project)
4. [The Canvas — Building Firmware Visually](#4-the-canvas--building-firmware-visually)
5. [Node Types Reference](#5-node-types-reference)
6. [Wiring Nodes Together](#6-wiring-nodes-together)
7. [Configuring Nodes](#7-configuring-nodes)
8. [Generating Code](#8-generating-code)
9. [Understanding Generated Files](#9-understanding-generated-files)
10. [Building Firmware](#10-building-firmware)
11. [Flashing to Hardware](#11-flashing-to-hardware)
12. [Serial Monitor](#12-serial-monitor)
13. [Saving and Loading Flows](#13-saving-and-loading-flows)
14. [Optimization Profiles](#14-optimization-profiles)
15. [Board Selection](#15-board-selection)
16. [Dynamic Zephyr API Nodes](#16-dynamic-zephyr-api-nodes)
17. [End-to-End Example: Motor Controller](#17-end-to-end-example-motor-controller)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. Installation

### Prerequisites

- **VS Code** 1.85 or later
- **Node.js** 18 or later
- **Python 3** with `pip` (for `west` and `esptool`)
- **West** — Zephyr's meta-tool: `pip install west`

### Install the Extension

**Option A: From source (development)**
```bash
cd Porter-ROS/virtus-firmware-builder
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

**Option B: From .vsix (distribution)**
```bash
cd Porter-ROS/virtus-firmware-builder
npm run package
code --install-extension virtus-firmware-builder-0.2.0.vsix
```

After installation, you'll see the **Virtus chip icon** in the Activity Bar (left sidebar).

---

## 2. First-Time Setup

### Setting up the Zephyr Workspace

Zephyr requires a "west workspace" — a directory with the full Zephyr source tree. This is a one-time setup that downloads ~2 GB.

1. Click the **Virtus icon** in the Activity Bar
2. In the **Project** panel, click **Create New Project**
3. If no Zephyr workspace is detected, you'll be prompted:
   - **"Initialize Workspace Now"** — the extension runs:
     ```
     west init -m https://github.com/zephyrproject-rtos/zephyr --mr v4.0.0 ~/zephyrproject
     cd ~/zephyrproject && west update
     pip install -r zephyr/scripts/requirements.txt
     west zephyr-export
     ```
   - **"I Have One — Let Me Browse"** — select your existing workspace folder (must contain `.west/`)

4. Wait for the terminal to finish (10-30 minutes on first run)

### Configuring Settings

Open VS Code Settings (`Ctrl+,`) and search for `virtus`:

| Setting | What to Set |
|---------|-------------|
| **Virtus: Zephyr Base** | Path to `zephyr/` inside your workspace, e.g. `C:\Users\you\zephyrproject\zephyr` |
| **Virtus: Flash Port** | Your ESP32's serial port, e.g. `COM3` (Windows) or `/dev/ttyUSB0` (Linux) |
| **Virtus: Selected Board** | Target board, e.g. `esp32_devkitc_wroom` |

---

## 3. Creating a New Project

1. Click **Virtus icon** → **Create New Project**
2. Enter a **project name** (e.g. `motor-controller`)
3. Choose **location**:
   - **Inside Zephyr workspace** (recommended) — `west build` works automatically
   - **Custom location** — you'll need `ZEPHYR_BASE` set
4. Select a **board** from the picker (shows CPU, RAM, Flash, peripheral count)
5. The extension creates:
   ```
   motor-controller/
   ├── CMakeLists.txt      ← Zephyr build config
   ├── prj.conf            ← Kconfig flags
   └── src/
       └── main.c          ← Your entry point (calls virtus_init())
   ```
6. VS Code opens the new project folder

---

## 4. The Canvas — Building Firmware Visually

Open the canvas: **Virtus icon** → **Build & Flash** → **Open Canvas**
Or: `Ctrl+Shift+P` → **Virtus: Open Firmware Builder Canvas**

The canvas has three panels:

### Left: Node Palette
- **Peripherals** — GPIO, PWM, UART, I2C, SPI, ADC, BLE
- **Composite** — Pre-built hardware blocks (BTS7960 Motor, ToF Sensor, etc.)
- **RTOS** — Threads, Timers, Semaphores, Mutexes, Message Queues
- **Pipeline** — Build, Flash, Monitor commands
- **Zephyr API** — Auto-scanned functions from your installed Zephyr SDK
- **Search bar** — Filter nodes by name

### Center: Flow Canvas
- **Drag** nodes from palette onto canvas
- **Connect** ports by dragging from output (right) to input (left)
- **Select** a node by clicking it
- **Delete** selected node via the config panel or `Delete` key
- **Pan** by dragging empty space
- **Zoom** with scroll wheel
- **Minimap** in bottom-right corner

### Right: Config Panel
- Appears when a node is selected
- Shows configurable properties (pin numbers, aliases, baud rates, etc.)
- Changes update the node immediately
- **Delete** button removes the node

### Top-Right: Toolbar
| Button | Action |
|--------|--------|
| **Generate** | Write firmware files to disk |
| **Save** | Save flow as `firmware.virtusflow` |
| **Build** | Run `west build` in terminal |
| **Flash** | Run `west flash` in terminal |

---

## 5. Node Types Reference

### Tier 1: Peripherals (blue)

| Node | What it Generates | Key Config |
|------|-------------------|------------|
| **GPIO Output** | Pin configure + set/clear | alias, port, pin, active_low, init_state |
| **GPIO Input** | Pin configure + interrupt callback | alias, port, pin, pull (up/down), irq_type |
| **PWM Channel** | LEDC PWM with duty cycle helper | alias, channel, period_us |
| **UART Bus** | UART device init + ready check | instance (uart0/1/2), baud, tx_pin, rx_pin |
| **I2C Bus** | I2C device init + ready check | instance (i2c0/1), speed (100k/400k/1M) |
| **SPI Bus** | SPI device init | instance (spi1/2/3), MOSI/MISO/SCK/CS pins |
| **ADC Channel** | ADC channel setup + read function | channel, resolution (9-13 bit) |
| **BLE Peripheral** | Bluetooth init + advertising scaffold | device_name, tx_power |

### Tier 2: RTOS (green)

| Node | What it Generates | Key Config |
|------|-------------------|------------|
| **Thread** | `K_THREAD_DEFINE()` | name, stack_kb, priority, entry_fn, delay_ms |
| **Timer** | `K_TIMER_DEFINE()` + start | name, duration_ms, period_ms, handler_fn |
| **Semaphore** | `K_SEM_DEFINE()` | name, initial_count, max_count |
| **Mutex** | `K_MUTEX_DEFINE()` | name |
| **Work Item** | `K_WORK_DEFINE()` | name, handler_fn |
| **Message Queue** | `K_MSGQ_DEFINE()` | name, msg_size, max_msgs |
| **FIFO** | `K_FIFO_DEFINE()` | name |

### Tier 3: Composite (purple)

These are high-value compound nodes that generate complete driver setups.

| Node | What it Generates | Key Config |
|------|-------------------|------------|
| **BTS7960 Motor** | 2× PWM + enable GPIO + `motor_set(-100..+100)` helper | name, RPWM/LPWM pins, enable pin, PWM channels |
| **ToF Sensor (VL53L0X)** | I2C device tree entry + read function | i2c_instance, i2c_addr |
| **Ultrasonic (HC-SR04)** | Trigger/echo GPIO + pulse timing + distance calc | trig_pin, echo_pin |
| **Sensor Fusion UART** | UART init + send function for RPi communication | uart_instance, baud |
| **Kalman Filter (1D)** | Complete 1D Kalman struct + init/update functions | process_noise (Q), measurement_noise (R) |

### Tier 4: Pipeline (orange)

| Node | Action | Key Config |
|------|--------|------------|
| **West Build** | Runs `west build -b <board>` | board, optimization, pristine, extra_args |
| **West Flash** | Runs `west flash --runner esptool` | runner, port |
| **Serial Monitor** | Opens miniterm | port, baud |
| **Menuconfig** | Opens Kconfig TUI editor | — |
| **West Clean** | Deletes build directory | — |

### Dynamic: Zephyr API (gold)

When `ZEPHYR_BASE` is set, the extension scans all driver headers and generates nodes for every public function. These appear under **"Zephyr API (vX.Y.Z)"** in the palette, grouped by subsystem (GPIO, PWM, UART, I2C, SPI, ADC, Sensor, Watchdog, Flash, Counter, etc.).

Each function becomes a node with:
- **Inputs** = pointer/device parameters
- **Outputs** = return value (if non-void)
- **Config fields** = value parameters (pin, flags, size)
- **Tooltip** = extracted `@brief` from the header comment

---

## 6. Wiring Nodes Together

### Port Types

Nodes have colored connection ports. **Only matching types can connect:**

| Type | Color | Shape | Use |
|------|-------|-------|-----|
| **Signal** | Blue ◆ | Circle | Digital on/off, interrupts, PWM output |
| **Data** | Green ■ | Square | Sensor readings, bus data, buffers |
| **Power** | Orange ● | Circle | Power supply connections |

### How to Wire

1. Hover over an **output port** (right side of a node) — it highlights
2. Click and drag to an **input port** (left side of another node)
3. If the types match, the connection snaps in — shown as an animated line
4. If the types don't match, the connection is rejected (wire disappears)

### What Wires Mean

Wires define **initialization order** (dependency graph). The codegen orchestrator runs a topological sort on the graph — nodes earlier in the chain initialize first. For example:

```
I2C Bus → ToF Sensor → Kalman Filter → Thread
```

This ensures I2C is initialized before the ToF sensor, which is ready before the Kalman filter, which is ready before the thread starts reading.

---

## 7. Configuring Nodes

1. **Click** a node on the canvas
2. The **Config Panel** opens on the right
3. Edit properties:
   - **Text fields** — alias names, function names
   - **Number fields** — pin numbers, baud rates, periods
   - **Dropdowns** — port selection, pull resistor type, optimization profile
   - **Checkboxes** — active low, pristine build
4. Changes are reflected immediately in the node header (alias name shown in italics)

### Important Config Fields

| Field | Why It Matters |
|-------|---------------|
| **Alias** | Becomes the C variable name. Must be unique across all nodes. |
| **Pin numbers** | Must match your physical wiring. ESP32 GPIO0-39. |
| **UART/I2C/SPI instance** | Must not conflict — e.g., don't use uart0 (reserved for console). |
| **Thread priority** | Lower number = higher priority. Safety threads should be negative. |
| **PWM period** | In microseconds. 1000 µs = 1 kHz. |

---

## 8. Generating Code

1. Build your flow on the canvas
2. Click **Generate** (top-right toolbar)
3. The extension:
   - Performs a **topological sort** of all nodes (respects wiring order)
   - Calls each node's codegen functions in order
   - Writes 4 files to your project directory
4. Status bar shows "Generated 4 files" on success

### What Gets Generated

See [Section 9](#9-understanding-generated-files) for file details.

---

## 9. Understanding Generated Files

### `boards/esp32.overlay` — Device Tree

Maps hardware pins and peripherals. Example for a BTS7960 motor:

```dts
/* Auto-generated by Virtus Firmware Builder — DO NOT EDIT */

&ledc0 {
    status = "okay";
    #address-cells = <1>;
    #size-cells = <0>;
    #pwm-cells = <3>;

    channel@0 {
        reg = <0>;
        timer = <0>;
        /* GPIO18 = RPWM for motor_left */
    };
    channel@1 {
        reg = <1>;
        timer = <0>;
        /* GPIO19 = LPWM for motor_left */
    };
};
```

### `prj.conf` — Kconfig Flags

Enables required subsystems. Example:

```conf
# Auto-generated by Virtus Firmware Builder — DO NOT EDIT

# Optimization: Release Size (-Os, stripped)
CONFIG_SIZE_OPTIMIZATIONS=y
CONFIG_DEBUG_INFO=n
CONFIG_LTO=y

# GPIO
CONFIG_GPIO=y

# PWM
CONFIG_PWM=y
CONFIG_LED=y
```

### `src/virtus_generated.h` — Header

Declares all variables, device specs, and helper function prototypes.

### `src/virtus_generated.c` — Source

Contains `virtus_init()` (called from your `main.c`) plus all helper functions like `motor_left_set(int16_t speed)`.

### Using in main.c

```c
#include "virtus_generated.h"

int main(void) {
    virtus_init();  // Initialize all nodes in dependency order

    while (1) {
        motor_left_set(80);   // 80% forward
        k_sleep(K_MSEC(500));
        motor_left_set(-50);  // 50% reverse
        k_sleep(K_MSEC(500));
    }
}
```

After generating, uncomment the `#include` and `virtus_init()` lines in your `main.c`, and add `src/virtus_generated.c` to your `CMakeLists.txt`:

```cmake
target_sources(app PRIVATE
    src/main.c
    src/virtus_generated.c
)
```

---

## 10. Building Firmware

### From the Sidebar

**Virtus icon** → **Build & Flash** → **Build**

### From the Canvas

Click **Build** in the toolbar (top-right)

### What Happens

The extension runs in a VS Code terminal:
```bash
export ZEPHYR_BASE="/path/to/zephyrproject/zephyr"
cd "/path/to/your/project"
west build -b esp32_devkitc_wroom
```

Build output appears in the terminal. A successful build produces `build/zephyr/zephyr.bin`.

### Build Options (via West Build node)

| Option | What it Does |
|--------|-------------|
| **Board** | Target board for cross-compilation |
| **Optimization** | debug / release_size / release_speed / none |
| **Pristine** | Clean rebuild from scratch |
| **Extra Args** | Additional CMake/west arguments |

---

## 11. Flashing to Hardware

### Prerequisites

- ESP32 connected via USB
- `esptool.py` installed: `pip install esptool`
- Correct serial port configured in settings

### From the Sidebar

**Virtus icon** → **Build & Flash** → **Flash**

### What Happens

```bash
west flash --runner esptool --esp-device COM3
```

The ESP32 automatically resets and runs the firmware.

### Troubleshooting Flash

| Issue | Fix |
|-------|-----|
| "Port not found" | Check `virtus.flashPort` in settings. Run `Device Manager` (Windows) or `ls /dev/ttyUSB*` (Linux). |
| "Permission denied" | Linux: `sudo usermod -a -G dialout $USER`, then log out and back in. |
| "esptool not found" | `pip install esptool` |
| "Failed to connect" | Hold BOOT button on ESP32 while flashing. |

---

## 12. Serial Monitor

**Virtus icon** → **Build & Flash** → **Serial Monitor**

Opens `python -m serial.tools.miniterm` in a terminal at the configured port and baud rate. Shows `printk()` output from the firmware.

Default: 115200 baud (Zephyr console default).

---

## 13. Saving and Loading Flows

### Save

Click **Save** in the toolbar → writes `firmware.virtusflow` (JSON) to your project root.

### Load

When you open the canvas, it automatically loads `firmware.virtusflow` if it exists.

### Version Control

Commit `firmware.virtusflow` to Git alongside your source code. Team members can open the same flow and regenerate code.

The `.virtusflow` file is a JSON document containing:
```json
{
  "nodes": [
    {
      "id": "bts7960_motor_1710700000000",
      "type": "bts7960_motor",
      "position": { "x": 400, "y": 200 },
      "data": {
        "label": "BTS7960 Motor",
        "config": {
          "name": "motor_left",
          "rpwm_pin": 18,
          "lpwm_pin": 19,
          "en_pin": 5
        }
      }
    }
  ],
  "edges": [...]
}
```

---

## 14. Optimization Profiles

Select in the **West Build** node's config panel, or it's applied during code generation to `prj.conf`.

### Debug (default)

```
CONFIG_DEBUG_OPTIMIZATIONS=y    → gcc -Og
CONFIG_DEBUG_INFO=y             → DWARF debug symbols
CONFIG_ASSERT=y                 → Runtime assertions
CONFIG_LOG_DEFAULT_LEVEL=4      → Verbose logging
```

Best for: Development. Full debug info, assertions catch bugs early.

### Release Size

```
CONFIG_SIZE_OPTIMIZATIONS=y     → gcc -Os
CONFIG_LTO=y                    → Link-Time Optimization (dead code removal)
CONFIG_COMPILER_OPT="-ffunction-sections -fdata-sections"
CONFIG_DEBUG_INFO=n             → No debug symbols
CONFIG_ASSERT=n                 → No runtime assertions
```

Best for: **Production deployment**. Smallest binary. Typical savings: 20-40% smaller than debug.

### Release Speed

```
CONFIG_SPEED_OPTIMIZATIONS=y    → gcc -O2
CONFIG_LTO=y                    → Link-Time Optimization
CONFIG_DEBUG_INFO=n
CONFIG_ASSERT=n
```

Best for: Performance-critical firmware where execution speed matters more than binary size.

### None

```
CONFIG_NO_OPTIMIZATIONS=y       → gcc -O0
CONFIG_DEBUG_INFO=y
```

Best for: Step-through debugging with GDB. No code reordering or inlining.

---

## 15. Board Selection

### Change Board

`Ctrl+Shift+P` → **Virtus: Select Board**

Or: **Virtus icon** → **Project** → **Change Board**

### Supported Boards

| Board | Vendor | CPU | Use Case |
|-------|--------|-----|----------|
| **ESP32-DevKitC (WROOM)** | Espressif | Xtensa LX6 240MHz | General purpose, WiFi + BLE |
| **ESP32-S3-DevKitC** | Espressif | Xtensa LX7 240MHz | AI acceleration, USB OTG |
| **ESP32-C3-DevKitM** | Espressif | RISC-V 160MHz | Low-cost, small form factor |
| **nRF52840 DK** | Nordic | Cortex-M4F 64MHz | BLE 5.0, Thread, Zigbee |
| **STM32F411E Discovery** | STMicro | Cortex-M4F 100MHz | Rich peripherals, audio |

### Board Affects

- **Node palette** — only compatible nodes are shown
- **Build command** — `west build -b <board>`
- **DTS overlay** — board-specific peripheral names
- **prj.conf** — board-specific Kconfig

---

## 16. Dynamic Zephyr API Nodes

When `ZEPHYR_BASE` is configured, the extension **scans your installed Zephyr SDK** and auto-generates nodes for every public driver function.

### How It Works

1. Extension reads `ZEPHYR_BASE/include/zephyr/drivers/*.h`
2. Parses function signatures: `int gpio_pin_configure(const struct device *port, gpio_pin_t pin, gpio_flags_t flags);`
3. Creates a node: **"Pin Configure"** with inputs [port], config [pin, flags], output [Result]
4. Groups by subsystem in the palette under **"Zephyr API (v4.0.0)"**

### Covered Subsystems

GPIO, PWM, UART, I2C, SPI, ADC, DAC, Sensor, Counter, Watchdog, Flash, Display, LED, LED Strip, CAN, DMA, EEPROM, Entropy (RNG), RTC, Regulator, Stepper, WiFi, HW Info, Pin Control, Reset, I2S, Comparator, Kernel (k_thread, k_timer, k_sem, etc.)

### Using Dynamic Nodes

1. Set `virtus.zephyrBase` in VS Code settings
2. Open the canvas — nodes are auto-scanned
3. Expand a subsystem group (e.g., "GPIO") in the Zephyr API section
4. Drag a function node onto the canvas
5. Hover for tooltip showing the full C signature

---

## 17. End-to-End Example: Motor Controller

Build a complete motor controller for Porter Robot's ESP32 #1.

### Step 1: Create Project

1. **Create New Project** → name: `porter-motor`
2. Select board: **ESP32-DevKitC (WROOM)**
3. Project opens with scaffold files

### Step 2: Open Canvas

**Virtus icon** → **Build & Flash** → **Open Canvas**

### Step 3: Add Nodes

Drag these from the palette:
1. **BTS7960 Motor** — name: `motor_left`, RPWM: GPIO18, LPWM: GPIO19, EN: GPIO21
2. **BTS7960 Motor** — name: `motor_right`, RPWM: GPIO22, LPWM: GPIO23, EN: GPIO25
3. **UART Bus** — instance: uart2, baud: 115200 (for RPi communication)
4. **Thread** — name: `motor_ctrl`, priority: 0, entry: `motor_ctrl_entry`
5. **Timer** — name: `heartbeat`, period: 200ms, handler: `heartbeat_handler`
6. **West Build** — board: esp32_devkitc_wroom, optimization: release_size

### Step 4: Wire

- UART Bus `RX Data` → Thread `Data In` (UART feeds motor commands to thread)
- Timer `Expiry` → Thread `Data In` (heartbeat checks in the thread)

### Step 5: Configure

Click each node, verify pin numbers match your PCB wiring.

### Step 6: Generate

Click **Generate** → 4 files written.

### Step 7: Edit main.c

```c
#include "virtus_generated.h"
#include <zephyr/drivers/uart.h>

void motor_ctrl_entry(void *p1, void *p2, void *p3) {
    while (1) {
        /* Read motor commands from UART, call motor_left_set() / motor_right_set() */
        k_sleep(K_MSEC(10));
    }
}

void heartbeat_handler(struct k_timer *timer) {
    /* No command received in 500ms → stop motors */
}

int main(void) {
    virtus_init();
    printk("Porter motor controller ready\n");
    /* Threads auto-start via K_THREAD_DEFINE */
    return 0;
}
```

### Step 8: Build & Flash

Click **Build** → wait for success → click **Flash**

---

## 18. Troubleshooting

### "west: unknown command 'build'"

West is installed but not inside a workspace. You need to either:
- Create a project inside `~/zephyrproject/` (the workspace), or
- Set `virtus.zephyrBase` to `~/zephyrproject/zephyr` in VS Code settings

### "ZEPHYR_BASE is not set"

Set it in VS Code Settings → search "Virtus Zephyr Base" → enter path to `zephyr/` directory inside your workspace.

### "No workspace folder open"

Open your project folder in VS Code first (`File → Open Folder`).

### Canvas is blank after opening

The canvas starts empty. Drag nodes from the left palette to get started.

### Generated files have errors

Check that:
- Pin numbers don't conflict (two peripherals on same GPIO)
- UART/I2C/SPI instance numbers are valid for your board
- Alias names are unique and use only `a-z`, `0-9`, `_`

### Build fails with "find_package(Zephyr) failed"

Your project is outside the Zephyr workspace and `ZEPHYR_BASE` is not set. Either:
- Move the project inside `~/zephyrproject/`, or
- Add `-DZEPHYR_BASE=/path/to/zephyrproject/zephyr` to the West Build node's "Extra Arguments"

### Flash fails with "Failed to connect"

1. Check the serial port in settings (`virtus.flashPort`)
2. On ESP32-WROOM, hold the **BOOT** button while flashing
3. Try a different USB cable (some are charge-only)
4. On Linux, check permissions: `sudo usermod -a -G dialout $USER`

---

*Virtus Firmware Builder is an internal VirtusCo tool. For issues, contact Antony Austin.*
