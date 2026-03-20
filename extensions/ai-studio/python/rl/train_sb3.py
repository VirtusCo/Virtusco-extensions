# Copyright 2026 VirtusCo
# Stable Baselines3 RL training script — invoked by the backend server
"""
Reads a JSON config from stdin, trains an RL agent using SB3,
and prints JSON metric lines to stdout for the extension to consume.

Usage (standalone):
    echo '{"algorithm":"SAC","environment":"CartPole-v1",...}' | python train_sb3.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np


def _print_json(data: dict[str, Any]) -> None:
    """Print a JSON line to stdout and flush immediately."""
    print(json.dumps(data, default=str), flush=True)


class MetricsCallback:
    """
    Custom SB3 callback that emits JSON metrics to stdout on each evaluation.
    Works with EvalCallback by monitoring the evaluations_results attribute.
    """

    def __init__(self, eval_freq: int, total_timesteps: int) -> None:
        from stable_baselines3.common.callbacks import BaseCallback

        class _Inner(BaseCallback):
            def __init__(inner_self, verbose: int = 0) -> None:
                super().__init__(verbose)
                inner_self.eval_freq = eval_freq
                inner_self.total_timesteps = total_timesteps
                inner_self.last_eval_step = 0
                inner_self.start_time = time.time()
                inner_self.last_time = time.time()
                inner_self.last_step = 0

            def _on_step(inner_self) -> bool:
                current_step = inner_self.num_timesteps

                if current_step - inner_self.last_eval_step >= inner_self.eval_freq:
                    inner_self.last_eval_step = current_step
                    now = time.time()
                    elapsed = now - inner_self.last_time

                    # Compute FPS
                    steps_since = current_step - inner_self.last_step
                    fps = steps_since / elapsed if elapsed > 0 else 0.0
                    inner_self.last_time = now
                    inner_self.last_step = current_step

                    # Extract losses from the logger if available
                    value_loss = 0.0
                    policy_loss = 0.0
                    if hasattr(inner_self.model, "logger") and inner_self.model.logger is not None:
                        log_dict = inner_self.model.logger.name_to_value
                        value_loss = log_dict.get("train/value_loss", 0.0)
                        policy_loss = log_dict.get("train/policy_loss", 0.0)
                        if policy_loss == 0.0:
                            policy_loss = log_dict.get("train/actor_loss", 0.0)

                    # Episode stats from the info buffer
                    mean_reward = 0.0
                    std_reward = 0.0
                    ep_len_mean = 0.0

                    if len(inner_self.model.ep_info_buffer) > 0:
                        rewards = [ep["r"] for ep in inner_self.model.ep_info_buffer]
                        lengths = [ep["l"] for ep in inner_self.model.ep_info_buffer]
                        mean_reward = float(np.mean(rewards))
                        std_reward = float(np.std(rewards))
                        ep_len_mean = float(np.mean(lengths))

                    metric = {
                        "event": "metric",
                        "timestep": current_step,
                        "mean_reward": round(mean_reward, 4),
                        "std_reward": round(std_reward, 4),
                        "episode_length_mean": round(ep_len_mean, 2),
                        "value_loss": round(float(value_loss), 6),
                        "policy_loss": round(float(policy_loss), 6),
                        "fps": round(fps, 1),
                    }
                    _print_json(metric)

                return True

        self.callback_class = _Inner

    def create(self) -> Any:
        return self.callback_class()


def train(config: dict[str, Any]) -> None:
    """Run RL training with the given configuration."""
    import gymnasium as gym
    from stable_baselines3 import SAC, PPO, TD3
    from stable_baselines3.common.callbacks import CheckpointCallback, CallbackList
    from stable_baselines3.common.monitor import Monitor

    algorithm = config.get("algorithm", "SAC")
    environment = config.get("environment", "CartPole-v1")
    total_timesteps = int(config.get("total_timesteps", 500_000))
    learning_rate = float(config.get("learning_rate", 3e-4))
    buffer_size = int(config.get("buffer_size", 100_000))
    batch_size = int(config.get("batch_size", 256))
    gamma = float(config.get("gamma", 0.99))
    policy = config.get("policy", "MlpPolicy")
    save_freq = int(config.get("save_freq", 10_000))
    eval_freq = int(config.get("eval_freq", 5_000))
    output_dir = config.get("output_dir", "./rl_output")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    checkpoints_dir = output_path / "checkpoints"
    checkpoints_dir.mkdir(exist_ok=True)

    _print_json({"event": "status", "message": f"Creating environment: {environment}"})

    # Create the environment
    env = Monitor(gym.make(environment))

    _print_json({"event": "status", "message": f"Initializing {algorithm} with {policy}"})

    # Algorithm selection
    algo_map = {"SAC": SAC, "PPO": PPO, "TD3": TD3}
    AlgoClass = algo_map.get(algorithm)
    if AlgoClass is None:
        _print_json({"event": "error", "message": f"Unknown algorithm: {algorithm}"})
        sys.exit(1)

    # Build kwargs — not all algos use buffer_size
    model_kwargs: dict[str, Any] = {
        "policy": policy,
        "env": env,
        "learning_rate": learning_rate,
        "batch_size": batch_size,
        "gamma": gamma,
        "verbose": 0,
        "device": "auto",
    }

    # Off-policy algorithms (SAC, TD3) use a replay buffer
    if algorithm in ("SAC", "TD3") and buffer_size > 0:
        model_kwargs["buffer_size"] = buffer_size

    model = AlgoClass(**model_kwargs)

    # Callbacks
    checkpoint_cb = CheckpointCallback(
        save_freq=save_freq,
        save_path=str(checkpoints_dir),
        name_prefix=f"{algorithm.lower()}_porter",
    )

    metrics_cb = MetricsCallback(eval_freq, total_timesteps).create()
    callback_list = CallbackList([checkpoint_cb, metrics_cb])

    _print_json({
        "event": "status",
        "message": f"Training {algorithm} for {total_timesteps} timesteps...",
    })

    # Train
    model.learn(
        total_timesteps=total_timesteps,
        callback=callback_list,
        progress_bar=False,
    )

    # Save final model
    final_model_path = output_path / f"{algorithm.lower()}_final"
    model.save(str(final_model_path))
    _print_json({
        "event": "status",
        "message": f"Final model saved: {final_model_path}",
    })

    # Export policy to TorchScript for deployment
    try:
        import torch

        obs_space = env.observation_space
        sample_obs = torch.as_tensor(obs_space.sample()).float().unsqueeze(0)

        actor = model.policy.actor
        if hasattr(model.policy, "actor"):
            actor.eval()
            traced = torch.jit.trace(actor, sample_obs)
            torchscript_path = output_path / f"{algorithm.lower()}_policy.pt"
            traced.save(str(torchscript_path))
            _print_json({
                "event": "status",
                "message": f"TorchScript exported: {torchscript_path}",
            })
        else:
            _print_json({
                "event": "status",
                "message": "TorchScript export skipped: no separable actor network",
            })
    except Exception as exc:
        _print_json({
            "event": "warning",
            "message": f"TorchScript export failed (model still saved): {exc}",
        })

    env.close()

    _print_json({
        "event": "done",
        "output_dir": str(output_path),
        "final_model": str(final_model_path) + ".zip",
    })


def main() -> None:
    """Entry point — reads JSON config from stdin."""
    raw = sys.stdin.read().strip()
    if not raw:
        _print_json({"event": "error", "message": "No config provided on stdin"})
        sys.exit(1)

    try:
        config = json.loads(raw)
    except json.JSONDecodeError as exc:
        _print_json({"event": "error", "message": f"Invalid JSON config: {exc}"})
        sys.exit(1)

    _print_json({"event": "status", "message": "Starting RL training..."})
    train(config)


if __name__ == "__main__":
    main()
