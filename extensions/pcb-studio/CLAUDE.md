# CLAUDE.md — Virtus PCB Studio

> Last updated: 19 Mar 2026 · VirtusCo

## Identity

KiCad schematic viewer + visual PCB builder + pinout sync checker + BOM viewer + firmware impact analyzer. Bridges Danush's hardware world and Antony's firmware world.

## Build

```bash
cd virtus-pcb-studio && npm install && npm run compile
```

## Pages (11 total)

| Page | Content |
|------|---------|
| Schematic | KiCad S-expression parser, SVG renderer with pan/zoom, net highlight |
| Sync | Pinout sync: 16-entry net→DTS mapping, compares schematic vs .overlay |
| BOM | Bill of Materials with LCSC links, CSV export, coverage stats |
| Diff | Git-based schematic diff, human-readable change list |
| Impact | Firmware impact analysis: greps firmware dirs for affected pins/nets |
| Builder | React Flow schematic canvas with 14-component library, drag-and-drop, .kicad_sch export |
| Components | Library browser with pinout diagrams |
| **PCB Layout** | SVG-based PCB editor: footprint placement, trace routing, via insertion, multi-layer, grid snap, ratsnest, auto-route |
| **Gerber Viewer** | RS-274X parser + SVG renderer, per-layer toggle, export all |
| **DRC** | Design rule checker: clearance, trace width, unconnected nets, courtyard overlap, via rules, board edge |
| **Cost** | JLCPCB pricing: PCB area/layer/quantity, component BOM pricing, SMT assembly, CSV export |

## PCB Layout Engine

- **40+ footprints**: DIP, SOIC, QFP, QFN, SOT-23/223, 0402-2512, TO-220, USB-C, JST, pin headers, ESP32, Arduino Nano, BTS7960, relay, sensors
- **Multi-layer**: F.Cu, B.Cu, In1.Cu, In2.Cu, F.SilkS, B.SilkS, F.Mask, B.Mask, Edge.Cuts, F.Paste, B.Paste
- **Trace routing**: configurable width, Manhattan auto-router, via layer switching
- **DRC**: 6 check types with geometric helpers (point-to-segment distance, segment intersection, point-in-polygon)
- **Gerber generation**: RS-274X for all layers + Excellon drill files
- **Netlist export**: KiCad .net format + IPC-D-356
- **Cost estimation**: JLCPCB pricing model (area, layers, quantity multipliers) + per-component pricing for 40+ parts

## Builder Component Library (14)

Passive: Resistor, Capacitor, Diode, LED
IC: BTS7960, ESP32-WROOM, Arduino Nano
Sensor: VL53L0X, HC-SR04, RCWL-0516
Power: LM7805, AMS1117-3.3
Other: Relay Module, USB-C Connector

## Key Rules

- `acquireVsCodeApi()` once in `vscodeApi.ts`
- PlatformUtils exports individual functions
- S-expression parser handles KiCad 6+ format
- SVG rendering is pure string generation (no DOM in host)
- Git operations use `child_process.execSync`
- esbuild MUST have `jsx: 'automatic'` in webview config to match tsconfig `"jsx": "react-jsx"`

## Fixed (Revisit Session — 20 Mar 2026)

- Builder: fixed export functions referencing old store variables (components/wires → nodes/edges)
- Builder: added right-click context menu (Copy, Cut, Duplicate, Delete)
- Builder: added keyboard shortcuts (Delete, Ctrl+C/X/V/D)
- Builder: added right config panel on node click (edit reference, value, view pins)
- Builder: added onNodeClick, onNodeContextMenu, onPaneClick, snapToGrid

## REMAINING REVISIT

- PCB Layout: verify 144fps native event performance on large boards (50+ footprints)
- PCB Layout: test trace routing mode end-to-end (click pad → waypoints → double-click to finish)
- PCB Layout: test via placement during trace routing
- PCB Layout: test R (rotate) and F (flip) keyboard shortcuts on placed footprints
- PCB Layout: test auto-router on multi-net designs
- PCB Layout: drag-from-library drop position accuracy (coordinate transform)
- Gerber Viewer: test RS-274X parser with real Gerber files
- Gerber Generation: validate output with KiCad Gerber viewer or online viewer
- DRC: test all 6 violation types with intentional design rule violations
- Cost Estimator: validate JLCPCB pricing accuracy against real quotes
- Builder (schematic): verify BuilderNode renders after useState refactor
- Schematic viewer: test with actual .kicad_sch file
- Sync checker: test with real .overlay + .kicad_sch
- BOM/Diff/Impact: test with real files

## Performance Architecture (144fps target)

- Native `addEventListener` on SVG for mousemove/mouseup/wheel — bypasses React synthetic events
- Drag: `element.setAttribute('transform', 'translate(dx,dy)')` — GPU composite, no layout/paint
- Pan: direct `svg.setAttribute('viewBox', ...)` — no React re-render
- All interactive state in `useRef` — zero re-renders during mouse operations
- React state synced on mouseUp only

## Lessons Learned

| # | Mistake | Fix |
|---|---------|-----|
| 1 | esbuild webview config missing `jsx: 'automatic'` | Without it, esbuild defaults to classic JSX transform requiring `import React` in every .tsx file. Add `jsx: 'automatic'` to match tsconfig's `react-jsx`. **MUST add to all new extensions.** |
| 2 | React Flow used without `ReactFlowProvider` wrapper | React Flow throws if not wrapped in `ReactFlowProvider`. Always wrap `<ReactFlow>` in `<ReactFlowProvider>`. |
| 3 | Circular state: Zustand store → React Flow nodes → onNodesChange → back to store | `applyNodeChanges()` doesn't preserve custom `data.component` structure. Fix: manage React Flow nodes/edges in local `useState`, NOT in Zustand. Store is only for static data (library). |
| 4 | Component library empty on load — race condition | Host sends `builderLibrary` message before webview listener is registered. Fix: embed default library directly in Zustand store initial state. Don't rely on host message for static data. |
| 5 | `NodeProps` type casting in @xyflow/react v12 | `data` in NodeProps is `Record<string, unknown>`. Must cast as `unknown` first: `const d = data as unknown as MyType`. Direct cast fails silently. |
