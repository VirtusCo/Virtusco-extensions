# CLAUDE.md — Virtus Hardware Dashboard

> Last updated: 19 Mar 2026 · VirtusCo

## Identity

Live hardware telemetry dashboard for Virtus robot. Receives JSON telemetry from RPi 5 over USB serial (10Hz), renders power rails, motor drivers, sensors, alerts.

## Build

```bash
cd virtus-hardware-dashboard && npm install && npm run compile
```

## Architecture

- **TelemetryReceiver** — serialport + ReadlineParser, JSON packet parsing, auto-detect by VID/PID
- **TelemetryStore** — 600-sample ring buffer (60s), per-field history
- **AlertEngine** — threshold evaluation with 5s cooldown (voltage, current, temp, sensor agreement)
- **AlertLogger** — JSONL file with 10MB rotation, CSV export
- **SchematicIndex** — click telemetry field → opens firmware source at relevant line

## Pages

| Page | Content |
|------|---------|
| Overview | 4-card grid: power, motors, sensors, alerts |
| Power | 3 voltage rails with bars + trends + relay states |
| Motors | L/R BTS7960: duty, current, temp estimate, 30s history |
| Sensors | ToF, Ultrasonic, Microwave, Kalman + agreement check |
| Alerts | Active alerts + threshold config form |
| Event Log | JSONL timeline with filter + CSV export |

## Key Rules

- Native modules (`serialport`) externalized in esbuild
- `acquireVsCodeApi()` once in `vscodeApi.ts`
- No emojis, CSS-only charts, inline styles
