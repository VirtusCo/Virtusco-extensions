# CLAUDE.md — Porter DevTools VSCode Extension

> **Single-source-of-truth for Claude Code working on this extension.**
> Read `../porter_robot/OBJECTIVES.md` for project goals, hardware architecture, and timeline.
> Read `../porter_robot/COMPANY.md` for company context, team, product vision.
>
> Last updated: 15 Mar 2026 · VirtusCo — Engineer: Antony Austin
> Repo: `github.com/austin207/Porter-ROS` · Extension root: `porter-vscode-extension/`

---

## 1. Extension Identity

| Field | Value |
|-------|-------|
| **Extension Name** | Porter DevTools |
| **Display Name** | Porter DevTools — VirtusCo |
| **Publisher** | VirtusCo (internal distribution only) |
| **Extension ID** | `virtusco.porter-devtools` |
| **Purpose** | Internal developer tool for flashing firmware + deploying software to Porter Robot hardware |
| **Modeled After** | Nordic nRF Connect for VS Code — Activity Bar + sidebar TreeViews |
| **Language** | TypeScript (strict mode) |
| **Min VS Code** | ^1.85.0 |
| **Node.js** | >=18.0.0 |

### What This Extension Does

Helps VirtusCo developers:
1. **Browse GitHub Releases** — fetch release list from `austin207/Porter-ROS`, view artifacts
2. **Download Artifacts** — download pre-built binaries with SHA256 verification
3. **Flash ESP32 Firmware** — flash `motor_controller.bin` / `sensor_fusion.bin` via `esptool.py`
4. **Deploy to Raspberry Pi** — upload Docker image + Flutter GUI bundle via SSH/SFTP
5. **Detect Devices** — auto-detect ESP32 on USB serial, configure RPi SSH target
6. **Serial Monitor** — webview-based serial terminal for ESP32 debugging
7. **Quick Deploy** — one-click deployment: click a release version → auto-maps artifacts to hardware targets → downloads, verifies, and flashes/deploys everything

### What This Extension Does NOT Do

- Does **not** build firmware (developers use `west build` or CI/CD for that)
- Does **not** replace the CI/CD pipeline — it consumes release artifacts produced by `build-release.yml`
- Does **not** manage ROS 2 nodes, topics, or parameters (use `rqt` / CLI for that)
- Does **not** edit robot configuration files

---

## 2. Hardware Context

### Target Devices

| Device | Quantity | Connection | Flashing Method | What Gets Flashed |
|--------|----------|------------|-----------------|-------------------|
| **ESP32 #1** (Motor Controller) | 1 | USB Serial (CP2102/CH340) | `esptool.py` | `motor_controller.bin` |
| **ESP32 #2** (Sensor Fusion) | 1 | USB Serial (CP2102/CH340) | `esptool.py` | `sensor_fusion.bin` |
| **Raspberry Pi 5** (Master Compute) | 1 | SSH over WiFi/Ethernet | SCP + Docker CLI | Docker image + Flutter GUI bundle |

### ESP32 Flashing Details

Two flashing modes supported:

#### Mode 1: Release Binary Flashing (esptool.py) — Primary

For flashing pre-built `.bin` files downloaded from GitHub Releases.

- **Flash tool**: `esptool.py` (Python, installed via `pip install esptool`)
- **Command pattern**:
  ```bash
  esptool.py --chip esp32 --port <PORT> --baud 460800 write_flash 0x1000 <FIRMWARE.bin>
  ```
- **When to use**: Downloading release artifacts and flashing — the primary extension workflow.

#### Mode 2: Local Build Flashing (west flash) — Secondary

For developers who built firmware locally and have a full Zephyr build directory.

- **Flash tool**: `west flash` (requires Zephyr workspace + build dir)
- **Command pattern**:
  ```bash
  west flash --build-dir <BUILD_DIR>
  ```
  `west flash` reads the build directory's runner config and calls `esptool.py` under the hood for ESP32.
- **When to use**: Developer built firmware locally with `west build` and wants to flash from the build output directly, without downloading from releases.
- **Requires**: Zephyr SDK installed, `west` on PATH, a valid `build/` directory from `west build`

#### Shared Details (both modes)

- **Chip**: `esp32` (ESP32-DevKitC-WROOM)
- **Flash address**: `0x1000` (Zephyr default for ESP32)
- **Baud rate for flashing**: `460800` (esptool fast mode)
- **Baud rate for serial monitor**: `115200` (Zephyr default console)
- **USB VID/PID for detection**:
  - CP2102: `10c4:ea60`
  - CH340: `1a86:7523`
  - Espressif native USB: `303a:1001`

### RPi Deployment Details

- **Docker image**: `porter-robot-{version}.tar.gz` → `docker load` → `docker compose up -d`
- **Flutter GUI**: `porter-gui-linux-x64-{version}.tar.gz` → extract `bundle/` → restart GUI
- **Connection**: SSH (key-based auth preferred, password supported)
- **Docker Compose file on RPi**: `docker/docker-compose.prod.yml`

### Porter Binary Protocol (for device identification)

When multiple ESP32s are connected and udev rules aren't set, the extension can send protocol packets to identify which firmware is running on which port:

- Wire format: `[0xAA 0x55][Length][Command][Payload...][CRC16-CCITT]`
- `CMD_MOTOR_STATUS = 0x03` → motor controller responds
- `CMD_SENSOR_STATUS = 0x14` → sensor fusion responds
- CRC16-CCITT: poly `0x1021`, init `0xFFFF`

---

## 3. GitHub Release Artifacts

The CI/CD pipeline (`build-release.yml`) produces these artifacts per release:

| Artifact | Filename Pattern | Target |
|----------|-----------------|--------|
| Docker image | `porter-robot-{version}.tar.gz` | RPi |
| Motor firmware | `motor_controller.bin` | ESP32 #1 |
| Motor debug | `motor_controller.elf` | GDB debugging |
| Sensor firmware | `sensor_fusion.bin` | ESP32 #2 |
| Sensor debug | `sensor_fusion.elf` | GDB debugging |
| Flutter GUI | `porter-gui-linux-x64-{version}.tar.gz` | RPi |
| Checksums | `SHA256SUMS.txt` | Verification |
| Build info | `BUILD_INFO.txt` | Metadata |

- **GitHub repo**: `austin207/Porter-ROS`
- **Branches**: `main` (full release), `prototype` (prerelease)
- **Tag format**: `v{semver}` (e.g., `v0.3.2`), or `v{semver}+{sha}` for duplicate versions
- **API**: GitHub REST API via `@octokit/rest`

---

## 4. Extension Architecture

### UX Pattern (nRF Connect Style)

```
┌─ Activity Bar ──────────────────────────────────────────┐
│  [Porter Logo Icon]                                      │
│                                                          │
│  ┌─ DEVICES ──────────────────────────────────────────┐ │
│  │  ▼ ESP32 Devices                                   │ │
│  │    ● COM3 — Motor Controller          [Flash] [Mon]│ │
│  │    ● COM4 — Sensor Fusion             [Flash] [Mon]│ │
│  │  ▼ Raspberry Pi                                    │ │
│  │    ● 192.168.1.100 — Connected        [Deploy]     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ RELEASES ─────────────────────────────────────────┐ │
│  │  ▼ v0.3.2 (latest)            [🚀 Deploy] [⬇ All]  │ │
│  │    ├ motor_controller.bin  (42 KB)     [⬇]         │ │
│  │    ├ sensor_fusion.bin     (38 KB)     [⬇]         │ │
│  │    ├ porter-robot-0.3.2.tar.gz (512MB) [⬇]         │ │
│  │    └ porter-gui-linux-x64-0.3.2.tar.gz [⬇]        │ │
│  │  ▷ v0.3.1 (prerelease)                             │ │
│  │  ▷ v0.3.0                                          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ ACTIONS ──────────────────────────────────────────┐ │
│  │  ▶ Flash Motor Controller                          │ │
│  │  ▶ Flash Sensor Fusion                             │ │
│  │  ▶ Deploy Docker Image to RPi                      │ │
│  │  ▶ Deploy Flutter GUI to RPi                       │ │
│  │  ▶ Open Serial Monitor                             │ │
│  │  ▶ Verify Checksums                                │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Status Bar ───────────────────────────────────────┐ │
│  │ $(plug) 2 ESP32 │ $(remote) RPi: Online │ v0.3.2  │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Source Layout

```
porter-vscode-extension/
├── CLAUDE.md                              ← THIS FILE
├── package.json                           ← Extension manifest (THE critical file)
├── tsconfig.json                          ← TypeScript config (strict mode)
├── .eslintrc.json                         ← ESLint config
├── .vscodeignore                          ← VSIX packaging exclusions
│
├── resources/
│   ├── icons/
│   │   ├── porter-logo.svg               ← Activity Bar icon
│   │   ├── esp32.svg                     ← ESP32 device tree icon
│   │   ├── raspberry-pi.svg              ← RPi device tree icon
│   │   ├── flash.svg                     ← Flash action icon
│   │   ├── deploy.svg                    ← Deploy action icon
│   │   ├── serial.svg                    ← Serial monitor icon
│   │   ├── connected.svg                 ← Green dot status
│   │   ├── disconnected.svg              ← Red dot status
│   │   ├── download.svg                  ← Download icon
│   │   └── release.svg                   ← GitHub release icon
│   └── webview/
│       ├── serialMonitor.html            ← Serial monitor template
│       └── serialMonitor.css             ← Serial monitor styles
│
├── src/
│   ├── extension.ts                      ← Entry point: activate() / deactivate()
│   ├── constants.ts                      ← Repo, artifact patterns, VID/PIDs, defaults
│   │
│   ├── config/
│   │   └── settings.ts                   ← VSCode settings wrappers (porterRobot.*)
│   │
│   ├── models/
│   │   ├── types.ts                      ← Interfaces: Release, Artifact, Device, FlashConfig
│   │   └── enums.ts                      ← DeviceType, ConnectionStatus, ArtifactType
│   │
│   ├── providers/                        ← Sidebar TreeView providers
│   │   ├── devicesTreeProvider.ts        ← Connected devices (ESP32 + RPi)
│   │   ├── releasesTreeProvider.ts       ← GitHub releases + artifacts
│   │   └── actionsTreeProvider.ts        ← Context-aware action list
│   │
│   ├── services/
│   │   ├── githubService.ts              ← GitHub API: list releases, download artifacts
│   │   ├── serialService.ts              ← Serial port enumeration + I/O
│   │   ├── esptoolService.ts             ← ESP32 flashing via esptool.py subprocess (release binaries)
│   │   ├── westFlashService.ts           ← ESP32 flashing via west flash (local builds)
│   │   ├── sshService.ts                 ← SSH/SFTP to RPi for deployment
│   │   ├── checksumService.ts            ← SHA256 verification
│   │   └── deviceDetectionService.ts     ← USB device polling + classification
│   │
│   ├── commands/
│   │   ├── flashCommands.ts              ← Flash motor/sensor ESP32 commands
│   │   ├── deployCommands.ts             ← Deploy Docker/Flutter to RPi commands
│   │   ├── releaseCommands.ts            ← Refresh/download release commands
│   │   ├── serialCommands.ts             ← Serial monitor commands
│   │   ├── deviceCommands.ts             ← Scan/identify device commands
│   │   └── quickDeployCommand.ts         ← One-click deploy: auto-map artifacts → hardware
│   │
│   ├── views/
│   │   └── serialMonitorPanel.ts         ← Webview panel for serial terminal
│   │
│   ├── statusBar/
│   │   └── statusBarManager.ts           ← Status bar items (ESP32, RPi, version)
│   │
│   └── utils/
│       ├── logger.ts                     ← OutputChannel-based logging
│       ├── downloader.ts                 ← HTTP download with progress
│       └── platformUtils.ts              ← OS-specific paths, esptool detection
│
└── test/
    ├── suite/
    │   ├── extension.test.ts             ← Activation tests
    │   ├── githubService.test.ts         ← API mock tests
    │   ├── checksumService.test.ts       ← SHA256 tests
    │   ├── esptoolService.test.ts        ← esptool command generation tests
    │   └── westFlashService.test.ts      ← west flash command generation tests
    └── runTest.ts                        ← Mocha test runner
```

---

## 5. Dependencies

### Production
| Package | Purpose |
|---------|---------|
| `@octokit/rest` | GitHub REST API client (releases, artifacts) |
| `serialport` | Serial port access (device detection + serial monitor) |
| `@serialport/parser-readline` | Line-by-line serial data parsing |
| `ssh2` | SSH/SFTP client for RPi deployment |

### Development
| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript compiler |
| `@types/vscode` | VS Code API types |
| `@types/node` | Node.js types |
| `@types/ssh2` | SSH2 types |
| `eslint` | Linter |
| `@typescript-eslint/eslint-plugin` | TS lint rules |
| `@typescript-eslint/parser` | TS parser for ESLint |
| `@vscode/test-electron` | Extension integration tests |
| `mocha` | Test runner |
| `@types/mocha` | Mocha types |
| `@vscode/vsce` | VSIX packaging |

---

## 6. VS Code Settings (porterRobot.*)

The extension exposes these user/workspace settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `porterRobot.github.token` | string | `""` | GitHub PAT for API access (required for private repos, raises rate limit to 5000/hr) |
| `porterRobot.github.owner` | string | `"austin207"` | GitHub repository owner |
| `porterRobot.github.repo` | string | `"Porter-ROS"` | GitHub repository name |
| `porterRobot.rpi.host` | string | `""` | RPi IP address or hostname |
| `porterRobot.rpi.username` | string | `"pi"` | RPi SSH username |
| `porterRobot.rpi.sshKeyPath` | string | `"~/.ssh/id_rsa"` | Path to SSH private key |
| `porterRobot.rpi.dockerComposePath` | string | `"/home/pi/porter/docker/docker-compose.prod.yml"` | Docker Compose file path on RPi |
| `porterRobot.flash.mode` | string | `"esptool"` | Flash mode: `"esptool"` (release binaries) or `"west"` (local builds) |
| `porterRobot.esptool.path` | string | `""` | Custom path to esptool.py (auto-detected if empty) |
| `porterRobot.flash.baudRate` | number | `460800` | Baud rate for esptool flashing |
| `porterRobot.flash.address` | string | `"0x1000"` | Flash base address for ESP32 |
| `porterRobot.flash.chip` | string | `"esp32"` | Target chip for esptool |
| `porterRobot.west.path` | string | `""` | Custom path to `west` binary (auto-detected if empty) |
| `porterRobot.west.buildDir` | string | `""` | Zephyr build directory for `west flash` (e.g., `~/zephyrproject/build`) |
| `porterRobot.serial.baudRate` | number | `115200` | Baud rate for serial monitor |
| `porterRobot.serial.autoScroll` | boolean | `true` | Auto-scroll serial monitor output |
| `porterRobot.artifactsDir` | string | `"~/.porter-robot/artifacts"` | Download directory for release artifacts |
| `porterRobot.deviceDetection.pollIntervalMs` | number | `3000` | USB device detection polling interval |

---

## 7. Commands

All commands are prefixed with `porterRobot.`:

| Command | Title | Description |
|---------|-------|-------------|
| `porterRobot.refreshDevices` | Scan Devices | Re-scan USB serial ports for ESP32 devices |
| `porterRobot.identifyDevice` | Identify Device | Send protocol packet to identify motor vs sensor ESP32 |
| `porterRobot.configureRpi` | Configure RPi | Set up RPi SSH connection (host, user, key) |
| `porterRobot.refreshReleases` | Refresh Releases | Fetch latest releases from GitHub |
| `porterRobot.downloadArtifact` | Download Artifact | Download a single release artifact |
| `porterRobot.downloadAllArtifacts` | Download All | Download all artifacts for a release |
| `porterRobot.flashMotorController` | Flash Motor Controller | Flash motor_controller.bin to ESP32 (esptool or west based on setting) |
| `porterRobot.flashSensorFusion` | Flash Sensor Fusion | Flash sensor_fusion.bin to ESP32 (esptool or west based on setting) |
| `porterRobot.flashCustom` | Flash Custom | Pick port, file, address manually (esptool mode) |
| `porterRobot.westFlashMotor` | West Flash Motor | Flash motor controller from local build dir via `west flash` |
| `porterRobot.westFlashSensor` | West Flash Sensor | Flash sensor fusion from local build dir via `west flash` |
| `porterRobot.selectFlashMode` | Select Flash Mode | Toggle between esptool (release) and west (local build) modes |
| `porterRobot.deployDocker` | Deploy Docker Image | Upload + load Docker image on RPi |
| `porterRobot.deployFlutterGui` | Deploy Flutter GUI | Upload + extract Flutter GUI on RPi |
| `porterRobot.openSerialMonitor` | Open Serial Monitor | Open webview serial terminal |
| `porterRobot.closeSerialMonitor` | Close Serial Monitor | Close serial terminal |
| `porterRobot.verifyChecksums` | Verify Checksums | Verify downloaded artifacts against SHA256SUMS.txt |
| `porterRobot.quickDeploy` | Quick Deploy | One-click: auto-map release artifacts to hardware targets, download + verify + flash/deploy all |

---

## 8. Implementation Rules

### Code Style

- **TypeScript strict mode** — `"strict": true` in `tsconfig.json`
- **ES2022 target** — modern JS features, async/await everywhere
- **No `any`** — use proper types, interfaces, and generics
- **Naming**: `camelCase` for variables/functions, `PascalCase` for classes/interfaces/enums, `UPPER_SNAKE` for constants
- **File naming**: `camelCase.ts` for all source files
- **Imports**: use ES module syntax, group by: vscode → external packages → internal modules (blank line between groups)
- **Error handling**: always catch and surface errors to user via `vscode.window.showErrorMessage()`, log details to output channel
- **Disposables**: every service, provider, and event listener must implement `vscode.Disposable` and be pushed to `context.subscriptions`

### Architecture Rules

1. **Services are singletons** — instantiated once in `activate()`, passed to commands and providers via constructor injection
2. **TreeView providers emit change events** — call `this._onDidChangeTreeData.fire()` to refresh UI
3. **Commands never import services directly** — they receive service references from `extension.ts`
4. **All external process calls (esptool, ssh) must have timeout handling** — never hang indefinitely
5. **All downloads must verify checksums** — auto-verify after download, warn user if mismatch
6. **Platform-specific code isolated in `platformUtils.ts`** — no inline `process.platform` checks scattered across codebase
7. **Settings accessed via `settings.ts` wrappers** — never call `vscode.workspace.getConfiguration()` directly from services

### Extension Lifecycle

```
activate()
  ├── Create Logger (OutputChannel)
  ├── Create Services
  │   ├── GitHubService
  │   ├── SerialService
  │   ├── DeviceDetectionService (starts polling)
  │   ├── EsptoolService
  │   ├── WestFlashService
  │   ├── SshService
  │   └── ChecksumService
  ├── Create TreeView Providers
  │   ├── DevicesTreeProvider (uses DeviceDetectionService)
  │   ├── ReleasesTreeProvider (uses GitHubService)
  │   └── ActionsTreeProvider (watches devices + downloads)
  ├── Register Commands (inject services)
  ├── Create StatusBarManager
  └── Push all disposables to context.subscriptions

deactivate()
  ├── Stop device detection polling
  ├── Close all serial ports
  ├── Disconnect SSH
  └── Dispose all resources
```

### Build & Test

```bash
# Install dependencies
cd porter-vscode-extension
npm install

# Compile TypeScript
npm run compile

# Watch mode (development)
npm run watch

# Run linter
npm run lint

# Run tests
npm run test

# Package as VSIX
npx vsce package

# Install locally
code --install-extension porter-devtools-{version}.vsix
```

### Debug / Dev Workflow

1. Open `porter-vscode-extension/` in VS Code
2. Press `F5` to launch Extension Development Host
3. The Porter DevTools icon appears in the Activity Bar
4. Test with real hardware or mock scenarios

---

## 9. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Flash tool (release binaries) | `esptool.py` (subprocess) | Release artifacts are standalone `.bin` files. esptool can flash any `.bin` to any address directly. Official, well-maintained. |
| Flash tool (local builds) | `west flash` (subprocess) | For devs who built firmware locally with `west build`. Uses the build directory's runner config. Calls esptool under the hood for ESP32. |
| Dual flash modes | Setting-based toggle | `porterRobot.flash.mode` = `"esptool"` or `"west"`. Both modes share device detection and serial monitor. Commands auto-dispatch to the correct service. |
| GitHub API client | `@octokit/rest` | Handles auth, pagination, rate limiting, typed responses. Better than raw fetch for repo that may go private. |
| Serial access | `serialport` npm | Programmatic byte-level access needed for device identification via protocol packets. VS Code Terminal API only gives text I/O. |
| Serial monitor UI | Webview panel | Rich toolbar (baud selector, port selector, clear, save log, hex/ASCII toggle). VS Code Pseudoterminal is too limited. |
| Artifact storage | `~/.porter-robot/artifacts/{version}/` | Outside workspace to avoid accidental git commits. Shared across workspaces. Version-organized. |
| RPi deployment | SSH/SFTP via `ssh2` | Direct programmatic control with progress reporting. Alternative (rsync CLI) has poor progress parsing. |
| Device identification | Protocol probing | Sends `CMD_MOTOR_STATUS`/`CMD_SENSOR_STATUS` packets to disambiguate ESP32s when udev rules aren't set. |
| Quick Deploy | Auto-mapping + modal confirmation | Classifies artifacts by `ArtifactType`, assigns ESP32 ports by identified `DeviceType` (falls back to port order), shows plan before executing. Prevents accidental flashing of wrong firmware to wrong board. |

---

## 10. Known Platform Considerations

| Platform | Consideration | Handling |
|----------|--------------|----------|
| **Windows** | COM port names (`COM3`, `COM4`) | Detect via `serialport` VID/PID, show COM name in UI |
| **Windows** | esptool.py path | Check `%APPDATA%\Python\Scripts\esptool.py` and PATH |
| **Linux** | `/dev/ttyUSB*` permissions | Detect `EACCES`, suggest `sudo usermod -a -G dialout $USER` |
| **Linux** | esptool.py path | Check `~/.local/bin/esptool.py` and PATH |
| **All** | `serialport` native bindings | `@serialport/bindings-cpp` ships prebuilds for Win x64, Linux x64, macOS arm64/x64 |
| **All** | Large file SSH transfer (500MB+ Docker images) | SFTP stream with progress events, chunked upload |
| **All** | GitHub API rate limit | 60/hr unauthenticated, 5000/hr with PAT. Show remaining in status bar. |

---

## 11. Lessons Learned (from Porter Robot project)

These lessons from the main project apply here too:

1. **Never guess — read first.** Check `package.json`, `tsconfig.json`, and existing code before modifying.
2. **Disposables matter.** Every event listener, interval, and service must be properly disposed on deactivate.
3. **Test on real hardware.** Serial port detection and esptool behave differently on different OS + USB adapter combos.
4. **Checksums are non-negotiable.** Always verify after download. Flashing a corrupt binary can brick an ESP32 (recoverable, but annoying).
5. **Error messages must be actionable.** "Flash failed" is useless. "Flash failed: esptool.py not found. Install with `pip install esptool`" is helpful.
6. **Progress indicators for all long operations.** Flashing, downloading, SSH transfers — always show progress with cancel option.

---

## 12. Git Conventions

Same as the main Porter Robot project:

- **Conventional commits**: `<type>(<scope>): <description>`
- **Types**: `feat`, `fix`, `docs`, `test`, `build`, `ci`, `perf`, `refactor`, `chore`
- **Scope for this extension**: `ext` (e.g., `feat(ext): add ESP32 flash progress indicator`)
- **Branch**: work on `prototype` branch
- **No force pushes to `main` or `prototype`**
