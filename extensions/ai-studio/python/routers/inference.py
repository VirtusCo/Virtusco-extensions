# Copyright 2026 VirtusCo
# Inference router — vision and LLM inference endpoints
"""
Provides inference endpoints for running trained models on inputs.
Vision: ONNX/YOLO model on images → bounding boxes
LLM: GGUF model on chat messages → response + metrics
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/inference", tags=["inference"])

# Cache loaded models to avoid reloading on every request
_vision_model_cache: dict[str, Any] = {}
_llm_model_cache: dict[str, Any] = {}


# ── Vision Inference ─────────────────────────────────────────────────


@router.post("/vision")
async def infer_vision(request: dict[str, Any]) -> dict[str, Any]:
    """
    Run vision inference on an image.
    Supports YOLO .pt and ONNX models.
    Returns bounding boxes with class names, confidence, and coordinates.
    """
    model_path = request.get("model_path", "")
    image_path = request.get("image_path", "")
    conf_threshold = float(request.get("conf_threshold", 0.25))

    if not model_path:
        raise HTTPException(status_code=400, detail="model_path is required")
    if not image_path:
        raise HTTPException(status_code=400, detail="image_path is required")

    model_file = Path(model_path)
    if not model_file.is_file():
        raise HTTPException(status_code=400, detail=f"Model not found: {model_path}")

    image_file = Path(image_path)
    if not image_file.is_file():
        raise HTTPException(status_code=400, detail=f"Image not found: {image_path}")

    try:
        from PIL import Image

        img = Image.open(image_path)
        img_width, img_height = img.size

        if model_path.endswith((".pt", ".onnx")):
            # Use ultralytics YOLO
            from ultralytics import YOLO

            # Cache the model
            if model_path not in _vision_model_cache:
                _vision_model_cache[model_path] = YOLO(model_path)

            model = _vision_model_cache[model_path]

            t0 = time.time()
            results = model.predict(
                image_path,
                conf=conf_threshold,
                verbose=False,
            )
            latency_ms = (time.time() - t0) * 1000

            boxes: list[dict[str, Any]] = []
            if results and len(results) > 0:
                result = results[0]
                if result.boxes is not None:
                    for box in result.boxes:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        w = x2 - x1
                        h = y2 - y1
                        cls_id = int(box.cls[0])
                        conf = float(box.conf[0])
                        class_name = model.names.get(cls_id, f"class_{cls_id}")

                        boxes.append({
                            "class_name": class_name,
                            "confidence": round(conf, 4),
                            "x": round(x1, 2),
                            "y": round(y1, 2),
                            "w": round(w, 2),
                            "h": round(h, 2),
                        })

            return {
                "boxes": boxes,
                "latency_ms": round(latency_ms, 2),
                "image_width": img_width,
                "image_height": img_height,
            }
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported model format: {model_path}. Use .pt or .onnx",
            )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Vision inference failed")
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}")


# ── LLM Inference ───────────────────────────────────────────────────


@router.post("/llm")
async def infer_llm(request: dict[str, Any]) -> dict[str, Any]:
    """
    Run LLM inference using a GGUF model.
    Accepts chat messages in OpenAI format and returns the response
    with performance metrics (tokens/sec, TTFT).
    """
    model_path = request.get("model_path", "")
    messages = request.get("messages", [])
    max_tokens = int(request.get("max_tokens", 256))

    if not model_path:
        raise HTTPException(status_code=400, detail="model_path is required")
    if not messages:
        raise HTTPException(status_code=400, detail="messages is required")

    model_file = Path(model_path)
    if not model_file.is_file():
        raise HTTPException(status_code=400, detail=f"Model not found: {model_path}")

    model_name = model_file.stem

    try:
        from llama_cpp import Llama

        # Cache the model (GGUF loading is expensive)
        if model_path not in _llm_model_cache:
            logger.info("Loading GGUF model: %s", model_path)
            _llm_model_cache[model_path] = Llama(
                model_path=model_path,
                n_ctx=1024,
                n_threads=2,  # Reserve 2 cores for SLAM/Nav2 on RPi
                verbose=False,
                chat_format="chatml",
            )

        llm = _llm_model_cache[model_path]

        # Format messages for chat completion
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })

        t0 = time.time()
        result = llm.create_chat_completion(
            messages=formatted_messages,
            max_tokens=max_tokens,
            temperature=0.7,
            top_p=0.9,
        )
        total_time = time.time() - t0

        # Extract response
        choices = result.get("choices", [{}])
        response_text = ""
        if choices:
            message = choices[0].get("message", {})
            response_text = message.get("content", "")

        # Extract token usage
        usage = result.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", 0)

        # Compute metrics
        tokens_per_sec = completion_tokens / total_time if total_time > 0 else 0.0

        # TTFT approximation: for non-streaming, estimate from total time
        ttft_ms = (total_time / max(completion_tokens, 1)) * 1000 if completion_tokens > 0 else 0.0

        return {
            "response": response_text,
            "tokens_per_sec": round(tokens_per_sec, 2),
            "ttft_ms": round(ttft_ms, 2),
            "total_tokens": total_tokens,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "model_name": model_name,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("LLM inference failed")
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}")
