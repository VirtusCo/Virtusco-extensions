# Copyright 2026 VirtusCo
# Virtus AI Studio — FastAPI backend server
"""
Lightweight backend for GPU monitoring, system telemetry, and training
orchestration. Launched by the VS Code extension as a managed child process.

Run manually:
    uvicorn server:app --host 127.0.0.1 --port 47821
"""

from __future__ import annotations

import argparse
import os
import sys

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.hardware import router as hardware_router
from routers.dataset import router as dataset_router
from routers.training import router as training_router
from routers.benchmark import router as benchmark_router
from routers.export import router as export_router
from routers.inference import router as inference_router

# ── App factory ──────────────────────────────────────────────────────

app = FastAPI(
    title="Virtus AI Studio Backend",
    version="0.1.0",
    docs_url="/docs",
    redoc_url=None,
)

# Allow the VS Code webview (served from vscode-webview:// origins) and
# localhost dev servers to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:*",
        "http://127.0.0.1:*",
        "https://localhost:*",
        "https://127.0.0.1:*",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount routers ────────────────────────────────────────────────────

app.include_router(hardware_router)
app.include_router(dataset_router)
app.include_router(training_router)
app.include_router(benchmark_router)
app.include_router(export_router)
app.include_router(inference_router)

# ── Health endpoint ──────────────────────────────────────────────────


@app.get("/health")
async def health():
    """Quick liveness check — returns PID so the extension can track us."""
    return {"status": "ok", "pid": os.getpid()}


# ── CLI entry point ──────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="Virtus AI Studio backend")
    parser.add_argument(
        "--port",
        type=int,
        default=47821,
        help="Port to listen on (default: 47821)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1)",
    )
    args = parser.parse_args()

    uvicorn.run(
        "server:app",
        host=args.host,
        port=args.port,
        log_level="info",
        reload=False,
    )


if __name__ == "__main__":
    main()
