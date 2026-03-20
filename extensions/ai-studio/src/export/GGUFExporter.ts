// Copyright 2026 VirtusCo
// GGUF exporter — merges LoRA adapters, converts to GGUF, and quantizes

import * as vscode from 'vscode';
import { PythonBridge } from '../python/PythonBridge';

// ── Export Step Tracking ────────────────────────────────────────────

export interface ExportStep {
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  log: string;
}

export type QuantMethod =
  | 'Q4_K_M'
  | 'Q4_K_S'
  | 'Q5_K_M'
  | 'Q5_K_S'
  | 'Q8_0'
  | 'F16';

// ── GGUFExporter Class ─────────────────────────────────────────────

export class GGUFExporter {
  private readonly bridge: PythonBridge;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(bridge: PythonBridge, outputChannel: vscode.OutputChannel) {
    this.bridge = bridge;
    this.outputChannel = outputChannel;
  }

  /**
   * Exports a fine-tuned model to GGUF format.
   * Steps: 1) Merge LoRA → 2) Convert HF → GGUF → 3) Quantize
   *
   * @param loraAdapterPath  Path to the LoRA adapter directory
   * @param baseModel        Base model name or path (e.g., "Qwen/Qwen2.5-1.5B-Instruct")
   * @param quantMethod      Quantization method (e.g., "Q4_K_M")
   * @param outputPath       Output path for the final GGUF file
   * @param onStep           Callback for step progress updates
   * @returns                Path to the final quantized GGUF file
   */
  async exportGGUF(
    loraAdapterPath: string,
    baseModel: string,
    quantMethod: QuantMethod,
    outputPath: string,
    onStep?: (steps: ExportStep[]) => void
  ): Promise<string> {
    const steps: ExportStep[] = [
      { name: 'Merge LoRA Adapter', status: 'pending', log: '' },
      { name: 'Convert to GGUF', status: 'pending', log: '' },
      { name: 'Quantize Model', status: 'pending', log: '' },
    ];

    const emitSteps = (): void => {
      if (onStep) {
        onStep([...steps]);
      }
    };

    this.outputChannel.appendLine(
      `[GGUFExporter] Starting export: LoRA=${loraAdapterPath}, ` +
      `base=${baseModel}, quant=${quantMethod}, output=${outputPath}`
    );

    let finalPath = '';

    try {
      await this.bridge.streamSSE(
        '/export/gguf',
        {
          lora_adapter_path: loraAdapterPath,
          base_model: baseModel,
          quant_method: quantMethod,
          output_path: outputPath,
        },
        (event) => {
          switch (event.event) {
            case 'step': {
              try {
                const data = JSON.parse(event.data);
                const stepIndex = data.step_index as number;
                const status = data.status as ExportStep['status'];
                const log = data.log as string | undefined;

                if (stepIndex >= 0 && stepIndex < steps.length) {
                  steps[stepIndex].status = status;
                  if (log) {
                    steps[stepIndex].log += log + '\n';
                  }
                }

                emitSteps();
              } catch {
                this.outputChannel.appendLine(
                  `[GGUFExporter] Failed to parse step event: ${event.data}`
                );
              }
              break;
            }
            case 'done': {
              try {
                const data = JSON.parse(event.data);
                finalPath = data.output_path ?? outputPath;
              } catch {
                finalPath = outputPath;
              }
              break;
            }
            case 'error': {
              this.outputChannel.appendLine(
                `[GGUFExporter] Export error: ${event.data}`
              );
              // Mark current running step as error
              const runningStep = steps.find((s) => s.status === 'running');
              if (runningStep) {
                runningStep.status = 'error';
                runningStep.log += `Error: ${event.data}\n`;
              }
              emitSteps();
              break;
            }
            default:
              break;
          }
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[GGUFExporter] Export failed: ${message}`);

      // Mark remaining pending/running steps as error
      for (const step of steps) {
        if (step.status === 'running' || step.status === 'pending') {
          step.status = 'error';
          step.log += `Export aborted: ${message}\n`;
        }
      }
      emitSteps();
      throw err;
    }

    this.outputChannel.appendLine(`[GGUFExporter] Export complete: ${finalPath}`);
    return finalPath;
  }
}
