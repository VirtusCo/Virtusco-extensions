# Copyright 2026 VirtusCo
# Export router — model conversion endpoints (GGUF, HEF, ONNX, TorchScript)
"""
Provides export endpoints that convert trained models into deployment-ready
formats. Supports SSE streaming for multi-step progress reporting.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["export"])


def _generate_job_id() -> str:
    """Generate a unique job identifier."""
    return f"export_{uuid.uuid4().hex[:12]}"


def _sse_event(event: str, data: Any) -> str:
    """Format a Server-Sent Event."""
    payload = json.dumps(data) if isinstance(data, dict) else str(data)
    return f"event: {event}\ndata: {payload}\n\n"


def _step_event(step_index: int, status: str, log: str = "") -> str:
    """Create a step progress SSE event."""
    return _sse_event("step", {
        "step_index": step_index,
        "status": status,
        "log": log,
    })


# ── GGUF Export ──────────────────────────────────────────────────────


@router.post("/gguf")
async def export_gguf(request: dict[str, Any]) -> StreamingResponse:
    """
    Merge LoRA adapter + convert to GGUF + quantize.
    Returns SSE stream with step progress.
    """
    lora_adapter_path = request.get("lora_adapter_path", "")
    base_model = request.get("base_model", "")
    quant_method = request.get("quant_method", "Q4_K_M")
    output_path = request.get("output_path", "")

    if not lora_adapter_path:
        raise HTTPException(status_code=400, detail="lora_adapter_path is required")
    if not base_model:
        raise HTTPException(status_code=400, detail="base_model is required")
    if not output_path:
        raise HTTPException(status_code=400, detail="output_path is required")

    async def generate():
        output_dir = Path(output_path).parent
        output_dir.mkdir(parents=True, exist_ok=True)
        merged_dir = output_dir / "merged_model"

        # Step 0: Merge LoRA
        yield _step_event(0, "running", f"Merging LoRA adapter from {lora_adapter_path}...")

        try:
            from peft import PeftModel
            from transformers import AutoModelForCausalLM, AutoTokenizer

            tokenizer = AutoTokenizer.from_pretrained(base_model)
            model = AutoModelForCausalLM.from_pretrained(
                base_model,
                torch_dtype="auto",
                device_map="auto",
            )
            model = PeftModel.from_pretrained(model, lora_adapter_path)
            model = model.merge_and_unload()

            merged_dir.mkdir(parents=True, exist_ok=True)
            model.save_pretrained(str(merged_dir))
            tokenizer.save_pretrained(str(merged_dir))

            yield _step_event(0, "done", f"Merged model saved to {merged_dir}")
        except Exception as exc:
            yield _step_event(0, "error", f"LoRA merge failed: {exc}")
            yield _sse_event("error", str(exc))
            return

        # Step 1: Convert to GGUF
        yield _step_event(1, "running", "Converting HuggingFace model to GGUF format...")

        gguf_fp16_path = output_dir / "model-fp16.gguf"
        try:
            # Look for convert_hf_to_gguf.py in common locations
            convert_script = None
            search_paths = [
                Path(sys.prefix) / "bin" / "convert_hf_to_gguf.py",
                Path(sys.prefix) / "Scripts" / "convert_hf_to_gguf.py",
                Path.home() / ".local" / "bin" / "convert_hf_to_gguf.py",
            ]

            # Also check if llama-cpp-python installed the script
            try:
                import llama_cpp
                llama_dir = Path(llama_cpp.__file__).parent
                search_paths.append(llama_dir / "convert_hf_to_gguf.py")
            except ImportError:
                pass

            for p in search_paths:
                if p.is_file():
                    convert_script = str(p)
                    break

            if convert_script:
                result = subprocess.run(
                    [sys.executable, convert_script, str(merged_dir),
                     "--outfile", str(gguf_fp16_path), "--outtype", "f16"],
                    capture_output=True, text=True, timeout=600,
                )
                if result.returncode != 0:
                    raise RuntimeError(f"Conversion failed: {result.stderr}")
                yield _step_event(1, "done", f"FP16 GGUF created: {gguf_fp16_path}")
            else:
                # Fallback: use the export_gguf.py script
                script_dir = Path(__file__).parent.parent / "llm" / "export_gguf.py"
                result = subprocess.run(
                    [sys.executable, str(script_dir)],
                    input=json.dumps({
                        "merged_dir": str(merged_dir),
                        "output_path": str(gguf_fp16_path),
                    }),
                    capture_output=True, text=True, timeout=600,
                )
                if result.returncode != 0:
                    raise RuntimeError(f"Conversion failed: {result.stderr}")
                yield _step_event(1, "done", f"FP16 GGUF created: {gguf_fp16_path}")
        except Exception as exc:
            yield _step_event(1, "error", f"GGUF conversion failed: {exc}")
            yield _sse_event("error", str(exc))
            return

        # Step 2: Quantize
        yield _step_event(2, "running", f"Quantizing to {quant_method}...")

        final_output = Path(output_path)
        try:
            # Try llama-quantize
            quantize_bin = shutil.which("llama-quantize") or shutil.which("quantize")
            if quantize_bin:
                result = subprocess.run(
                    [quantize_bin, str(gguf_fp16_path), str(final_output), quant_method],
                    capture_output=True, text=True, timeout=1200,
                )
                if result.returncode != 0:
                    raise RuntimeError(f"Quantization failed: {result.stderr}")
            else:
                # If no quantize binary, just copy the FP16 as output
                shutil.copy2(str(gguf_fp16_path), str(final_output))
                yield _step_event(2, "done",
                    f"llama-quantize not found — FP16 GGUF saved as output. "
                    f"Install llama.cpp for {quant_method} quantization.")

            yield _step_event(2, "done", f"Quantized model saved: {final_output}")
        except Exception as exc:
            yield _step_event(2, "error", f"Quantization failed: {exc}")
            yield _sse_event("error", str(exc))
            return

        # Cleanup intermediate files
        try:
            if gguf_fp16_path.is_file() and final_output.is_file():
                gguf_fp16_path.unlink()
            if merged_dir.is_dir():
                shutil.rmtree(str(merged_dir), ignore_errors=True)
        except Exception:
            pass

        yield _sse_event("done", {"output_path": str(final_output)})

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── HEF Vision Export ────────────────────────────────────────────────


@router.post("/hef-vision")
async def export_hef_vision(request: dict[str, Any]) -> StreamingResponse:
    """
    Convert an ONNX vision model to Hailo HEF format.
    Falls back to ONNX pass-through if Hailo DFC is unavailable.
    """
    onnx_path = request.get("onnx_path", "")
    calibration_dir = request.get("calibration_dir", "")
    output_path = request.get("output_path", "")
    use_wsl = request.get("use_wsl", False)

    if not onnx_path:
        raise HTTPException(status_code=400, detail="onnx_path is required")
    if not output_path:
        raise HTTPException(status_code=400, detail="output_path is required")

    async def generate():
        # Step 0: Check Hailo DFC
        yield _step_event(0, "running", "Checking Hailo DFC availability...")

        dfc_available = False
        try:
            # Check if hailo_sdk_client is importable
            import importlib
            hailo_spec = importlib.util.find_spec("hailo_sdk_client")
            dfc_available = hailo_spec is not None

            if not dfc_available and use_wsl:
                # Try WSL
                result = subprocess.run(
                    ["wsl", "python3", "-c", "import hailo_sdk_client; print('ok')"],
                    capture_output=True, text=True, timeout=30,
                )
                dfc_available = result.returncode == 0

        except Exception:
            pass

        if not dfc_available:
            yield _step_event(0, "done", "Hailo DFC not available")
            yield _sse_event("fallback", "Hailo DFC not found — ONNX model will be used directly")

            # Copy ONNX to output
            out = Path(output_path)
            out.parent.mkdir(parents=True, exist_ok=True)

            onnx_source = Path(onnx_path)
            if onnx_source.is_file():
                shutil.copy2(str(onnx_source), str(out))

            yield _step_event(1, "done", "Using ONNX model directly")
            yield _step_event(2, "done", "Skipped (no DFC)")
            yield _step_event(3, "done", "Skipped (no DFC)")
            yield _sse_event("done", {"output_path": str(out), "format": "onnx_fallback"})
            return

        yield _step_event(0, "done", "Hailo DFC found")

        # Step 1: Parse ONNX
        yield _step_event(1, "running", "Parsing ONNX model...")
        try:
            from hailo_sdk_client import ClientRunner

            runner = ClientRunner(hw_arch="hailo8l")
            hn, npz = runner.translate_onnx_model(
                onnx_path,
                net_name=Path(onnx_path).stem,
            )
            yield _step_event(1, "done", "ONNX model parsed successfully")
        except Exception as exc:
            yield _step_event(1, "error", f"ONNX parse failed: {exc}")
            yield _sse_event("error", str(exc))
            return

        # Step 2: Quantize
        yield _step_event(2, "running", "Quantizing model for Hailo...")
        try:
            if calibration_dir and Path(calibration_dir).is_dir():
                import numpy as np

                # Load calibration data from images
                calib_data = []
                img_exts = {".jpg", ".jpeg", ".png", ".bmp"}
                for f in sorted(Path(calibration_dir).iterdir()):
                    if f.suffix.lower() in img_exts:
                        from PIL import Image
                        img = Image.open(str(f)).convert("RGB").resize((640, 640))
                        arr = np.array(img, dtype=np.float32) / 255.0
                        arr = np.transpose(arr, (2, 0, 1))
                        calib_data.append(arr)
                        if len(calib_data) >= 64:
                            break

                if calib_data:
                    calib_dataset = {
                        runner.get_input_layers()[0]: np.stack(calib_data)
                    }
                    runner.optimize(calib_dataset)
            else:
                runner.optimize_full_precision()

            yield _step_event(2, "done", "Quantization complete")
        except Exception as exc:
            yield _step_event(2, "error", f"Quantization failed: {exc}")
            yield _sse_event("error", str(exc))
            return

        # Step 3: Compile to HEF
        yield _step_event(3, "running", "Compiling to HEF...")
        try:
            out = Path(output_path)
            out.parent.mkdir(parents=True, exist_ok=True)
            hef = runner.compile()

            with open(str(out), "wb") as f:
                f.write(hef)

            yield _step_event(3, "done", f"HEF compiled: {out}")
        except Exception as exc:
            yield _step_event(3, "error", f"HEF compilation failed: {exc}")
            yield _sse_event("error", str(exc))
            return

        yield _sse_event("done", {"output_path": str(out), "format": "hef"})

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── ONNX Export ──────────────────────────────────────────────────────


@router.post("/onnx")
async def export_onnx(request: dict[str, Any]) -> StreamingResponse:
    """
    Export a PyTorch model to ONNX format.
    Handles YOLO .pt and standard PyTorch models.
    """
    model_path = request.get("model_path", "")
    output_path = request.get("output_path", "")

    if not model_path:
        raise HTTPException(status_code=400, detail="model_path is required")
    if not output_path:
        raise HTTPException(status_code=400, detail="output_path is required")

    async def generate():
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)

        # Step 0: Load model
        yield _step_event(0, "running", f"Loading model from {model_path}...")

        is_yolo = False
        try:
            # Try YOLO first
            from ultralytics import YOLO
            model = YOLO(model_path)
            is_yolo = True
            yield _step_event(0, "done", f"YOLO model loaded: {model_path}")
        except Exception:
            try:
                import torch
                model = torch.load(model_path, map_location="cpu")
                yield _step_event(0, "done", f"PyTorch model loaded: {model_path}")
            except Exception as exc:
                yield _step_event(0, "error", f"Failed to load model: {exc}")
                yield _sse_event("error", str(exc))
                return

        # Step 1: Export to ONNX
        yield _step_event(1, "running", "Exporting to ONNX...")

        try:
            if is_yolo:
                model.export(format="onnx", imgsz=640, simplify=True)
                # YOLO exports to same dir as model
                yolo_onnx = Path(model_path).with_suffix(".onnx")
                if yolo_onnx.is_file():
                    shutil.move(str(yolo_onnx), str(out))
                yield _step_event(1, "done", f"ONNX exported: {out}")
            else:
                import torch
                if hasattr(model, "eval"):
                    model.eval()

                # Try to infer input shape
                dummy_input = torch.randn(1, 3, 640, 640)
                torch.onnx.export(
                    model,
                    dummy_input,
                    str(out),
                    opset_version=17,
                    do_constant_folding=True,
                    input_names=["input"],
                    output_names=["output"],
                    dynamic_axes={
                        "input": {0: "batch_size"},
                        "output": {0: "batch_size"},
                    },
                )
                yield _step_event(1, "done", f"ONNX exported: {out}")
        except Exception as exc:
            yield _step_event(1, "error", f"ONNX export failed: {exc}")
            yield _sse_event("error", str(exc))
            return

        # Step 2: Validate ONNX
        yield _step_event(2, "running", "Validating ONNX model...")

        try:
            import onnx
            onnx_model = onnx.load(str(out))
            onnx.checker.check_model(onnx_model)
            yield _step_event(2, "done", "ONNX model is valid")
        except ImportError:
            yield _step_event(2, "done", "onnx package not installed — skipping validation")
        except Exception as exc:
            yield _step_event(2, "error", f"ONNX validation failed: {exc}")
            yield _sse_event("error", str(exc))
            return

        file_size_mb = out.stat().st_size / (1024 * 1024)
        yield _sse_event("done", {
            "output_path": str(out),
            "size_mb": round(file_size_mb, 2),
        })

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── TorchScript Export ───────────────────────────────────────────────


@router.post("/torchscript")
async def export_torchscript(request: dict[str, Any]) -> StreamingResponse:
    """
    Export an SB3 RL model to TorchScript format.
    Extracts the actor/policy network and traces it.
    """
    model_path = request.get("model_path", "")
    output_path = request.get("output_path", "")

    if not model_path:
        raise HTTPException(status_code=400, detail="model_path is required")
    if not output_path:
        raise HTTPException(status_code=400, detail="output_path is required")

    async def generate():
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)

        # Step 0: Load SB3 model
        yield _step_event(0, "running", f"Loading SB3 model from {model_path}...")

        try:
            from stable_baselines3 import SAC, PPO, TD3

            # Auto-detect algorithm from filename
            lower_name = Path(model_path).stem.lower()
            algo_map = {"sac": SAC, "ppo": PPO, "td3": TD3}
            algo_class = None
            for key, cls in algo_map.items():
                if key in lower_name:
                    algo_class = cls
                    break

            if algo_class is None:
                algo_class = SAC

            model = algo_class.load(model_path)
            yield _step_event(0, "done", f"SB3 model loaded ({algo_class.__name__})")
        except Exception as exc:
            yield _step_event(0, "error", f"Failed to load SB3 model: {exc}")
            yield _sse_event("error", str(exc))
            return

        # Step 1: Extract policy network
        yield _step_event(1, "running", "Extracting policy network...")

        try:
            import torch
            import numpy as np

            policy = model.policy
            policy.eval()

            obs_space = model.observation_space
            sample_obs = torch.as_tensor(
                np.array([obs_space.sample()]), dtype=torch.float32
            )

            yield _step_event(1, "done",
                f"Policy extracted — observation shape: {list(sample_obs.shape)}")
        except Exception as exc:
            yield _step_event(1, "error", f"Policy extraction failed: {exc}")
            yield _sse_event("error", str(exc))
            return

        # Step 2: Trace to TorchScript
        yield _step_event(2, "running", "Tracing policy to TorchScript...")

        try:
            # Try to trace the actor/action network
            if hasattr(policy, "actor") and policy.actor is not None:
                actor = policy.actor
                actor.eval()
                traced = torch.jit.trace(actor, sample_obs)
            else:
                # For PPO-style policies, trace the full policy forward
                class PolicyWrapper(torch.nn.Module):
                    def __init__(self, pol):
                        super().__init__()
                        self.pol = pol

                    def forward(self, obs):
                        return self.pol._predict(obs, deterministic=True)

                wrapper = PolicyWrapper(policy)
                wrapper.eval()
                traced = torch.jit.trace(wrapper, sample_obs)

            traced.save(str(out))

            file_size_mb = out.stat().st_size / (1024 * 1024)
            yield _step_event(2, "done",
                f"TorchScript saved: {out} ({file_size_mb:.2f} MB)")
        except Exception as exc:
            yield _step_event(2, "error", f"TorchScript tracing failed: {exc}")
            yield _sse_event("error", str(exc))
            return

        yield _sse_event("done", {
            "output_path": str(out),
            "size_mb": round(out.stat().st_size / (1024 * 1024), 2),
        })

    return StreamingResponse(generate(), media_type="text/event-stream")
