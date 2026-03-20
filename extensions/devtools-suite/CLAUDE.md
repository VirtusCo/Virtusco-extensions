# CLAUDE.md — VirtusCo DevTools Suite (Master Extension)

> Last updated: 19 Mar 2026 · VirtusCo

## Identity

Meta-extension managing all 7 Virtusco VS Code extensions as a unified suite. Installs, configures, and orchestrates all tools with shared config.

## Build

```bash
cd virtusco-devtools-suite && npm install && npm run compile
```

## Managed Extensions (7)

| Extension | ID Pattern | Open Command |
|-----------|-----------|--------------|
| Porter DevTools | porter-devtools | virtus.openBuilder |
| Firmware Builder | virtus-firmware-builder | virtus.openBuilder |
| AI Studio | virtus-ai-studio | virtus-ai.openStudio |
| ROS 2 Studio | virtus-ros2-studio | virtus-ros2.openStudio |
| Hardware Dashboard | virtus-hardware-dashboard | virtus-hw.openDashboard |
| Simulation Manager | virtus-simulation-manager | virtus-sim.openSimManager |
| PCB Studio | virtus-pcb-studio | virtus-pcb.openPCBStudio |

## Pages

| Page | Content |
|------|---------|
| Dashboard | Extension tile grid with status, workspace info, alerts |
| Installer | Extension install status + system dependency checker (9 deps) |
| Config | Shared config: RPi SSH, Zephyr base, workspace paths |
| Setup Wizard | 5-step onboarding: clone, deps, extensions, SSH, ready |

## Key Architecture

- **EventBus** — Cross-extension communication via VS Code commands (`virtusco.bus.*`)
- **SharedConfig** — `virtusco.json` in workspace root, read by all extensions
- **DependencyChecker** — Checks git, uv, python3, node, ros2, colcon, west, nvidia-smi, ssh
- **WorkspaceBootstrapper** — Clones Porter-ROS repo, installs all extension deps

## Fixed (Revisit Session — 20 Mar 2026)

- Extension open commands: fixed all 7 command IDs to match actual package.json values:
  - porter-devtools: `porterRobot.refreshDevices`
  - firmware-builder: `virtus.openBuilder`
  - ai-studio: `virtus-ai.openStudio`
  - ros2-studio: `virtus-ros2.openStudio`
  - hardware-dashboard: `virtus-hw.openDashboard`
  - simulation-manager: `virtusSim.openSimManager`
  - pcb-studio: `virtusPCB.openPCBStudio`

## REMAINING REVISIT (testing — needs hardware/clean machine)

- DependencyChecker: test on Windows (WSL ros2/colcon commands, nvidia-smi path)
- SharedConfig (virtusco.json): test read/write across sub-extensions
- EventBus: test cross-extension events
- WorkspaceBootstrapper: test end-to-end
- Setup Wizard: test full 5-step flow
- InstallerPage "Install All": test with local .vsix files

## Key Rules

- `jsx: 'automatic'` in esbuild (CRITICAL — learned from PCB Studio)
- Static data embedded in store initial state
- PlatformUtils exports individual functions
- `acquireVsCodeApi()` once in vscodeApi.ts
