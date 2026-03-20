# CLAUDE.md — Virtus Simulation Manager

> Last updated: 19 Mar 2026 · VirtusCo

## Identity

Gazebo simulation manager for Virtus Porter robot. One-click launch profiles, URDF preview, Nav2 parameter editor, bag file manager, scenario runner, world manager.

## Build

```bash
cd virtus-simulation-manager && npm install && npm run compile
```

## Pages

| Page | Content |
|------|---------|
| Launch | 4 profiles (bare/nav2/full/ai), sequenced step spawning with delays, process tracker |
| URDF | Parser, link/joint tree, validation warnings, 3D viewer placeholder |
| Nav2 | 27 params across 5 groups with descriptions, YAML read/write, Apply & Restart |
| Bags | 4 recording presets, scan/record/play/stop, file browser |
| Scenarios | JSON scenario format, obstacle/passenger editor, run with success criteria |
| Worlds | .world file browser, active world indicator, switch |

## Key Rules

- `acquireVsCodeApi()` once in `vscodeApi.ts`
- PlatformUtils exports individual functions
- `launchCmd()` wraps ROS 2 commands with `wsl` on Windows
- Process cleanup in `deactivate()` — no zombie Gazebo
- Nav2 YAML: manual parsing, no js-yaml dependency
