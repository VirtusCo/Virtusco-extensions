# CLAUDE.md — Virtus ROS 2 Studio VS Code Extension

> **Single-source-of-truth for Claude Code working on this extension.**
> Last updated: 19 Mar 2026 · VirtusCo — Engineer: Antony Austin

---

## 1. Extension Identity

| Field | Value |
|-------|-------|
| **Extension Name** | Virtus ROS 2 Studio |
| **Purpose** | Porter robot-specific ROS 2 dev environment — topic monitor, node graph, FSM viewer, ESP32 bridge debugger, n8n-style launch builder, project management |
| **Language** | TypeScript (strict) + React 18 |
| **Min VS Code** | ^1.85.0 |
| **Canvas Library** | React Flow (`@xyflow/react`) for node graph + launch builder canvas |
| **ROS 2 Bridge** | CLI-based (`ros2` commands via child_process), WSL on Windows |

## 2. Build & Dev

```bash
cd virtus-ros2-studio
npm install
npm run compile     # Both bundles
npm run watch       # Watch mode
npm run lint        # ESLint
```

Debug: F5 in VS Code → Extension Development Host.

## 3. Architecture

```
Extension Host                      Webview
├── src/ros2/ROS2Bridge.ts          ├── pages/TopicMonitorPage.tsx
├── src/ros2/NodeGraphReader.ts     ├── pages/NodeGraphPage.tsx
├── src/fsm/FSMTracker.ts           ├── pages/FSMViewerPage.tsx
├── src/esp32/FrameDecoder.ts       ├── pages/BridgeDebuggerPage.tsx
├── src/launch/LaunchGenerator.ts   ├── pages/LaunchBuilderPage.tsx (React Flow canvas)
├── src/project/ProjectManager.ts   └── pages/CommandsPage.tsx
└── src/providers/ (3 sidebar)
```

## 4. Launch Builder Canvas — 40+ Nodes

| Category | Count | Nodes |
|----------|-------|-------|
| Virtus | 7 | YDLIDAR, LIDAR Processor, Orchestrator, ESP32 Motor/Sensor Bridge, AI Assistant, GUI |
| Navigation | 7 | Nav2 Bringup, AMCL, Controller, Planner, BT Navigator, Map Server, Costmap 2D |
| Sensor | 4 | RPLidar, RealSense, USB Camera, IMU Filter |
| TF | 4 | Robot State Publisher, Joint State, Static TF, EKF |
| ROS 2 Primitives | 10 | Publisher, Subscriber, Service/Action Server/Client, Timer, Lifecycle, Composable, Container |
| Communication | 3 | Rosbridge, Serial, Micro-ROS Agent |
| Simulation | 3 | Gazebo Server/Client, Controller Manager |
| Diagnostics | 4 | Diagnostic Aggregator/Updater, RQt Graph, RViz2 |

ROS 2 Primitive nodes have a `language` param (python/cpp) for code generation.

## 5. Project Management

- **New Workspace** — Creates ROS 2 workspace with `src/`, `colcon.meta`, `.gitignore`
- **New Package** — C++ (ament_cmake) or Python (ament_python) with full scaffold (node template, launch file, package.xml)
- **Open Project** — 3 modes: Current Window, New Window, Add to Workspace

## 6. Sidebar

| View | Type | Content |
|------|------|---------|
| Status | webview | ROS 2 connection, project buttons, auto-opens studio |
| Nodes | tree | ROS 2 nodes grouped by package with health status |
| Topics | tree | All topics with type, Hz, status badges |

## 7. New Features (Revisit Session — 20 Mar 2026)

### Workspace Import
- `WorkspaceScanner` scans existing ROS 2 workspace: parses package.xml, scans C++/Python source for publishers/subscribers/services/timers using regex, parses launch files
- Returns full topology: packages, nodes, topic connections
- "Import Workspace" button on canvas → folder picker → auto-populates canvas with discovered nodes and connections

### Typed Port Compatibility
- 50+ ROS 2 message types registered in `ROS2MsgTypes.ts` across sensor_msgs, geometry_msgs, nav_msgs, std_msgs, etc.
- Each port on every canvas node specifies its message type
- Connection validation: only matching msg types can connect (LaserScan→LaserScan, Twist→Twist)
- Ports color-coded by package (sensor_msgs=blue, geometry_msgs=green, nav_msgs=orange)

### Production Code Generation
- `ROS2CodeGenerator` generates COMPLETE ROS 2 packages from canvas:
  - **Python**: package.xml, setup.py, setup.cfg, __init__.py, node source with all pub/sub/srv/timer/param, launch.py, params.yaml
  - **C++**: package.xml, CMakeLists.txt, header (.hpp), source (.cpp) with full implementation, launch.py, params.yaml
- Generated code follows ament_flake8/ament_cpplint conventions
- QoS auto-selected: SensorDataQoS for sensor topics, default for control topics
- All parameters properly declared with typed defaults

### Package Generation
- "Generate Package" button → dialog for name/language/description → writes all files to workspace
- Dependencies auto-computed from message types used

## 8. REMAINING REVISIT

- Browse buttons for path inputs across all pages
- Topic Monitor / Node Graph / FSM / Bridge: test with live ROS 2 + hardware
- Commands page Windows WSL testing
- Test imported workspace graph accuracy on porter_robot/ workspace

## 8. Key Rules

- `acquireVsCodeApi()` called ONCE in `vscodeApi.ts` — all components import from there
- esbuild: `define: { "process.env.NODE_ENV": '"production"' }` + `minify: true`
- All `ros2` CLI calls via `PlatformUtils.ros2Cmd()` (auto-WSL on Windows)
- No emojis in UI
- Native modules (ws) must be in esbuild `external` array
- `PlatformUtils` exports individual functions, not a class — import `{ Platform, ros2Cmd, toWslPath }` not `PlatformUtils`

## 9. Lessons Learned

| # | Mistake | Fix |
|---|---------|-----|
| 1 | Imported `PlatformUtils` as a named class but it exports individual functions | Use `import { Platform, toWslPath }` not `import { PlatformUtils }` |
| 2 | `openProject` used `vscode.openFolder` which kills Extension Dev Host debug session | Added "Add to Workspace" option using `updateWorkspaceFolders()` |
