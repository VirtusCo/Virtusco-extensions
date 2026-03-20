# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working on the VirtusCo VS Code extension suite.

## Project Overview

This repository contains the complete VirtusCo VS Code extension suite -- 8 extensions that provide a full development environment for the Porter autonomous luggage robot. Each extension is a standalone VS Code extension with its own package.json, esbuild config, and webview UI built with React + React Flow.

**Repo**: `github.com/austin207/virtusco-extensions` | **Branch**: `main` | **License**: Proprietary (VirtusCo)

## Repository Structure

```
virtusco-extensions/
├── extensions/
│   ├── porter-devtools/        # Firmware flash + RPi deployment
│   ├── firmware-builder/       # Visual Zephyr node canvas + codegen
│   ├── ai-studio/              # MLOps: train, benchmark, export, deploy
│   ├── ros2-studio/            # Topic monitor, node graph, FSM, launch builder
│   ├── hardware-dashboard/     # Live telemetry, alerts, power event log
│   ├── simulation-manager/     # Gazebo profiles, Nav2 tuning, bag manager
│   ├── pcb-studio/             # KiCad viewer, PCB layout, Gerber, DRC
│   └── devtools-suite/         # Master meta-extension, installs/manages all
├── shared/                     # Shared utilities (if any)
└── .github/workflows/ci.yml   # Matrix build for all 8 extensions
```

Each extension follows the same internal structure:
```
extensions/<name>/
├── src/
│   ├── extension.ts            # activate() entry point
│   ├── panels/                 # Webview panel providers
│   ├── providers/              # Sidebar webview view providers
│   └── webview/                # React webview source
│       ├── App.tsx
│       ├── components/
│       ├── stores/             # Zustand stores
│       └── vscodeApi.ts        # Single acquireVsCodeApi() call
├── esbuild.mjs                 # Dual-bundle: extension host + webview
├── package.json
└── tsconfig.json
```

## Build Commands (Any Extension)

```bash
cd extensions/<name>

# Install dependencies
npm install

# Build (esbuild dual-bundle: extension host + webview)
npm run compile

# Watch mode for development
npm run watch

# Lint (ESLint, strict TypeScript)
npm run lint

# Package as .vsix
npm run package
# or: npx @vscode/vsce package --no-dependencies

# Debug: F5 in VS Code launches Extension Development Host
```

## Build All Extensions

```bash
for ext in porter-devtools firmware-builder ai-studio ros2-studio hardware-dashboard simulation-manager pcb-studio devtools-suite; do
  (cd extensions/$ext && npm install && npm run compile)
done
```

## Extension Details

| Extension | Key Feature | Sidebar Views |
|-----------|-------------|---------------|
| porter-devtools | Firmware flash + RPi deploy over SSH | Flash, Deploy, Serial |
| firmware-builder | Visual Zephyr node canvas, DTS/prj.conf/C codegen | Canvas, Node Library, Properties |
| ai-studio | Train YOLO/LLM/RL, benchmark, export HEF/GGUF/ONNX | Train, Benchmark, Export, Deploy |
| ros2-studio | Live topic monitor, node graph, 9-state FSM, launch builder | Topics, Nodes, FSM, Launch |
| hardware-dashboard | Power rails, motor current, sensor readings, alerts | Telemetry, Alerts, Events, Schematic |
| simulation-manager | Gazebo launch profiles, URDF preview, Nav2 27-param editor | Profiles, URDF, Nav2, Bags, Worlds |
| pcb-studio | KiCad schematic viewer, 14-component PCB builder, BOM | Schematic, Builder, BOM, DRC, Diff |
| devtools-suite | Master meta-extension, cross-extension event bus | Dashboard, Extensions, Config |

## Critical Rules (Learned from 8 Extensions)

### Webview Architecture
- `acquireVsCodeApi()` is called **ONCE** in `vscodeApi.ts` and exported -- never call it in components
- Every sidebar webview needs `registerWebviewViewProvider()` in `activate()`
- Use `getUri()` helper for webview resource URIs (CSP-compliant)
- Webview to Extension communication via `postMessage()` / `onDidReceiveMessage()`

### React & State Management
- React Flow nodes stored in local `useState`, **NOT** in Zustand stores
- Static data (component libraries, parameter defaults) embedded in store initial state, not via postMessage
- Zustand stores for application state only (settings, connection status, history)

### esbuild Configuration
- Dual-bundle: one for extension host (Node target), one for webview (browser target)
- `jsx: 'automatic'` (React 17+ JSX transform)
- `define: { "process.env.NODE_ENV": '"production"' }`
- `minify: true` for production builds
- Native modules (`serialport`, `ssh2`) go in esbuild `external` array

### TypeScript
- Strict mode enabled, no `any` types
- `camelCase` for file names, `PascalCase` for types/interfaces/components
- PlatformUtils exports individual functions, not a class

### UI
- No emojis in UI text
- Inline styles with VS Code CSS variables (`var(--vscode-editor-background)`, etc.)
- Dark theme compatible -- always use VS Code theme tokens

### Common Pitfalls
- Forgetting to dispose webview providers in `deactivate()` causes memory leaks
- `postMessage` from extension to webview is fire-and-forget (no error if webview is hidden)
- esbuild watch mode: restart needed if you change esbuild.mjs itself
- `@vscode/vsce package` fails if package.json has invalid repository field

## Git Conventions

- Conventional commits: `<type>(<scope>): <description>`
- Types: `feat`, `fix`, `docs`, `test`, `build`, `ci`, `refactor`, `chore`
- Scopes: `firmware-builder`, `ai-studio`, `ros2-studio`, `hardware-dashboard`, `simulation-manager`, `pcb-studio`, `devtools-suite`, `porter-devtools`, `shared`

## CI/CD

- `ci.yml`: Matrix build across all 8 extensions -- install, compile, lint, package VSIX
- VSIX artifacts uploaded per extension
- All jobs run on `ubuntu-latest` with Node 20
