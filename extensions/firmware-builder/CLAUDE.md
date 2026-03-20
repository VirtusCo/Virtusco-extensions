# CLAUDE.md — Virtus Firmware Builder VS Code Extension

> **Single-source-of-truth for Claude Code working on this extension.**
> Last updated: 18 Mar 2026 · VirtusCo — Engineer: Antony Austin
> Repo: `github.com/austin207/Porter-ROS` · Root: `virtus-firmware-builder/`

---

## 1. Extension Identity

| Field | Value |
|-------|-------|
| **Extension Name** | Virtus Firmware Builder |
| **Publisher** | VirtusCo (internal) |
| **Purpose** | Visual node-based firmware development for ESP32 / nRF / STM32 (Zephyr RTOS) |
| **Language** | TypeScript (strict) + React 18 |
| **Min VS Code** | ^1.85.0 |
| **Canvas Library** | React Flow (`@xyflow/react`) |
| **State Management** | Zustand |
| **Bundler** | esbuild (dual-bundle: extension host + webview) |

## 2. Architecture

### Two-Bundle Architecture (Critical)

Extension host (Node.js) and webview (Chromium sandbox) are **completely separate JavaScript environments**. Communication is via `postMessage` only — no shared memory.

```
Extension Host (Node.js)            Webview (Browser sandbox)
├── src/extension.ts                ├── webview-ui/src/App.tsx
├── src/panel/                      ├── webview-ui/src/store/flowStore.ts
│   └── FirmwareBuilderPanel.ts     ├── webview-ui/src/nodes/registry.ts
├── src/codegen/                    ├── webview-ui/src/components/VirtusNode.tsx
│   ├── index.ts (orchestrator)     ├── webview-ui/src/panels/NodePalette.tsx
│   ├── nodeRegistry.ts (codegen)   ├── webview-ui/src/panels/ConfigPanel.tsx
│   ├── dtsGen.ts                   └── webview-ui/src/codegen/bridge.ts
│   ├── confGen.ts
│   └── codeGen.ts
├── src/flash/westRunner.ts
├── src/project/
│   ├── projectManager.ts
│   ├── boardDatabase.ts
│   └── zephyrScanner.ts
└── src/providers/
    ├── projectWebviewProvider.ts
    ├── boardTreeProvider.ts
    └── actionsTreeProvider.ts
         ↕ postMessage (JSON)
```

esbuild produces `dist/extension.js` (cjs, node) and `dist/webview.js` (esm, browser).

### Adding a New Static Node

Two changes:
1. Add `VirtusNodeDefUI` to `webview-ui/src/nodes/registry.ts` (UI: label, ports, config, colors)
2. Add `RegistryEntry` to `src/codegen/nodeRegistry.ts` (codegen: DTS, prj.conf, C header/source)

Everything else (palette, config panel, codegen orchestrator) works automatically.

### Dynamic Nodes (Zephyr API Scanner)

The extension scans `ZEPHYR_BASE/include/zephyr/drivers/*.h` at runtime, parses function signatures, and generates nodes dynamically. Scanner lives in `src/project/zephyrScanner.ts`. Results are sent to the webview via `dynamicNodes` message and merged into the palette under "Zephyr API" sections grouped by subsystem.

## 3. Build & Dev

```bash
cd virtus-firmware-builder
npm install
npm run compile     # Build both bundles
npm run watch       # Watch mode for development
npm run lint        # ESLint
npm run package     # Package as .vsix
```

Debug: Open `virtus-firmware-builder/` in VS Code → F5 → Extension Development Host launches.

## 4. Sidebar (Activity Bar)

The extension registers an Activity Bar icon with three sidebar views:

| View | Provider | Content |
|------|----------|---------|
| **Project** | `ProjectWebviewProvider` (webview) | Create/Open project, current workspace info, board display |
| **Board & Peripherals** | `BoardTreeProvider` (tree) | Selected board specs, peripheral list with instances/channels |
| **Build & Flash** | `ActionsTreeProvider` (tree) | Open Canvas, Generate, Build, Flash, Monitor, Menuconfig, Clean |

## 5. Generated Output Files

| File | Content |
|------|---------|
| `boards/esp32.overlay` | DTS aliases + peripheral node config |
| `prj.conf` | CONFIG_* flags + optimization profile (debug/release_size/release_speed) |
| `src/virtus_generated.h` | Extern declarations, device specs, helper prototypes |
| `src/virtus_generated.c` | `virtus_init()` + peripheral init + helper functions |

Generated files are additive — `#include`-d by `main.c`, never overwritten.

## 6. Message Protocol

Webview → Host: `saveFlow`, `generateCode`, `flashDevice`, `runBuild`, `openMonitor`, `requestLoad`
Host → Webview: `loadFlow`, `boardChanged`, `dynamicNodes`, `buildStatus`, `flashStatus`, `monitorData`, `codegenStatus`

All types in `src/types.ts`.

## 7. Connection Validation

Port types enforce wiring rules — only same-type connections allowed:
- **Signal** (blue ◆) → Signal only — digital on/off, interrupts, PWM output
- **Data** (green ■) → Data only — sensor readings, bus data, buffers
- **Power** (orange ●) → Power only — power supply lines

Validated in `App.tsx` via `isValidConnection` callback on ReactFlow.

## 8. Build Optimization Profiles

Configured in `confGen.ts`, selectable in the West Build node:

| Profile | Kconfig | GCC Flag | Use Case |
|---------|---------|----------|----------|
| `debug` | `CONFIG_DEBUG_OPTIMIZATIONS=y` | `-Og` | Development with debug info |
| `release_size` | `CONFIG_SIZE_OPTIMIZATIONS=y` + `CONFIG_LTO=y` | `-Os` | Production — smallest binary |
| `release_speed` | `CONFIG_SPEED_OPTIMIZATIONS=y` + `CONFIG_LTO=y` | `-O2` | Production — fastest execution |
| `none` | `CONFIG_NO_OPTIMIZATIONS=y` | `-O0` | Step-through debugging |

## 9. Board Database

Curated in `src/project/boardDatabase.ts`. Currently: ESP32-WROOM, ESP32-S3, ESP32-C3, nRF52840 DK, STM32F411 Discovery. Each board defines supported peripherals and compatible node types for palette filtering.

## 10. Project Management

`src/project/projectManager.ts` handles:
- **Workspace detection** — checks `ZEPHYR_BASE`, `~/zephyrproject`, VS Code settings
- **Workspace init** — runs `west init` + `west update` + `pip install requirements` + `west zephyr-export` (one-time)
- **Project creation** — scaffolds `CMakeLists.txt`, `prj.conf`, `src/main.c` inside the workspace
- **Board selection** — QuickPick with board specs, saves to `virtus.selectedBoard` setting

## 11. Node Tiers

| Tier | Category | Count | Examples |
|------|----------|-------|----------|
| 1 | Peripheral | 8 | GPIO Output/Input, PWM, UART, I2C, SPI, ADC, BLE |
| 2 | RTOS | 7 | Thread, Timer, Semaphore, Mutex, Work, MsgQ, FIFO |
| 3 | Composite | 5 | BTS7960 Motor, ToF, Ultrasonic, Sensor Fusion UART, Kalman |
| 4 | Pipeline | 5 | West Build, Flash, Serial Monitor, Menuconfig, Clean |
| Dynamic | Zephyr API | 100+ | Auto-scanned from `ZEPHYR_BASE` headers per subsystem |

## 12. Code Style

- TypeScript strict mode, no `any`
- `camelCase` for variables/files, `PascalCase` for types/classes
- Conventional commits: `feat(firmware-builder): ...`
- Copyright header: `// Copyright 2026 VirtusCo`

## 13. VS Code Settings (`virtus.*`)

| Setting | Default | Purpose |
|---------|---------|---------|
| `virtus.zephyrBase` | `""` | Path to Zephyr base (ZEPHYR_BASE) |
| `virtus.westPath` | `""` | Path to west binary |
| `virtus.selectedBoard` | `esp32_devkitc_wroom` | Current target board |
| `virtus.flashPort` | `/dev/ttyUSB0` | Serial port for flashing |
| `virtus.flashBaud` | `460800` | Baud rate for esptool |
| `virtus.monitorBaud` | `115200` | Baud rate for serial monitor |
