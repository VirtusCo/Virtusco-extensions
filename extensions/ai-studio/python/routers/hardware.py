# Copyright 2026 VirtusCo
# Hardware monitoring router — GPU telemetry and system info
"""
Exposes GPU state via pynvml and system metrics via psutil.

All endpoints are non-blocking and return JSON dicts that map directly
to the GpuState / SystemInfo TypeScript interfaces on the webview side.
"""

from __future__ import annotations

import logging
from typing import Any

import psutil
from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hardware", tags=["hardware"])

# ── NVIDIA helpers ───────────────────────────────────────────────────

_nvml_available: bool | None = None


def _ensure_nvml() -> bool:
    """Lazy-init pynvml. Returns True if NVIDIA GPU is accessible."""
    global _nvml_available
    if _nvml_available is not None:
        return _nvml_available
    try:
        import pynvml

        pynvml.nvmlInit()
        _nvml_available = True
    except Exception:
        logger.warning("pynvml not available — GPU monitoring disabled")
        _nvml_available = False
    return _nvml_available


def _read_gpu() -> dict[str, Any]:
    """Read GPU telemetry from device index 0."""
    import pynvml

    handle = pynvml.nvmlDeviceGetHandleByIndex(0)

    name = pynvml.nvmlDeviceGetName(handle)
    if isinstance(name, bytes):
        name = name.decode("utf-8")

    mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
    vram_total_mb = mem_info.total / (1024 * 1024)
    vram_used_mb = mem_info.used / (1024 * 1024)
    vram_free_mb = mem_info.free / (1024 * 1024)

    # Power (milliwatts -> watts)
    try:
        power_draw_w = pynvml.nvmlDeviceGetPowerUsage(handle) / 1000.0
    except pynvml.NVMLError:
        power_draw_w = 0.0

    try:
        power_limit_w = pynvml.nvmlDeviceGetEnforcedPowerLimit(handle) / 1000.0
    except pynvml.NVMLError:
        power_limit_w = 0.0

    # Utilization
    try:
        util = pynvml.nvmlDeviceGetUtilizationRates(handle)
        gpu_util_pct = util.gpu
    except pynvml.NVMLError:
        gpu_util_pct = 0

    # Temperature
    try:
        temperature_c = pynvml.nvmlDeviceGetTemperature(
            handle, pynvml.NVML_TEMPERATURE_GPU
        )
    except pynvml.NVMLError:
        temperature_c = 0

    # Throttle detection: drawing > 92% of power limit
    is_throttled = (
        power_limit_w > 0 and power_draw_w > 0.92 * power_limit_w
    )

    return {
        "name": name,
        "vram_total_mb": round(vram_total_mb, 1),
        "vram_used_mb": round(vram_used_mb, 1),
        "vram_free_mb": round(vram_free_mb, 1),
        "power_draw_w": round(power_draw_w, 1),
        "power_limit_w": round(power_limit_w, 1),
        "gpu_util_pct": gpu_util_pct,
        "is_throttled": is_throttled,
        "temperature_c": temperature_c,
    }


# ── Endpoints ────────────────────────────────────────────────────────


@router.get("/gpu")
async def get_gpu() -> dict[str, Any]:
    """Return GPU state or a graceful error if NVIDIA is unavailable."""
    if not _ensure_nvml():
        return {
            "error": "nvidia_unavailable",
            "message": "No NVIDIA GPU detected or pynvml failed to initialize.",
        }
    try:
        return _read_gpu()
    except Exception as exc:
        logger.exception("Failed to read GPU state")
        return {"error": "gpu_read_failed", "message": str(exc)}


@router.get("/system")
async def get_system() -> dict[str, Any]:
    """Return host system metrics (CPU, memory, disk)."""
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    return {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "cpu_count": psutil.cpu_count(logical=True),
        "memory": {
            "total_mb": round(mem.total / (1024 * 1024), 1),
            "available_mb": round(mem.available / (1024 * 1024), 1),
            "used_mb": round(mem.used / (1024 * 1024), 1),
            "percent": mem.percent,
        },
        "disk": {
            "total_gb": round(disk.total / (1024**3), 1),
            "used_gb": round(disk.used / (1024**3), 1),
            "free_gb": round(disk.free / (1024**3), 1),
            "percent": disk.percent,
        },
    }
