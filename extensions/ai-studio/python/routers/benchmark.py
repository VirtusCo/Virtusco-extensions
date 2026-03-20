# Copyright 2026 VirtusCo
# Benchmark router — model evaluation endpoints for vision, LLM, and RL
"""
Provides benchmark endpoints that evaluate trained models and return
standardized metric results. Each endpoint generates a unique run_id
for tracking benchmark history.
"""

from __future__ import annotations

import logging
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/benchmark", tags=["benchmark"])


def _generate_run_id() -> str:
    """Generate a short unique run identifier."""
    return f"bench_{uuid.uuid4().hex[:12]}"


# ── Vision Benchmark ─────────────────────────────────────────────────


@router.post("/vision")
async def benchmark_vision(request: dict[str, Any]) -> dict[str, Any]:
    """
    Evaluate a YOLO/ONNX vision model on a dataset.
    Returns mAP@50, mAP@50:95, and inference FPS.
    """
    model_path = request.get("model_path", "")
    dataset_path = request.get("dataset_path", "")

    if not model_path:
        raise HTTPException(status_code=400, detail="model_path is required")
    if not dataset_path:
        raise HTTPException(status_code=400, detail="dataset_path is required")

    model_file = Path(model_path)
    if not model_file.is_file():
        raise HTTPException(status_code=400, detail=f"Model not found: {model_path}")

    run_id = _generate_run_id()
    start_time = time.time()
    model_name = model_file.stem

    try:
        # Try YOLO ultralytics validation
        if model_path.endswith((".pt", ".onnx")):
            from ultralytics import YOLO

            model = YOLO(model_path)
            results = model.val(data=Path(dataset_path) / "data.yaml", verbose=False)

            map50 = float(results.box.map50)
            map50_95 = float(results.box.map)

            # Measure ONNX inference FPS on a sample
            fps_onnx = 0.0
            try:
                import onnxruntime as ort
                import numpy as np

                if model_path.endswith(".onnx"):
                    sess = ort.InferenceSession(model_path)
                    input_name = sess.get_inputs()[0].name
                    input_shape = sess.get_inputs()[0].shape
                    # Replace dynamic dims with concrete values
                    shape = [s if isinstance(s, int) else 1 for s in input_shape]
                    dummy = np.random.randn(*shape).astype(np.float32)

                    # Warmup
                    for _ in range(5):
                        sess.run(None, {input_name: dummy})

                    # Timed run
                    n_runs = 50
                    t0 = time.time()
                    for _ in range(n_runs):
                        sess.run(None, {input_name: dummy})
                    elapsed = time.time() - t0
                    fps_onnx = n_runs / elapsed if elapsed > 0 else 0.0
            except Exception as exc:
                logger.warning("ONNX FPS measurement failed: %s", exc)

            duration = time.time() - start_time

            return {
                "run_id": run_id,
                "model_name": model_name,
                "map50": round(map50, 6),
                "map50_95": round(map50_95, 6),
                "fps_onnx": round(fps_onnx, 1),
                "duration_seconds": round(duration, 2),
            }
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported model format: {model_path}. Use .pt or .onnx",
            )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Vision benchmark failed")
        raise HTTPException(status_code=500, detail=f"Benchmark failed: {exc}")


# ── LLM Benchmark ───────────────────────────────────────────────────


@router.post("/llm")
async def benchmark_llm(request: dict[str, Any]) -> dict[str, Any]:
    """
    Evaluate a GGUF LLM model — measures perplexity and tokens/sec.
    Reads evaluation prompts from a JSONL file.
    """
    model_path = request.get("model_path", "")
    eval_jsonl = request.get("eval_jsonl", "")

    if not model_path:
        raise HTTPException(status_code=400, detail="model_path is required")

    model_file = Path(model_path)
    if not model_file.is_file():
        raise HTTPException(status_code=400, detail=f"Model not found: {model_path}")

    run_id = _generate_run_id()
    start_time = time.time()
    model_name = model_file.stem

    try:
        import json

        from llama_cpp import Llama

        # Load model
        llm = Llama(
            model_path=model_path,
            n_ctx=1024,
            n_threads=2,
            verbose=False,
        )

        # Load eval prompts
        prompts: list[str] = []
        if eval_jsonl and Path(eval_jsonl).is_file():
            with open(eval_jsonl, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                        if "text" in obj:
                            prompts.append(obj["text"])
                        elif "prompt" in obj:
                            prompts.append(obj["prompt"])
                        elif "conversations" in obj:
                            convs = obj["conversations"]
                            for c in convs:
                                if c.get("from") == "human":
                                    prompts.append(c["value"])
                                    break
                    except json.JSONDecodeError:
                        continue
        else:
            # Default eval prompts for airport assistant
            prompts = [
                "Where is Gate B12?",
                "What time does flight AA123 depart?",
                "Can you help me find the nearest restroom?",
                "I need wheelchair assistance to my gate.",
                "What restaurants are near Terminal 2?",
            ]

        if not prompts:
            raise HTTPException(status_code=400, detail="No evaluation prompts found")

        # Benchmark: measure tokens per second and TTFT
        total_tokens = 0
        total_gen_time = 0.0
        ttft_values: list[float] = []
        log_probs_sum = 0.0
        log_probs_count = 0

        for prompt in prompts[:20]:  # Cap at 20 prompts for time
            t0 = time.time()
            output = llm(
                prompt,
                max_tokens=128,
                temperature=0.0,
                logprobs=1,
            )
            gen_time = time.time() - t0

            # Tokens generated
            choices = output.get("choices", [{}])
            if choices:
                text = choices[0].get("text", "")
                n_tokens = output.get("usage", {}).get("completion_tokens", len(text.split()))
                total_tokens += n_tokens

                # Log probabilities for perplexity
                logprobs_data = choices[0].get("logprobs")
                if logprobs_data and "token_logprobs" in logprobs_data:
                    for lp in logprobs_data["token_logprobs"]:
                        if lp is not None:
                            log_probs_sum += lp
                            log_probs_count += 1

            total_gen_time += gen_time

            # TTFT approximation: time to first token
            # For non-streaming, estimate as gen_time / n_tokens * 1
            if n_tokens > 0:
                ttft_values.append((gen_time / n_tokens) * 1000)  # ms

        tokens_per_sec = total_tokens / total_gen_time if total_gen_time > 0 else 0.0
        ttft_ms = sum(ttft_values) / len(ttft_values) if ttft_values else 0.0

        # Perplexity = exp(-1/N * sum(log_probs))
        import math

        if log_probs_count > 0:
            avg_log_prob = log_probs_sum / log_probs_count
            perplexity = math.exp(-avg_log_prob)
        else:
            perplexity = 0.0

        duration = time.time() - start_time

        del llm

        return {
            "run_id": run_id,
            "model_name": model_name,
            "perplexity": round(perplexity, 4),
            "tokens_per_sec": round(tokens_per_sec, 2),
            "ttft_ms": round(ttft_ms, 2),
            "duration_seconds": round(duration, 2),
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("LLM benchmark failed")
        raise HTTPException(status_code=500, detail=f"Benchmark failed: {exc}")


# ── RL Benchmark ─────────────────────────────────────────────────────


@router.post("/rl")
async def benchmark_rl(request: dict[str, Any]) -> dict[str, Any]:
    """
    Evaluate an RL model — runs N episodes and computes mean reward.
    """
    model_path = request.get("model_path", "")
    env_id = request.get("env_id", "")
    n_episodes = int(request.get("n_episodes", 100))

    if not model_path:
        raise HTTPException(status_code=400, detail="model_path is required")
    if not env_id:
        raise HTTPException(status_code=400, detail="env_id is required")

    model_file = Path(model_path)
    if not model_file.is_file() and not Path(model_path + ".zip").is_file():
        raise HTTPException(status_code=400, detail=f"Model not found: {model_path}")

    run_id = _generate_run_id()
    start_time = time.time()
    model_name = Path(model_path).stem

    try:
        import gymnasium as gym
        import numpy as np
        from stable_baselines3 import SAC, PPO, TD3

        # Auto-detect algorithm from filename
        algo_map = {"sac": SAC, "ppo": PPO, "td3": TD3}
        algo_class = None
        lower_name = model_name.lower()
        for algo_key, cls in algo_map.items():
            if algo_key in lower_name:
                algo_class = cls
                break

        if algo_class is None:
            # Default to SAC
            algo_class = SAC

        env = gym.make(env_id)
        model = algo_class.load(model_path, env=env)

        episode_rewards: list[float] = []
        episode_lengths: list[int] = []

        for _ in range(n_episodes):
            obs, _ = env.reset()
            done = False
            total_reward = 0.0
            steps = 0

            while not done:
                action, _ = model.predict(obs, deterministic=True)
                obs, reward, terminated, truncated, _ = env.step(action)
                total_reward += float(reward)
                steps += 1
                done = terminated or truncated

            episode_rewards.append(total_reward)
            episode_lengths.append(steps)

        env.close()

        mean_reward = float(np.mean(episode_rewards))
        std_reward = float(np.std(episode_rewards))
        mean_episode_length = float(np.mean(episode_lengths))
        duration = time.time() - start_time

        return {
            "run_id": run_id,
            "model_name": model_name,
            "mean_reward": round(mean_reward, 4),
            "std_reward": round(std_reward, 4),
            "mean_episode_length": round(mean_episode_length, 2),
            "duration_seconds": round(duration, 2),
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("RL benchmark failed")
        raise HTTPException(status_code=500, detail=f"Benchmark failed: {exc}")
