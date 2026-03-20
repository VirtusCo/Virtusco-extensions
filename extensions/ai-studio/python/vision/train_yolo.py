# Copyright 2026 VirtusCo
# YOLO vision training script — reads config from stdin, streams metrics to stdout
"""
Standalone training script invoked by the training router as a subprocess.
Reads a JSON config object from stdin, trains a YOLO model using ultralytics,
and prints JSON metric objects to stdout after each epoch.

Expected config keys:
  model, dataset_yaml, epochs, batch_size, imgsz, lr0, augmentation,
  early_stopping_patience, export_onnx_after, project_name

Output format (one JSON object per line):
  {"epoch": 1, "box_loss": 0.05, "cls_loss": 0.03, "map50": 0.45,
   "map50_95": 0.32, "precision": 0.61, "recall": 0.55, "lr": 0.001}
"""

from __future__ import annotations

import json
import sys
import os
from pathlib import Path


def main() -> None:
    # Read config from stdin
    raw_input = sys.stdin.read().strip()
    if not raw_input:
        print(
            json.dumps({"error": "No config received on stdin"}),
            flush=True,
        )
        sys.exit(1)

    try:
        config = json.loads(raw_input)
    except json.JSONDecodeError as exc:
        print(
            json.dumps({"error": f"Invalid JSON config: {exc}"}),
            flush=True,
        )
        sys.exit(1)

    # Extract config values
    model_name: str = config.get("model", "yolov8n.pt")
    dataset_yaml: str = config.get("dataset_yaml", "data.yaml")
    epochs: int = config.get("epochs", 100)
    batch_size: int = config.get("batch_size", 16)
    imgsz: int = config.get("imgsz", 640)
    lr0: float = config.get("lr0", 0.01)
    augmentation: bool = config.get("augmentation", True)
    patience: int = config.get("early_stopping_patience", 50)
    export_onnx: bool = config.get("export_onnx_after", False)
    project_name: str = config.get("project_name", "porter_vision")

    # Import ultralytics (deferred to avoid import cost on load)
    try:
        from ultralytics import YOLO
        from ultralytics.utils import callbacks
    except ImportError:
        print(
            json.dumps(
                {"error": "ultralytics not installed. Run: pip install ultralytics"}
            ),
            flush=True,
        )
        sys.exit(1)

    # Load model
    try:
        model = YOLO(model_name)
    except Exception as exc:
        print(
            json.dumps({"error": f"Failed to load model '{model_name}': {exc}"}),
            flush=True,
        )
        sys.exit(1)

    # Augmentation settings
    augment_kwargs = {}
    if not augmentation:
        augment_kwargs = {
            "hsv_h": 0.0,
            "hsv_s": 0.0,
            "hsv_v": 0.0,
            "degrees": 0.0,
            "translate": 0.0,
            "scale": 0.0,
            "shear": 0.0,
            "perspective": 0.0,
            "flipud": 0.0,
            "fliplr": 0.0,
            "mosaic": 0.0,
            "mixup": 0.0,
        }

    # Epoch tracking via callback
    epoch_metrics: dict[str, float] = {}

    def on_train_epoch_end(trainer) -> None:
        """Callback fired after each training epoch — emits metrics."""
        nonlocal epoch_metrics
        metrics = trainer.metrics or {}
        loss_items = trainer.loss_items

        # Extract loss values
        box_loss = 0.0
        cls_loss = 0.0
        if loss_items is not None:
            try:
                box_loss = float(loss_items[0])
                cls_loss = float(loss_items[1]) if len(loss_items) > 1 else 0.0
            except (IndexError, TypeError, ValueError):
                pass

        # Extract validation metrics
        map50 = float(metrics.get("metrics/mAP50(B)", 0.0))
        map50_95 = float(metrics.get("metrics/mAP50-95(B)", 0.0))
        precision_val = float(metrics.get("metrics/precision(B)", 0.0))
        recall_val = float(metrics.get("metrics/recall(B)", 0.0))

        # Learning rate
        lr = 0.0
        if hasattr(trainer, "optimizer") and trainer.optimizer is not None:
            param_groups = trainer.optimizer.param_groups
            if param_groups:
                lr = float(param_groups[0].get("lr", 0.0))

        current_epoch = trainer.epoch + 1

        epoch_metrics = {
            "epoch": current_epoch,
            "box_loss": round(box_loss, 6),
            "cls_loss": round(cls_loss, 6),
            "map50": round(map50, 4),
            "map50_95": round(map50_95, 4),
            "precision": round(precision_val, 4),
            "recall": round(recall_val, 4),
            "lr": round(lr, 8),
        }

        print(json.dumps(epoch_metrics), flush=True)

    # Register callback
    model.add_callback("on_train_epoch_end", on_train_epoch_end)

    # Run training
    try:
        results = model.train(
            data=dataset_yaml,
            epochs=epochs,
            batch=batch_size,
            imgsz=imgsz,
            lr0=lr0,
            patience=patience,
            project=project_name,
            exist_ok=True,
            verbose=False,
            **augment_kwargs,
        )
    except KeyboardInterrupt:
        print(
            json.dumps({"error": "Training cancelled by user"}),
            flush=True,
        )
        sys.exit(0)
    except Exception as exc:
        print(
            json.dumps({"error": f"Training failed: {exc}"}),
            flush=True,
        )
        sys.exit(1)

    # Export to ONNX if requested
    if export_onnx:
        try:
            export_path = model.export(format="onnx", imgsz=imgsz)
            print(
                json.dumps({"export_onnx": str(export_path)}),
                flush=True,
            )
        except Exception as exc:
            print(
                json.dumps({"export_error": f"ONNX export failed: {exc}"}),
                flush=True,
            )

    # Final summary
    summary: dict[str, float] = {}
    if results and hasattr(results, "results_dict"):
        for key, val in results.results_dict.items():
            try:
                summary[key] = round(float(val), 6)
            except (TypeError, ValueError):
                pass

    print(json.dumps({"done": True, "summary": summary}), flush=True)


if __name__ == "__main__":
    main()
