# CLAUDE.md — Virtus AI Studio VS Code Extension

> **Single-source-of-truth for Claude Code working on this extension.**
> Last updated: 19 Mar 2026 · VirtusCo — Engineer: Antony Austin
> Repo: `github.com/austin207/Porter-ROS` · Root: `virtus-ai-studio/`

---

## 1. Extension Identity

| Field | Value |
|-------|-------|
| **Extension Name** | Virtus AI Studio |
| **Publisher** | VirtusCo (internal) |
| **Purpose** | Complete MLOps workbench: train, benchmark, export, deploy AI models to Virtus robot |
| **Language** | TypeScript (strict) + React 18 + Python (FastAPI backend) |
| **Min VS Code** | ^1.85.0 |
| **Bundler** | esbuild (dual-bundle: extension host + webview) |
| **GPU** | NVIDIA RTX 5070 Laptop (8 GB VRAM) |
| **Deployment** | RPi 5 + Hailo-10H AI HAT+ |

## 2. Architecture

### Two-Bundle + Python Backend

```
Extension Host (Node.js)            Webview (Browser)           Python (FastAPI)
├── src/extension.ts                ├── webview-ui/src/App.tsx   ├── python/server.py
├── src/panel/AIStudioPanel.ts      ├── pages/DashboardPage.tsx  ├── routers/hardware.py
├── src/hardware/GpuProbe.ts        ├── components/              └── routers/...
├── src/python/PythonBridge.ts      └── store/aiStudioStore.ts
├── src/platform/PlatformUtils.ts
├── src/providers/
│   ├── DashboardViewProvider.ts
│   ├── HardwareTreeProvider.ts
│   └── JobsTreeProvider.ts
└── src/hardware/
    ├── RPiConnector.ts
    └── HailoProbe.ts
```

- Extension host ↔ Webview: `postMessage` (JSON)
- Extension host ↔ Python: HTTP (`localhost:47821`) + SSE for streaming
- GPU probing: **direct nvidia-smi** (no Python needed)

## 3. Build & Dev

```bash
cd virtus-ai-studio
npm install
npm run compile     # Build both bundles
npm run watch       # Watch mode
npm run lint        # ESLint
```

Debug: Open folder → F5 → Extension Development Host.

## 4. Sidebar (Activity Bar)

| View | Type | Provider | Content |
|------|------|----------|---------|
| Dashboard | webview | `DashboardViewProvider` | GPU stats, VRAM advisor, RPi/Hailo quick status |
| Hardware | tree | `HardwareTreeProvider` | GPU details, RPi connection, Hailo models |
| Jobs & Runs | tree | `JobsTreeProvider` | Active training jobs, completed run history |

## 5. Code Style

- TypeScript strict mode, no `any`
- `camelCase` files, `PascalCase` types
- `PlatformUtils` for ALL OS-specific logic — never inline `process.platform`
- Conventional commits: `feat(ai-studio): ...`
- Copyright header: `// Copyright 2026 VirtusCo`

## 6. VS Code Settings (`virtus-ai.*`)

| Setting | Default | Purpose |
|---------|---------|---------|
| `virtus-ai.rpiHost` | `""` | RPi IP for SSH |
| `virtus-ai.rpiUsername` | `pi` | SSH username |
| `virtus-ai.rpiSshKeyPath` | `~/.ssh/id_rsa` | SSH key path |

## 7. Lessons Learned (bugs fixed during development)

**Never repeat these mistakes.**

| # | Mistake | Why It Broke | Correct Approach |
|---|---------|-------------|-----------------|
| 1 | `GpuProbe` depended on Python backend for nvidia-smi | Backend couldn't start without a workspace folder open → "No GPU detected" even though nvidia-smi works fine natively. GPU monitoring should be zero-dependency. | Call `nvidia-smi` directly via `child_process.execFile()` from TypeScript. No Python backend needed for hardware probing. The backend is only needed for training/export. |
| 2 | No `WebviewViewProvider` registered for sidebar webview | `package.json` declared `"virtus-ai.dashboard"` as `"type": "webview"` but no provider was registered via `registerWebviewViewProvider()`. VS Code showed an infinite loading spinner. | Every sidebar webview view declared in `package.json` MUST have a matching `registerWebviewViewProvider()` call in `activate()`. Tree views use `registerTreeDataProvider()`. |
| 3 | `acquireVsCodeApi()` called twice (App.tsx + DashboardPage.tsx) | VS Code only allows one call to `acquireVsCodeApi()` per webview. Second call throws, silently killing React rendering — panel appeared blank with no errors. | Create a shared `vscodeApi.ts` module: `export const vscode = acquireVsCodeApi();` — all components import from this single source. Never call `acquireVsCodeApi()` in any component file. |
| 4 | RTX 5070 Laptop GPU returns `[N/A]` for power limit | `parseFloat("[N/A]")` returns `NaN`, throttle calculation `NaN > 0.92 * NaN` is always false but power_limit_w was garbage. | Strip brackets with regex, check for `"N/A"` string, set power_limit to 0. Throttle detection: `powerLimit > 0 ? powerDraw > 0.92 * powerLimit : false`. |
| 5 | Missing CSS file reference in webview HTML | `AIStudioPanel` referenced `dist/webview.css` but esbuild only produces a CSS file when CSS is imported in the source. No CSS imports → no file → broken `<link>` tag. | Only add `<link rel="stylesheet" href="${cssUri}">` when the bundle actually produces CSS (e.g., when importing `@xyflow/react/dist/style.css`). Check `dist/` after build. |
| 6 | React development build in webview (891 KB vs 140 KB) | esbuild `define` for `process.env.NODE_ENV` was missing or set to `"development"`. React includes massive dev-mode warnings and checks. | Always set `define: { "process.env.NODE_ENV": '"production"' }` in esbuild webview config. Also set `minify: true` for webview bundles. Result: 1.1 MB → 156 KB. |
| 7 | `node-ssh` / `ssh2` native `.node` binaries can't be bundled | esbuild can't process native Node.js addon files (`.node`). Build fails with "No loader configured for .node files". | Add native modules to `external` array in esbuild config: `external: ["vscode", "node-ssh", "ssh2", "cpu-features"]`. They're resolved at runtime from `node_modules/`. |
| 8 | esbuild webview missing `jsx: 'automatic'` | "React is not defined" error. esbuild defaults to classic JSX needing `import React` in every file. | Add `jsx: 'automatic'` to esbuild webview config to match tsconfig's `"jsx": "react-jsx"`. |
| 9 | React Flow nodes managed in Zustand with circular updates | `applyNodeChanges()` strips custom `data.component`. Nodes disappear from canvas. | Manage React Flow nodes/edges in local `useState`, not Zustand. Store is for static data only. |
| 10 | Static data (component library) sent via postMessage arrives before listener | Race condition — webview renders empty. | Embed default static data directly in Zustand initial state. Don't rely on host message timing. |

## 8. Phased Build Plan

| Phase | Status | Scope |
|-------|--------|-------|
| 1 — Foundation | **Done** | Extension scaffold, GPU probe, VRAM advisor, sidebar, Dashboard |
| 2 — Dataset Manager | **Done** | YOLO dataset ops, LLM pair editor, ShareGPT JSONL |
| 3 — Model Research | **Done** | Curated registry (8 models), auto-recommend, compat matrix |
| 4 — Vision Training | **Done** | YOLOv8 training with live metrics, config form, SSE streaming |
| 5 — LLM Fine-Tuning | **Done** | QLoRA/LoRA Qwen 2.5 1.5B, Unsloth, VRAM advisor integration |
| 6 — RL Training | **Done** | SAC/PPO/TD3 via SB3, reward curves, TorchScript export |
| 7 — Benchmark | **Done** | Multi-run comparison table, scatter plot, delta columns |
| 8 — Export Pipeline | **Done** | HEF (vision+LLM), GGUF (Q4_K_M), ONNX, TorchScript + ExportStepper |
| 9 — Inference Testing | **Done** | Vision BBox results, LLM ChatPlayground (4 modes, 4 languages) |
| 10 — Deploy | **Done** | SSH deploy with progress, systemd services, runtime mode selector |
| 11 — Hardening | In progress | Error handling, logging, testing |
