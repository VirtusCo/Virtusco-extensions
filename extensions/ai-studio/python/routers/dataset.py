# Copyright 2026 VirtusCo
# Dataset management router — YOLO vision datasets and LLM JSONL building
"""
Endpoints for scanning/validating YOLO datasets and building ShareGPT
JSONL files for LLM fine-tuning.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/dataset", tags=["dataset"])

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}

PLACEHOLDER_PATTERNS = [
    re.compile(r"\[TODO\]", re.IGNORECASE),
    re.compile(r"\[GATE\]", re.IGNORECASE),
    re.compile(r"\[PLACEHOLDER\]", re.IGNORECASE),
    re.compile(r"\[INSERT\]", re.IGNORECASE),
    re.compile(r"\[FILL\]", re.IGNORECASE),
    re.compile(r"\[TBD\]", re.IGNORECASE),
    re.compile(r"\[FIXME\]", re.IGNORECASE),
    re.compile(r"lorem ipsum", re.IGNORECASE),
]

SYSTEM_PROMPTS: dict[str, str] = {
    "passenger": (
        "You are Virtue, the AI assistant aboard Porter, an autonomous luggage-carrying robot at the airport. "
        "You help passengers with directions, flight information, gate locations, amenities, and general airport questions. "
        "Be friendly, concise, and helpful. Always prioritize passenger safety. "
        "If you do not know something, say so honestly and suggest asking airport staff."
    ),
    "voice_command": (
        "You are Virtue, the voice-controlled AI aboard Porter, an autonomous airport robot. "
        "You interpret short spoken commands and respond with brief confirmations or clarifications. "
        "Commands may include: follow me, stop, go to gate, carry luggage, find restroom, call assistance. "
        "Keep responses under 2 sentences. Use clear, simple language."
    ),
    "multilingual": (
        "You are Virtue, a multilingual AI assistant aboard Porter, an autonomous airport robot. "
        "You detect the passenger's language and respond in the same language. "
        "You support English, Spanish, French, Mandarin, Japanese, Korean, Arabic, Hindi, and Portuguese. "
        "Provide the same helpful airport assistance regardless of language."
    ),
    "operator": (
        "You are Virtue, the AI assistant aboard Porter, in operator/maintenance mode. "
        "You respond to technical queries about the robot's systems: battery, motors, LIDAR, sensors, "
        "navigation status, error logs, and diagnostics. "
        "Use precise technical language. Report exact values when available."
    ),
}


# ── Helpers ─────────────────────────────────────────────────────────


def _parse_data_yaml(yaml_path: Path) -> dict[str, Any]:
    """Parse a simple YOLO data.yaml without a YAML library."""
    result: dict[str, Any] = {
        "names": [],
        "nc": 0,
        "train": "images/train",
        "val": "images/val",
        "test": "images/test",
    }

    if not yaml_path.is_file():
        raise HTTPException(status_code=400, detail="data.yaml not found")

    content = yaml_path.read_text(encoding="utf-8")
    in_names_list = False
    names: list[str] = []

    for raw_line in content.splitlines():
        line = raw_line.strip()

        if in_names_list:
            if line.startswith("- "):
                name = line[2:].strip().strip("'\"")
                names.append(name)
                continue
            else:
                in_names_list = False

        if not line or line.startswith("#"):
            continue

        colon_idx = line.find(":")
        if colon_idx == -1:
            continue

        key = line[:colon_idx].strip()
        value = line[colon_idx + 1 :].strip()

        if key == "nc":
            try:
                result["nc"] = int(value)
            except ValueError:
                pass
        elif key in ("train", "val", "test"):
            result[key] = value.strip("'\"")
        elif key == "names":
            if value.startswith("["):
                inner = value.strip("[]")
                names = [s.strip().strip("'\"") for s in inner.split(",") if s.strip()]
            elif not value:
                in_names_list = True

    result["names"] = names
    if result["nc"] == 0 and names:
        result["nc"] = len(names)

    return result


def _list_images(dir_path: Path) -> list[str]:
    """List image files in a directory (non-recursive)."""
    if not dir_path.is_dir():
        return []
    return [f.name for f in dir_path.iterdir() if f.suffix.lower() in IMAGE_EXTENSIONS]


# ── Endpoints ───────────────────────────────────────────────────────


@router.post("/scan-vision")
async def scan_vision(request: dict[str, Any]) -> dict[str, Any]:
    """Scan a YOLO dataset directory and return statistics."""
    dataset_path = Path(request.get("datasetPath", ""))
    if not dataset_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Directory not found: {dataset_path}")

    yaml_data = _parse_data_yaml(dataset_path / "data.yaml")
    class_names: list[str] = yaml_data["names"]
    nc: int = yaml_data["nc"]
    errors: list[str] = []

    split_dirs = {
        "train": yaml_data["train"],
        "val": yaml_data["val"],
        "test": yaml_data["test"],
    }

    splits: dict[str, int] = {}
    all_images: list[tuple[str, str]] = []  # (filename, split_dir)

    for split_name, split_dir in split_dirs.items():
        img_dir = dataset_path / split_dir
        images = _list_images(img_dir)
        splits[split_name] = len(images)
        for img in images:
            all_images.append((img, split_dir))

    total_images = sum(splits.values())
    instances_per_class: dict[str, int] = {name: 0 for name in class_names}
    total_instances = 0
    missing_labels: list[str] = []

    for img_file, split_dir in all_images:
        label_dir = str(dataset_path / split_dir).replace("images", "labels")
        label_path = Path(label_dir) / (Path(img_file).stem + ".txt")

        if not label_path.is_file():
            missing_labels.append(img_file)
            continue

        try:
            content = label_path.read_text(encoding="utf-8").strip()
            if not content:
                continue

            for line in content.splitlines():
                parts = line.strip().split()
                if len(parts) < 5:
                    continue
                try:
                    class_id = int(parts[0])
                except ValueError:
                    continue

                if 0 <= class_id < nc:
                    name = class_names[class_id] if class_id < len(class_names) else f"class_{class_id}"
                    instances_per_class[name] = instances_per_class.get(name, 0) + 1
                    total_instances += 1
        except Exception as exc:
            errors.append(f"Failed to read label: {label_path} ({exc})")

    return {
        "path": str(dataset_path),
        "numClasses": nc,
        "classNames": class_names,
        "splits": splits,
        "totalImages": total_images,
        "totalInstances": total_instances,
        "instancesPerClass": instances_per_class,
        "missingLabels": missing_labels,
        "errors": errors,
    }


@router.post("/validate-vision")
async def validate_vision(request: dict[str, Any]) -> dict[str, Any]:
    """Validate a YOLO dataset for format correctness."""
    dataset_path = Path(request.get("datasetPath", ""))
    if not dataset_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Directory not found: {dataset_path}")

    errors: list[str] = []
    warnings: list[str] = []

    yaml_path = dataset_path / "data.yaml"
    if not yaml_path.is_file():
        return {"valid": False, "errors": ["data.yaml not found"], "warnings": []}

    try:
        yaml_data = _parse_data_yaml(yaml_path)
    except HTTPException as exc:
        return {"valid": False, "errors": [str(exc.detail)], "warnings": []}

    nc: int = yaml_data["nc"]
    split_dirs = {"train": yaml_data["train"], "val": yaml_data["val"], "test": yaml_data["test"]}

    for split_name, split_dir in split_dirs.items():
        img_dir = dataset_path / split_dir
        label_dir = Path(str(img_dir).replace("images", "labels"))

        if not img_dir.is_dir():
            if split_name == "test":
                warnings.append(f"Test split directory not found: {split_dir}")
            else:
                errors.append(f"{split_name} images directory not found: {split_dir}")
            continue

        images = _list_images(img_dir)
        if not images and split_name != "test":
            warnings.append(f"{split_name} split has no images")
            continue

        for img in images:
            base_name = Path(img).stem
            label_file = label_dir / f"{base_name}.txt"

            if not label_file.is_file():
                warnings.append(f"Missing label for {split_name}/{img}")
                continue

            try:
                content = label_file.read_text(encoding="utf-8").strip()
                if not content:
                    warnings.append(f"Empty label file: {split_name}/{base_name}.txt")
                    continue

                for line_num, line in enumerate(content.splitlines(), start=1):
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split()
                    if len(parts) < 5:
                        errors.append(
                            f"{split_name}/{base_name}.txt line {line_num}: "
                            f"expected 5 values, got {len(parts)}"
                        )
                        continue

                    try:
                        class_id = int(parts[0])
                        if class_id < 0 or class_id >= nc:
                            errors.append(
                                f"{split_name}/{base_name}.txt line {line_num}: "
                                f"class_id {parts[0]} out of range [0, {nc - 1}]"
                            )
                    except ValueError:
                        errors.append(
                            f"{split_name}/{base_name}.txt line {line_num}: "
                            f"invalid class_id '{parts[0]}'"
                        )

                    for i in range(1, 5):
                        try:
                            val = float(parts[i])
                            if val < 0 or val > 1:
                                errors.append(
                                    f"{split_name}/{base_name}.txt line {line_num}: "
                                    f"value {parts[i]} not in [0, 1]"
                                )
                        except ValueError:
                            errors.append(
                                f"{split_name}/{base_name}.txt line {line_num}: "
                                f"invalid number '{parts[i]}'"
                            )
            except Exception as exc:
                errors.append(f"Failed to read: {label_file} ({exc})")

    return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}


@router.post("/build-jsonl")
async def build_jsonl(request: dict[str, Any]) -> dict[str, Any]:
    """Build a ShareGPT-format JSONL file from user/assistant pairs."""
    pairs: list[dict[str, Any]] = request.get("pairs", [])
    output_path = request.get("outputPath", "")

    if not output_path:
        raise HTTPException(status_code=400, detail="outputPath is required")
    if not pairs:
        raise HTTPException(status_code=400, detail="No pairs provided")

    quality_issues: list[dict[str, Any]] = []
    pairs_per_mode: dict[str, int] = {
        "passenger": 0,
        "voice_command": 0,
        "multilingual": 0,
        "operator": 0,
    }
    seen_user_messages: dict[str, int] = {}
    total_response_tokens = 0
    jsonl_lines: list[str] = []

    for i, pair in enumerate(pairs):
        mode = pair.get("mode", "passenger")
        user_msg = pair.get("userMessage", "")
        assistant_resp = pair.get("assistantResponse", "")

        pairs_per_mode[mode] = pairs_per_mode.get(mode, 0) + 1

        system_prompt = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["passenger"])
        conversation = {
            "conversations": [
                {"from": "system", "value": system_prompt},
                {"from": "human", "value": user_msg},
                {"from": "gpt", "value": assistant_resp},
            ]
        }
        jsonl_lines.append(json.dumps(conversation, ensure_ascii=False))

        # Quality: short response
        response_tokens = len(assistant_resp.strip().split())
        total_response_tokens += response_tokens
        if response_tokens < 5:
            quality_issues.append({
                "severity": "warning",
                "message": f"Pair {i}: response is very short ({response_tokens} tokens)",
                "pairIndex": i,
            })

        # Quality: duplicate user message
        normalized = user_msg.strip().lower()
        if normalized in seen_user_messages:
            quality_issues.append({
                "severity": "warning",
                "message": f"Pair {i}: duplicate user message (first seen at pair {seen_user_messages[normalized]})",
                "pairIndex": i,
            })
        else:
            seen_user_messages[normalized] = i

        # Quality: placeholder text
        for pattern in PLACEHOLDER_PATTERNS:
            if pattern.search(user_msg) or pattern.search(assistant_resp):
                quality_issues.append({
                    "severity": "error",
                    "message": f"Pair {i}: contains placeholder text matching {pattern.pattern}",
                    "pairIndex": i,
                })
                break

    # Mode count warnings
    modes = ["passenger", "voice_command", "multilingual", "operator"]
    for mode in modes:
        count = pairs_per_mode.get(mode, 0)
        if count < 200:
            quality_issues.append({
                "severity": "warning",
                "message": f'Mode "{mode}" has only {count} pairs (recommended: >= 200)',
            })

    # Write file
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(jsonl_lines) + "\n", encoding="utf-8")

    avg_response_tokens = round(total_response_tokens / len(pairs)) if pairs else 0

    return {
        "outputPath": str(out),
        "totalPairs": len(pairs),
        "pairsPerMode": pairs_per_mode,
        "avgResponseTokens": avg_response_tokens,
        "qualityIssues": quality_issues,
    }
