# Copyright 2026 VirtusCo
# LLM fine-tuning script — reads config from stdin, streams metrics to stdout
"""
Standalone fine-tuning script invoked by the training router as a subprocess.
Uses unsloth FastLanguageModel for 2x speedup on consumer GPUs.
Reads a JSON config object from stdin, trains with LoRA/QLoRA/full,
and prints JSON metric objects to stdout per training step.

Expected config keys:
  base_model, dataset_jsonl, method, lora_r, lora_alpha, lora_dropout,
  target_modules, epochs, batch_size, grad_accumulation, learning_rate,
  warmup_ratio, max_seq_length, eval_steps, save_steps, output_dir,
  export_after: {merge_weights, export_gguf}

Output format (one JSON object per line):
  {"step": 10, "loss": 1.23, "eval_loss": 1.45, "learning_rate": 0.0002,
   "epoch": 0.5, "adapter_size_mb": 12.3}
"""

from __future__ import annotations

import json
import math
import os
import sys
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

    # Extract config
    base_model: str = config.get("base_model", "unsloth/Qwen2.5-1.5B-Instruct")
    dataset_jsonl: str = config.get("dataset_jsonl", "")
    method: str = config.get("method", "lora")
    lora_r: int = config.get("lora_r", 16)
    lora_alpha: int = config.get("lora_alpha", 32)
    lora_dropout: float = config.get("lora_dropout", 0.05)
    target_modules: list[str] = config.get(
        "target_modules", ["q_proj", "k_proj", "v_proj", "o_proj"]
    )
    num_epochs: int = config.get("epochs", 3)
    batch_size: int = config.get("batch_size", 4)
    grad_accumulation: int = config.get("grad_accumulation", 4)
    learning_rate: float = config.get("learning_rate", 2e-4)
    warmup_ratio: float = config.get("warmup_ratio", 0.03)
    max_seq_length: int = config.get("max_seq_length", 1024)
    eval_steps: int = config.get("eval_steps", 50)
    save_steps: int = config.get("save_steps", 100)
    output_dir: str = config.get("output_dir", "./runs/llm")
    export_after: dict = config.get(
        "export_after", {"merge_weights": False, "export_gguf": False}
    )

    # Validate dataset
    if not dataset_jsonl or not Path(dataset_jsonl).is_file():
        print(
            json.dumps({"error": f"Dataset not found: {dataset_jsonl}"}),
            flush=True,
        )
        sys.exit(1)

    # Import dependencies (deferred to keep startup fast)
    try:
        from unsloth import FastLanguageModel
    except ImportError:
        print(
            json.dumps(
                {"error": "unsloth not installed. Run: pip install unsloth"}
            ),
            flush=True,
        )
        sys.exit(1)

    try:
        import torch
        from transformers import TrainingArguments, TrainerCallback
        from trl import SFTTrainer
        from datasets import load_dataset
    except ImportError as exc:
        print(
            json.dumps(
                {"error": f"Missing dependency: {exc}. Install transformers, trl, datasets."}
            ),
            flush=True,
        )
        sys.exit(1)

    # Determine dtype based on method
    if method == "qlora":
        load_in_4bit = True
        dtype = None  # auto-detect (bf16 on Ampere+, fp16 on older)
    elif method == "lora":
        load_in_4bit = False
        dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    else:
        # Full fine-tuning
        load_in_4bit = False
        dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16

    # Load model with unsloth for 2x speedup
    try:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=base_model,
            max_seq_length=max_seq_length,
            dtype=dtype,
            load_in_4bit=load_in_4bit,
        )
    except Exception as exc:
        print(
            json.dumps({"error": f"Failed to load model: {exc}"}),
            flush=True,
        )
        sys.exit(1)

    # Apply LoRA if not full fine-tuning
    if method in ("lora", "qlora"):
        model = FastLanguageModel.get_peft_model(
            model,
            r=lora_r,
            target_modules=target_modules,
            lora_alpha=lora_alpha,
            lora_dropout=lora_dropout,
            bias="none",
            use_gradient_checkpointing="unsloth",
            random_state=42,
        )

    # Load dataset (ShareGPT JSONL format)
    try:
        dataset = load_dataset("json", data_files=dataset_jsonl, split="train")
    except Exception as exc:
        print(
            json.dumps({"error": f"Failed to load dataset: {exc}"}),
            flush=True,
        )
        sys.exit(1)

    # Formatting function for ShareGPT conversations
    def formatting_func(examples):
        texts = []
        for conversations in examples["conversations"]:
            parts = []
            for turn in conversations:
                role = turn["from"]
                value = turn["value"]
                if role == "system":
                    parts.append(f"<|im_start|>system\n{value}<|im_end|>")
                elif role == "human":
                    parts.append(f"<|im_start|>user\n{value}<|im_end|>")
                elif role == "gpt":
                    parts.append(f"<|im_start|>assistant\n{value}<|im_end|>")
            texts.append("\n".join(parts))
        return {"text": texts}

    dataset = dataset.map(formatting_func, batched=True)

    # Split for eval if dataset is large enough
    if len(dataset) > 100:
        split = dataset.train_test_split(test_size=0.1, seed=42)
        train_dataset = split["train"]
        eval_dataset = split["test"]
    else:
        train_dataset = dataset
        eval_dataset = None

    # Custom callback to emit metrics to stdout
    class MetricEmitter(TrainerCallback):
        def __init__(self):
            self.last_eval_loss: float = 0.0

        def on_log(self, args, state, control, logs=None, **kwargs):
            if logs is None:
                return

            step = state.global_step
            loss = logs.get("loss", 0.0)
            lr_val = logs.get("learning_rate", 0.0)
            epoch_val = logs.get("epoch", 0.0)
            eval_loss = logs.get("eval_loss", self.last_eval_loss)

            if "eval_loss" in logs:
                self.last_eval_loss = eval_loss

            # Compute adapter size
            adapter_size_mb = 0.0
            adapter_dir = Path(output_dir)
            if adapter_dir.exists():
                for f in adapter_dir.rglob("adapter_model.*"):
                    adapter_size_mb += f.stat().st_size / (1024 * 1024)

            metric = {
                "step": step,
                "loss": round(float(loss), 6),
                "eval_loss": round(float(eval_loss), 6),
                "learning_rate": round(float(lr_val), 8),
                "epoch": round(float(epoch_val), 4),
                "adapter_size_mb": round(adapter_size_mb, 2),
            }
            print(json.dumps(metric), flush=True)

    # Training arguments
    total_steps = math.ceil(
        len(train_dataset) / (batch_size * grad_accumulation)
    ) * num_epochs

    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=num_epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=grad_accumulation,
        learning_rate=learning_rate,
        warmup_ratio=warmup_ratio,
        weight_decay=0.01,
        logging_steps=1,
        eval_strategy="steps" if eval_dataset is not None else "no",
        eval_steps=eval_steps if eval_dataset is not None else None,
        save_strategy="steps",
        save_steps=save_steps,
        save_total_limit=3,
        bf16=torch.cuda.is_bf16_supported(),
        fp16=not torch.cuda.is_bf16_supported(),
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        optim="adamw_8bit",
        lr_scheduler_type="cosine",
        seed=42,
        report_to="none",
        max_grad_norm=0.3,
        remove_unused_columns=False,
    )

    # Create trainer
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        args=training_args,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        callbacks=[MetricEmitter()],
    )

    # Run training
    try:
        train_result = trainer.train()
    except KeyboardInterrupt:
        print(
            json.dumps({"error": "Training cancelled by user"}),
            flush=True,
        )
        # Save checkpoint before exiting
        try:
            trainer.save_model(output_dir)
        except Exception:
            pass
        sys.exit(0)
    except Exception as exc:
        print(
            json.dumps({"error": f"Training failed: {exc}"}),
            flush=True,
        )
        sys.exit(1)

    # Save final adapter/model
    try:
        trainer.save_model(output_dir)
        tokenizer.save_pretrained(output_dir)
    except Exception as exc:
        print(
            json.dumps({"error": f"Failed to save model: {exc}"}),
            flush=True,
        )

    # Post-training exports
    merge_weights = export_after.get("merge_weights", False)
    do_export_gguf = export_after.get("export_gguf", False)

    if merge_weights and method in ("lora", "qlora"):
        try:
            merged_dir = str(Path(output_dir) / "merged")
            model.save_pretrained_merged(
                merged_dir, tokenizer, save_method="merged_16bit"
            )
            print(
                json.dumps({"export_merged": merged_dir}),
                flush=True,
            )
        except Exception as exc:
            print(
                json.dumps({"export_error": f"Weight merge failed: {exc}"}),
                flush=True,
            )

    if do_export_gguf and method in ("lora", "qlora"):
        try:
            gguf_dir = str(Path(output_dir) / "gguf")
            model.save_pretrained_gguf(
                gguf_dir,
                tokenizer,
                quantization_method="q4_k_m",
            )
            print(
                json.dumps({"export_gguf": gguf_dir}),
                flush=True,
            )
        except Exception as exc:
            print(
                json.dumps({"export_error": f"GGUF export failed: {exc}"}),
                flush=True,
            )

    # Final summary
    summary: dict[str, float] = {}
    if train_result and hasattr(train_result, "metrics"):
        for key, val in train_result.metrics.items():
            try:
                summary[key] = round(float(val), 6)
            except (TypeError, ValueError):
                pass

    print(json.dumps({"done": True, "summary": summary}), flush=True)


if __name__ == "__main__":
    main()
