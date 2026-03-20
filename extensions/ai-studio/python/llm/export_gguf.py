# Copyright 2026 VirtusCo
# GGUF export script — merges LoRA, converts HF to GGUF, quantizes
"""
Standalone script for GGUF export pipeline. Can be invoked:
1. Via stdin JSON config (by the backend server)
2. As a CLI tool with arguments

Pipeline:
  1. Load base model + LoRA adapter → merge → save merged
  2. Convert merged HF model to GGUF using llama.cpp convert_hf_to_gguf.py
  3. Quantize the GGUF file using llama-quantize

Prints JSON progress lines to stdout for the extension to consume.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


def _print_json(data: dict[str, Any]) -> None:
    """Print a JSON progress line to stdout and flush."""
    print(json.dumps(data, default=str), flush=True)


def _find_convert_script() -> str | None:
    """Search for convert_hf_to_gguf.py in common locations."""
    search_paths = [
        Path(sys.prefix) / "bin" / "convert_hf_to_gguf.py",
        Path(sys.prefix) / "Scripts" / "convert_hf_to_gguf.py",
        Path.home() / ".local" / "bin" / "convert_hf_to_gguf.py",
    ]

    # Check llama_cpp package location
    try:
        import llama_cpp
        pkg_dir = Path(llama_cpp.__file__).parent
        search_paths.append(pkg_dir / "convert_hf_to_gguf.py")
        search_paths.append(pkg_dir.parent / "convert_hf_to_gguf.py")
    except ImportError:
        pass

    # Check common llama.cpp build directories
    home = Path.home()
    search_paths.extend([
        home / "llama.cpp" / "convert_hf_to_gguf.py",
        home / "repos" / "llama.cpp" / "convert_hf_to_gguf.py",
        Path("/opt/llama.cpp/convert_hf_to_gguf.py"),
    ])

    for p in search_paths:
        if p.is_file():
            return str(p)

    return None


def merge_lora(
    base_model: str,
    lora_adapter_path: str,
    output_dir: str,
) -> str:
    """
    Load base model and LoRA adapter, merge weights, and save the
    merged model in HuggingFace format.
    """
    _print_json({
        "step": "merge_lora",
        "status": "running",
        "message": f"Loading base model: {base_model}",
    })

    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(base_model)

    _print_json({
        "step": "merge_lora",
        "status": "running",
        "message": "Tokenizer loaded, loading model weights...",
    })

    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype="auto",
        device_map="auto",
    )

    _print_json({
        "step": "merge_lora",
        "status": "running",
        "message": f"Loading LoRA adapter from {lora_adapter_path}...",
    })

    model = PeftModel.from_pretrained(model, lora_adapter_path)
    model = model.merge_and_unload()

    merged_dir = Path(output_dir)
    merged_dir.mkdir(parents=True, exist_ok=True)

    _print_json({
        "step": "merge_lora",
        "status": "running",
        "message": f"Saving merged model to {merged_dir}...",
    })

    model.save_pretrained(str(merged_dir))
    tokenizer.save_pretrained(str(merged_dir))

    _print_json({
        "step": "merge_lora",
        "status": "done",
        "message": f"Merged model saved: {merged_dir}",
    })

    return str(merged_dir)


def convert_to_gguf(merged_dir: str, output_path: str) -> str:
    """
    Convert a HuggingFace model directory to GGUF format (FP16).
    """
    _print_json({
        "step": "convert_gguf",
        "status": "running",
        "message": "Searching for convert_hf_to_gguf.py...",
    })

    convert_script = _find_convert_script()

    if convert_script is None:
        _print_json({
            "step": "convert_gguf",
            "status": "error",
            "message": (
                "convert_hf_to_gguf.py not found. "
                "Install llama.cpp or set LLAMA_CPP_DIR environment variable."
            ),
        })
        raise FileNotFoundError("convert_hf_to_gguf.py not found")

    _print_json({
        "step": "convert_gguf",
        "status": "running",
        "message": f"Using converter: {convert_script}",
    })

    result = subprocess.run(
        [
            sys.executable,
            convert_script,
            merged_dir,
            "--outfile", output_path,
            "--outtype", "f16",
        ],
        capture_output=True,
        text=True,
        timeout=600,
    )

    if result.returncode != 0:
        _print_json({
            "step": "convert_gguf",
            "status": "error",
            "message": f"Conversion failed: {result.stderr[:500]}",
        })
        raise RuntimeError(f"GGUF conversion failed: {result.stderr}")

    file_size_mb = Path(output_path).stat().st_size / (1024 * 1024)

    _print_json({
        "step": "convert_gguf",
        "status": "done",
        "message": f"FP16 GGUF created: {output_path} ({file_size_mb:.1f} MB)",
    })

    return output_path


def quantize_gguf(input_path: str, output_path: str, quant_method: str) -> str:
    """
    Quantize a GGUF file using llama-quantize.
    """
    _print_json({
        "step": "quantize",
        "status": "running",
        "message": f"Quantizing to {quant_method}...",
    })

    quantize_bin = shutil.which("llama-quantize") or shutil.which("quantize")

    if quantize_bin is None:
        _print_json({
            "step": "quantize",
            "status": "warning",
            "message": (
                "llama-quantize not found on PATH. "
                "Copying FP16 GGUF as output. "
                "Install llama.cpp for proper quantization."
            ),
        })
        shutil.copy2(input_path, output_path)
        return output_path

    result = subprocess.run(
        [quantize_bin, input_path, output_path, quant_method],
        capture_output=True,
        text=True,
        timeout=1200,
    )

    if result.returncode != 0:
        _print_json({
            "step": "quantize",
            "status": "error",
            "message": f"Quantization failed: {result.stderr[:500]}",
        })
        raise RuntimeError(f"Quantization failed: {result.stderr}")

    file_size_mb = Path(output_path).stat().st_size / (1024 * 1024)

    _print_json({
        "step": "quantize",
        "status": "done",
        "message": f"Quantized GGUF saved: {output_path} ({file_size_mb:.1f} MB)",
    })

    return output_path


def export_pipeline(config: dict[str, Any]) -> None:
    """Run the full GGUF export pipeline."""
    base_model = config.get("base_model", "")
    lora_adapter_path = config.get("lora_adapter_path", "")
    quant_method = config.get("quant_method", "Q4_K_M")
    output_path = config.get("output_path", "")

    # If called with just merged_dir (from the server fallback), handle that
    merged_dir = config.get("merged_dir", "")

    if not output_path:
        _print_json({"step": "init", "status": "error", "message": "output_path required"})
        sys.exit(1)

    output_dir = Path(output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)

    # Step 1: Merge LoRA (skip if merged_dir already provided)
    if not merged_dir:
        if not base_model or not lora_adapter_path:
            _print_json({
                "step": "init",
                "status": "error",
                "message": "base_model and lora_adapter_path required (or merged_dir)",
            })
            sys.exit(1)

        merged_dir = str(output_dir / "merged_model")
        merge_lora(base_model, lora_adapter_path, merged_dir)

    # Step 2: Convert to GGUF (FP16)
    fp16_path = str(output_dir / "model-fp16.gguf")
    convert_to_gguf(merged_dir, fp16_path)

    # Step 3: Quantize
    final_path = quantize_gguf(fp16_path, output_path, quant_method)

    # Cleanup
    try:
        fp16_file = Path(fp16_path)
        if fp16_file.is_file() and Path(final_path).is_file() and fp16_path != final_path:
            fp16_file.unlink()
    except Exception:
        pass

    _print_json({
        "step": "complete",
        "status": "done",
        "output_path": final_path,
        "message": f"GGUF export complete: {final_path}",
    })


def main() -> None:
    """Entry point — reads JSON config from stdin."""
    raw = sys.stdin.read().strip()
    if not raw:
        _print_json({"step": "init", "status": "error", "message": "No config on stdin"})
        sys.exit(1)

    try:
        config = json.loads(raw)
    except json.JSONDecodeError as exc:
        _print_json({"step": "init", "status": "error", "message": f"Invalid JSON: {exc}"})
        sys.exit(1)

    export_pipeline(config)


if __name__ == "__main__":
    main()
