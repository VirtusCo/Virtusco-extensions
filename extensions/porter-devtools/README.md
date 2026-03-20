# Porter DevTools — VirtusCo

Internal VS Code extension for flashing firmware and deploying software to Porter Robot hardware.

## Features

- **Browse GitHub Releases** — fetch and view release artifacts from Porter-ROS
- **Download Artifacts** — download pre-built binaries with SHA256 verification
- **Flash ESP32 Firmware** — flash via esptool.py (release binaries) or west (local builds)
- **Deploy to Raspberry Pi** — upload Docker images and Flutter GUI via SSH
- **Quick Deploy** — one-click: select a release version and auto-deploy everything
- **Device Detection** — auto-detect ESP32 devices on USB serial
- **Serial Monitor** — webview-based serial terminal for ESP32 debugging

## Installation

Download the `.vsix` file from the latest [GitHub Release](https://github.com/austin207/Porter-ROS/releases), then:

```bash
code --install-extension porter-devtools-*.vsix
```

Or in VS Code: `Ctrl+Shift+P` → **Extensions: Install from VSIX...**

## Setup

1. Open VS Code Settings (`Ctrl+,`) and search for `Porter`
2. Set **GitHub Token** — required for private repo access
3. Set **RPi Host** — IP address of your Raspberry Pi (for deployment)
4. Ensure `esptool.py` is installed (`pip install esptool`) for ESP32 flashing

## Usage

1. Click the **Porter DevTools** icon in the Activity Bar (left sidebar)
2. **Devices** panel shows connected ESP32s and configured RPi
3. **Releases** panel lists available versions — click the rocket icon for Quick Deploy
4. **Actions** panel shows available operations based on connected hardware

## Requirements

- VS Code 1.85.0+
- Python + `esptool` (for ESP32 flashing)
- SSH key configured (for RPi deployment)
- GitHub PAT with `repo` scope (for private repo access)
