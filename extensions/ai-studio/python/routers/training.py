# Copyright 2026 VirtusCo
# Training orchestration router — vision and LLM training job management
"""
Manages training subprocesses for YOLO vision and LLM fine-tuning.
Each training run gets a unique job_id. Metrics are streamed via SSE.

Endpoints:
  POST /train/vision       — start YOLO training
  POST /train/llm          — start LLM fine-tuning
  GET  /train/stream/{id}  — SSE metric stream
  POST /train/cancel/{id}  — cancel a running job
"""

from __future__ import annotations

import json
import logging
import os
import signal
import subprocess
import sys
import threading
import uuid
from collections import deque
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/train", tags=["training"])

# ── Job Registry ────────────────────────────────────────────────────

_PYTHON_DIR = Path(__file__).resolve().parent.parent


class TrainingJob:
    """Tracks a training subprocess and its metric buffer."""

    def __init__(self, job_id: str, process: subprocess.Popen[str]) -> None:
        self.job_id = job_id
        self.process = process
        self.events: deque[dict[str, str]] = deque(maxlen=10_000)
        self.finished = threading.Event()
        self.error: str | None = None

    def push_event(self, event: str, data: str) -> None:
        self.events.append({"event": event, "data": data})

    def is_alive(self) -> bool:
        return self.process.poll() is None


_jobs: dict[str, TrainingJob] = {}


def _read_stdout(job: TrainingJob) -> None:
    """Background thread: reads stdout lines from the training subprocess."""
    assert job.process.stdout is not None
    try:
        for raw_line in job.process.stdout:
            line = raw_line.strip()
            if not line:
                continue

            # Attempt to parse as JSON metric
            try:
                parsed = json.loads(line)
                job.push_event("metric", json.dumps(parsed))
            except json.JSONDecodeError:
                # Non-JSON output — log as info
                logger.info("[job:%s] %s", job.job_id[:8], line)
    except Exception as exc:
        logger.error("[job:%s] stdout reader error: %s", job.job_id[:8], exc)
        job.error = str(exc)
    finally:
        # Wait for process to finish
        return_code = job.process.wait()
        if return_code != 0 and job.error is None:
            job.error = f"Process exited with code {return_code}"

        if job.error:
            job.push_event("error", json.dumps({"message": job.error}))
        else:
            job.push_event("done", json.dumps({"status": "completed"}))

        job.finished.set()


def _read_stderr(job: TrainingJob) -> None:
    """Background thread: reads stderr lines from the training subprocess."""
    assert job.process.stderr is not None
    try:
        for raw_line in job.process.stderr:
            line = raw_line.strip()
            if line:
                logger.warning("[job:%s:stderr] %s", job.job_id[:8], line)
    except Exception:
        pass


def _start_training_process(
    script: str, config: dict[str, Any]
) -> TrainingJob:
    """Spawns a training script, pipes config via stdin, and starts readers."""
    job_id = uuid.uuid4().hex
    script_path = str(_PYTHON_DIR / script)

    if not Path(script_path).is_file():
        raise HTTPException(
            status_code=500,
            detail=f"Training script not found: {script_path}",
        )

    python_exe = sys.executable

    process = subprocess.Popen(
        [python_exe, script_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        cwd=str(_PYTHON_DIR),
    )

    # Write config as JSON to stdin
    assert process.stdin is not None
    process.stdin.write(json.dumps(config) + "\n")
    process.stdin.flush()
    process.stdin.close()

    job = TrainingJob(job_id, process)
    _jobs[job_id] = job

    # Start background readers
    stdout_thread = threading.Thread(
        target=_read_stdout, args=(job,), daemon=True
    )
    stderr_thread = threading.Thread(
        target=_read_stderr, args=(job,), daemon=True
    )
    stdout_thread.start()
    stderr_thread.start()

    logger.info(
        "Started training job %s (pid=%d, script=%s)",
        job_id[:8],
        process.pid,
        script,
    )

    return job


# ── SSE Generator ───────────────────────────────────────────────────


def _sse_generator(job: TrainingJob):
    """Yields SSE-formatted events from the job's event buffer."""
    cursor = 0

    while True:
        # Drain buffered events
        while cursor < len(job.events):
            ev = job.events[cursor]
            cursor += 1
            yield f"event: {ev['event']}\ndata: {ev['data']}\n\n"

        # If the job is done and we've drained everything, stop
        if job.finished.is_set():
            # Final drain
            while cursor < len(job.events):
                ev = job.events[cursor]
                cursor += 1
                yield f"event: {ev['event']}\ndata: {ev['data']}\n\n"
            break

        # Wait briefly for more events
        job.finished.wait(timeout=0.25)


# ── Endpoints ───────────────────────────────────────────────────────


@router.post("/vision")
async def start_vision_training(request: dict[str, Any]) -> dict[str, str]:
    """Start a YOLO vision training subprocess."""
    required = ["model", "dataset_yaml", "epochs"]
    for key in required:
        if key not in request:
            raise HTTPException(
                status_code=400, detail=f"Missing required field: {key}"
            )

    config = {
        "model": request["model"],
        "dataset_yaml": request["dataset_yaml"],
        "epochs": int(request.get("epochs", 100)),
        "batch_size": int(request.get("batch_size", 16)),
        "imgsz": int(request.get("imgsz", 640)),
        "lr0": float(request.get("lr0", 0.01)),
        "augmentation": bool(request.get("augmentation", True)),
        "early_stopping_patience": int(
            request.get("early_stopping_patience", 50)
        ),
        "export_onnx_after": bool(request.get("export_onnx_after", False)),
        "project_name": request.get("project_name", "porter_vision"),
    }

    job = _start_training_process("vision/train_yolo.py", config)
    return {"job_id": job.job_id}


@router.post("/llm")
async def start_llm_training(request: dict[str, Any]) -> dict[str, str]:
    """Start an LLM fine-tuning subprocess."""
    required = ["base_model", "dataset_jsonl"]
    for key in required:
        if key not in request:
            raise HTTPException(
                status_code=400, detail=f"Missing required field: {key}"
            )

    config = {
        "base_model": request["base_model"],
        "dataset_jsonl": request["dataset_jsonl"],
        "method": request.get("method", "lora"),
        "lora_r": int(request.get("lora_r", 16)),
        "lora_alpha": int(request.get("lora_alpha", 32)),
        "lora_dropout": float(request.get("lora_dropout", 0.05)),
        "target_modules": request.get(
            "target_modules",
            ["q_proj", "k_proj", "v_proj", "o_proj"],
        ),
        "epochs": int(request.get("epochs", 3)),
        "batch_size": int(request.get("batch_size", 4)),
        "grad_accumulation": int(request.get("grad_accumulation", 4)),
        "learning_rate": float(request.get("learning_rate", 2e-4)),
        "warmup_ratio": float(request.get("warmup_ratio", 0.03)),
        "max_seq_length": int(request.get("max_seq_length", 1024)),
        "eval_steps": int(request.get("eval_steps", 50)),
        "save_steps": int(request.get("save_steps", 100)),
        "output_dir": request.get("output_dir", "./runs/llm"),
        "export_after": request.get(
            "export_after",
            {"merge_weights": False, "export_gguf": False},
        ),
    }

    job = _start_training_process("llm/finetune_lora.py", config)
    return {"job_id": job.job_id}


@router.get("/stream/{job_id}")
async def stream_metrics(job_id: str):
    """Stream training metrics as Server-Sent Events."""
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    return StreamingResponse(
        _sse_generator(job),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/cancel/{job_id}")
async def cancel_training(job_id: str) -> dict[str, str]:
    """Cancel a running training job."""
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    if not job.is_alive():
        return {"status": "already_finished"}

    # Send interrupt signal
    try:
        if sys.platform == "win32":
            # Windows: send CTRL_BREAK_EVENT or terminate
            job.process.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            job.process.send_signal(signal.SIGINT)
    except OSError:
        # Process may have already exited
        pass

    # Wait briefly for graceful shutdown
    try:
        job.process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        job.process.kill()

    job.error = "Cancelled by user"
    job.push_event("error", json.dumps({"message": "Cancelled by user"}))
    job.finished.set()

    logger.info("Cancelled training job %s", job_id[:8])
    return {"status": "cancelled"}
